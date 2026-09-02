"""
Kebijakan jaringan per domain: pembatasan laju, circuit breaker, dan robots.txt.

Setiap job scraping dijalankan sebagai proses Python baru oleh backend Go, jadi
status "kapan terakhir kali kita menyentuh domain X" TIDAK bisa disimpan di
memori. Modul ini menyimpannya di berkas dengan kunci `flock`, sehingga beberapa
job yang berjalan bersamaan tetap saling menghormati jeda antar-permintaan ke
domain yang sama.

Tiga mekanisme utama:

  wait_turn()             jeda antar-permintaan per domain + jitter, agar pola
                          akses tidak terlihat seperti mesin dan beban ke situs
                          target tetap wajar.
  circuit breaker         setelah beberapa penolakan berturut-turut, domain
                          "dibekukan" sementara. Ini melindungi IP BPS dari
                          masuk daftar hitam permanen.
  robots.txt              menghormati aturan tertulis pemilik situs, termasuk
                          Crawl-delay.

Semua nilai dapat diatur lewat environment variable, dan dapat ditimpa per
domain lewat berkas `domain_policy.json`.
"""

import json
import os
import random
import time
import urllib.parse
import urllib.robotparser

try:
    import fcntl
    _HAS_FLOCK = True
except ImportError:  # pragma: no cover - Windows
    _HAS_FLOCK = False

import requests

from scraper_errors import CircuitOpenError, RobotsDisallowedError


def _env_float(name, default):
    try:
        return float(os.environ.get(name, "").strip() or default)
    except ValueError:
        return default


def _env_int(name, default):
    try:
        return int(os.environ.get(name, "").strip() or default)
    except ValueError:
        return default


def _env_bool(name, default):
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return default
    return raw in ("1", "true", "yes", "on")


MODULE_DIR = os.path.dirname(os.path.abspath(__file__))

# Jeda minimum antar-permintaan ke SATU domain. 4 detik adalah kompromi antara
# kesopanan dan kecepatan; situs kecil sebaiknya diberi nilai lebih besar lewat
# domain_policy.json.
DEFAULT_POLICY = {
    "min_interval": _env_float("SCRAPER_MIN_INTERVAL_SECONDS", 4.0),
    "jitter": _env_float("SCRAPER_JITTER_SECONDS", 2.0),
    "max_attempts": _env_int("SCRAPER_MAX_ATTEMPTS", 3),
    "timeout": _env_float("SCRAPER_TIMEOUT_SECONDS", 20.0),
    "circuit_threshold": _env_int("SCRAPER_CIRCUIT_THRESHOLD", 4),
    "circuit_cooldown": _env_float("SCRAPER_CIRCUIT_COOLDOWN_SECONDS", 900.0),
    # enforce | warn | off
    "robots_mode": (os.environ.get("SCRAPER_ROBOTS_MODE", "").strip().lower() or "enforce"),
    # identified | browser | honest  (lihat fetcher.IDENTITIES)
    "identity": (os.environ.get("SCRAPER_IDENTITY_MODE", "").strip().lower() or "identified"),
    "respect_crawl_delay": _env_bool("SCRAPER_RESPECT_CRAWL_DELAY", True),
}

ROBOTS_TTL = _env_float("SCRAPER_ROBOTS_TTL_SECONDS", 21600.0)     # 6 jam
ROBOTS_FAIL_TTL = _env_float("SCRAPER_ROBOTS_FAIL_TTL_SECONDS", 1800.0)
MAX_THROTTLE_SLEEP = _env_float("SCRAPER_MAX_THROTTLE_SLEEP_SECONDS", 45.0)
LOCK_WAIT_TIMEOUT = _env_float("SCRAPER_LOCK_WAIT_TIMEOUT_SECONDS", 60.0)

_warnings = []
_warning_keys = set()


def warnings_log():
    """Peringatan non-fatal yang dikumpulkan selama satu eksekusi job."""
    return list(_warnings)


def add_warning(message, key=None):
    """Catat peringatan non-fatal untuk satu job.

    `key` memungkinkan peringatan yang berulang dilaporkan sekali saja. Tanpa itu,
    satu domain yang dilewati robots.txt akan mengisi seluruh daftar peringatan
    dengan pesan yang sama untuk setiap URL, sehingga peringatan lain yang lebih
    penting (mis. penerbit yang menolak kita) terdorong keluar oleh batas jumlah.
    """
    if not message:
        return
    dedup_key = key or message
    if dedup_key in _warning_keys:
        return
    _warning_keys.add(dedup_key)
    _warnings.append(message)


# --- Lokasi penyimpanan status -------------------------------------------

def state_dir(*sub):
    base = os.environ.get("SCRAPER_STATE_DIR", "").strip() or os.path.join(MODULE_DIR, ".scraper_state")
    path = os.path.join(base, *sub)
    os.makedirs(path, exist_ok=True)
    return path


def domain_of(url):
    try:
        host = urllib.parse.urlparse(url).hostname or ""
    except ValueError:
        host = ""
    return host.lower()


def _safe_name(domain):
    return "".join(ch if (ch.isalnum() or ch in ".-_") else "_" for ch in domain) or "unknown"


# --- Kebijakan per domain ------------------------------------------------

_policy_cache = None


def _load_policy_file():
    path = os.environ.get("SCRAPER_DOMAIN_POLICY_FILE", "").strip() or os.path.join(MODULE_DIR, "domain_policy.json")
    if not os.path.isfile(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError) as exc:
        add_warning("domain_policy.json tidak dapat dibaca (%s); memakai kebijakan bawaan." % exc)
        return {}
    return data if isinstance(data, dict) else {}


def policy_for(domain):
    """Kebijakan efektif: bawaan <- 'default' pada berkas <- entri domain terdekat."""
    global _policy_cache
    if _policy_cache is None:
        _policy_cache = _load_policy_file()

    policy = dict(DEFAULT_POLICY)
    file_default = _policy_cache.get("default")
    if isinstance(file_default, dict):
        policy.update({k: v for k, v in file_default.items() if not k.startswith("_")})

    domains = _policy_cache.get("domains")
    if isinstance(domains, dict) and domain:
        # Cocokkan host paling spesifik lebih dulu, lalu domain induknya.
        labels = domain.split(".")
        for i in range(len(labels) - 1):
            candidate = ".".join(labels[i:])
            entry = domains.get(candidate)
            if isinstance(entry, dict):
                policy.update({k: v for k, v in entry.items() if not k.startswith("_")})
                break
    return policy


# --- Kunci berkas lintas proses ------------------------------------------

class _FileLock:
    def __init__(self, path, timeout=LOCK_WAIT_TIMEOUT):
        self.path = path
        self.timeout = timeout
        self.fh = None
        self.acquired = False

    def __enter__(self):
        if not _HAS_FLOCK:
            return self
        try:
            self.fh = open(self.path, "a+")
        except OSError:
            return self
        deadline = time.monotonic() + self.timeout
        while True:
            try:
                fcntl.flock(self.fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                self.acquired = True
                break
            except OSError:
                if time.monotonic() >= deadline:
                    # Best effort: jangan menggagalkan job hanya karena kunci sibuk.
                    break
                time.sleep(0.05)
        return self

    def __exit__(self, *exc):
        if self.fh is not None:
            try:
                if self.acquired:
                    fcntl.flock(self.fh.fileno(), fcntl.LOCK_UN)
            except OSError:
                pass
            self.fh.close()
        return False


def _state_path(domain):
    return os.path.join(state_dir("domains"), _safe_name(domain) + ".json")


def _read_state(domain):
    try:
        with open(_state_path(domain), "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _write_state(domain, data):
    path = _state_path(domain)
    tmp = path + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh)
        os.replace(tmp, path)
    except OSError:
        pass


# --- Pembatasan laju -----------------------------------------------------

def wait_turn(domain, min_interval=None, jitter=None):
    """Tunggu sampai domain ini boleh disentuh lagi, lalu catat waktunya.

    Kunci ditahan selama menunggu sehingga proses job lain yang menyasar domain
    yang sama ikut serialized -- ini yang membuat jeda benar-benar dihormati
    walau beberapa job berjalan bersamaan.
    """
    if not domain:
        return 0.0
    policy = policy_for(domain)
    interval = policy["min_interval"] if min_interval is None else max(float(min_interval), 0.0)
    jit = policy["jitter"] if jitter is None else float(jitter)

    slept = 0.0
    lock_path = os.path.join(state_dir("domains"), _safe_name(domain) + ".lock")
    with _FileLock(lock_path):
        st = _read_state(domain)
        last = float(st.get("last_request_at") or 0.0)
        wait = (last + interval) - time.time()
        wait += random.uniform(0.0, max(jit, 0.0))
        if wait > 0:
            slept = min(wait, MAX_THROTTLE_SLEEP)
            time.sleep(slept)
        st["last_request_at"] = time.time()
        st["requests"] = int(st.get("requests") or 0) + 1
        _write_state(domain, st)
    return slept


def sleep_with_jitter(seconds, jitter_ratio=0.25):
    """Backoff yang tidak seragam -- pola seragam mudah dikenali sebagai bot."""
    seconds = max(float(seconds), 0.0)
    extra = random.uniform(0.0, seconds * jitter_ratio) if seconds else 0.0
    total = min(seconds + extra, MAX_THROTTLE_SLEEP)
    if total > 0:
        time.sleep(total)
    return total


# --- Circuit breaker -----------------------------------------------------

def assert_circuit_closed(domain):
    if not domain:
        return
    st = _read_state(domain)
    until = float(st.get("circuit_open_until") or 0.0)
    remaining = until - time.time()
    if remaining > 0:
        raise CircuitOpenError(
            "Akses ke %s dibekukan sementara selama %d detik lagi setelah %d penolakan berturut-turut."
            % (domain, int(remaining), int(st.get("consecutive_failures") or 0)),
            url=domain,
            retry_after=int(remaining),
        )


def record_outcome(domain, ok, cooldown_hint=None):
    """Catat hasil satu permintaan; buka circuit bila penolakan menumpuk."""
    if not domain:
        return
    policy = policy_for(domain)
    lock_path = os.path.join(state_dir("domains"), _safe_name(domain) + ".lock")
    with _FileLock(lock_path, timeout=5.0):
        st = _read_state(domain)
        if ok:
            st["consecutive_failures"] = 0
            st["circuit_open_until"] = 0
            st["last_success_at"] = time.time()
        else:
            fails = int(st.get("consecutive_failures") or 0) + 1
            st["consecutive_failures"] = fails
            st["last_failure_at"] = time.time()
            if fails >= int(policy["circuit_threshold"]):
                cooldown = float(policy["circuit_cooldown"])
                if cooldown_hint:
                    cooldown = max(cooldown, float(cooldown_hint))
                st["circuit_open_until"] = time.time() + cooldown
        _write_state(domain, st)


# --- robots.txt ----------------------------------------------------------

def _robots_cache_path(domain):
    return os.path.join(state_dir("robots"), _safe_name(domain) + ".json")


def _load_robots_cache(domain):
    try:
        with open(_robots_cache_path(domain), "r", encoding="utf-8") as fh:
            data = json.load(fh)
    except (OSError, ValueError):
        return None
    if not isinstance(data, dict):
        return None
    age = time.time() - float(data.get("fetched_at") or 0.0)
    ttl = ROBOTS_TTL if data.get("ok") else ROBOTS_FAIL_TTL
    if age > ttl:
        return None
    return data


def _store_robots_cache(domain, text, ok, status=None):
    data = {"fetched_at": time.time(), "text": text or "", "ok": bool(ok), "status": status}
    path = _robots_cache_path(domain)
    tmp = path + ".tmp"
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(data, fh)
        os.replace(tmp, path)
    except OSError:
        pass
    return data


def _fetch_robots(url, user_agent):
    """Ambil robots.txt langsung (tanpa lewat fetcher, agar tidak rekursif).

    Permintaan ini sengaja tidak melewati wait_turn(): ia menahan kunci domain
    yang sama sehingga akan saling menunggu. Satu permintaan kecil ke
    /robots.txt tidak melanggar kesopanan apa pun.
    """
    parsed = urllib.parse.urlparse(url)
    domain = (parsed.hostname or "").lower()
    if not domain:
        return None

    cached = _load_robots_cache(domain)
    if cached is not None:
        return cached

    robots_url = "%s://%s%s/robots.txt" % (
        parsed.scheme or "https",
        parsed.hostname,
        ":%d" % parsed.port if parsed.port else "",
    )
    try:
        resp = requests.get(
            robots_url,
            headers={"User-Agent": user_agent, "Accept": "text/plain,*/*;q=0.8"},
            timeout=10,
            allow_redirects=True,
        )
    except requests.RequestException:
        return _store_robots_cache(domain, "", ok=False, status=None)

    if resp.status_code == 200:
        text = resp.text[:512000]
        return _store_robots_cache(domain, text, ok=True, status=200)

    # 404 / 5xx / apa pun selain 200 diperlakukan sebagai "tidak ada aturan".
    return _store_robots_cache(domain, "", ok=False, status=resp.status_code)


def _parser_for(url, user_agent):
    data = _fetch_robots(url, user_agent)
    if not data or not data.get("ok") or not data.get("text"):
        return None
    parser = urllib.robotparser.RobotFileParser()
    try:
        parser.parse(data["text"].splitlines())
    except Exception:
        return None
    return parser


def _agent_token(user_agent):
    """robotparser mencocokkan nama agen sebagai substring, jadi kirim token bot
    kita saja bila ada -- bukan seluruh string User-Agent."""
    ua = (user_agent or "").strip()
    for part in ua.replace("(", " ").replace(")", " ").replace(";", " ").split():
        if "bot" in part.lower() and "/" in part:
            return part.split("/")[0]
    return ua or "*"


def check_robots(url, user_agent):
    """Terapkan robots.txt sesuai mode kebijakan domain.

    enforce (bawaan) -> lempar RobotsDisallowedError
    warn             -> catat peringatan, tetap lanjut
    off              -> lewati pemeriksaan
    """
    domain = domain_of(url)
    policy = policy_for(domain)
    mode = str(policy.get("robots_mode", "enforce")).lower()
    if mode == "off":
        return True

    parser = _parser_for(url, user_agent)
    if parser is None:
        return True

    agent = _agent_token(user_agent)
    try:
        allowed = parser.can_fetch(agent, url)
    except Exception:
        return True

    if allowed:
        return True

    if mode == "warn":
        # Dilaporkan satu kali per domain, bukan per URL.
        add_warning(
            "robots.txt %s melarang akses otomatis ke alamat seperti %s, namun mode "
            "kebijakan domain ini disetel 'warn' sehingga penarikan tetap dijalankan."
            % (domain, url),
            key="robots-warn:%s" % domain,
        )
        return True

    raise RobotsDisallowedError(
        "robots.txt pada %s melarang akses otomatis ke alamat ini." % domain,
        url=url,
    )


def crawl_delay(url, user_agent):
    """Crawl-delay yang diminta situs (detik), atau None bila tidak dinyatakan."""
    domain = domain_of(url)
    policy = policy_for(domain)
    if not policy.get("respect_crawl_delay", True):
        return None
    parser = _parser_for(url, user_agent)
    if parser is None:
        return None
    try:
        delay = parser.crawl_delay(_agent_token(user_agent))
    except Exception:
        return None
    try:
        return float(delay) if delay is not None else None
    except (TypeError, ValueError):
        return None


def effective_interval(url, user_agent):
    """Jeda yang benar-benar dipakai: yang terbesar antara kebijakan kita sendiri
    dan Crawl-delay yang diminta situs target."""
    policy = policy_for(domain_of(url))
    interval = float(policy["min_interval"])
    delay = crawl_delay(url, user_agent)
    if delay is not None:
        interval = max(interval, delay)
    return interval
