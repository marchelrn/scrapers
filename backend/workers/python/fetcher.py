"""
Satu-satunya pintu keluar jaringan untuk semua worker scraping.

Sebelum modul ini ada, setiap scraper membangun header, proxy, dan timeout-nya
sendiri (empat salinan kode proxy yang tidak konsisten, satu di antaranya rusak
untuk proxy berkredensial, dan satu User-Agent Chrome yang sama di mana-mana
tanpa jeda antar-permintaan). Akibatnya sistem ini mudah dikenali dan diblokir.

Dengan menyalurkan seluruh akses lewat modul ini, setiap permintaan otomatis
mendapat:

  * validasi URL (perlindungan SSRF, termasuk setelah redirect)
  * pemeriksaan robots.txt dan Crawl-delay
  * jeda antar-permintaan per domain + jitter, lintas proses
  * identitas yang konsisten dan dapat dihubungi
  * permintaan bersyarat (ETag / If-Modified-Since) sehingga banyak penarikan
    berakhir sebagai 304 tanpa membebani situs target
  * cookie jar persisten per domain
  * backoff eksponensial yang menghormati header Retry-After
  * deteksi halaman verifikasi bot (Cloudflare/DataDome/Incapsula)
  * circuit breaker per domain
  * klasifikasi error yang bisa dibaca operator non-teknis
"""

import http.cookiejar
import os
import random
import re
import time
import urllib.parse

import requests

import http_cache
import net_policy
from scraper_errors import (
    AuthFailedError,
    BlockedError,
    ChallengeDetectedError,
    ContentTypeError,
    FetchTimeoutError,
    NetworkError,
    NotFoundError,
    ProxyConfigError,
    RateLimitedError,
    ScraperError,
    UpstreamError,
    ValidationError,
)
from url_validator import validate_url

BOT_NAME = (os.environ.get("SCRAPER_BOT_NAME", "").strip() or "BPS-FenomenaBot")
BOT_VERSION = (os.environ.get("SCRAPER_BOT_VERSION", "").strip() or "1.0")
BOT_CONTACT = (os.environ.get("SCRAPER_BOT_CONTACT", "").strip() or "https://www.bps.go.id")
CHROME_MAJOR = (os.environ.get("SCRAPER_CHROME_MAJOR", "").strip() or "131")
ACCEPT_LANGUAGE = (os.environ.get("SCRAPER_ACCEPT_LANGUAGE", "").strip() or "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7")

_ACCEPT_HTML = ("text/html,application/xhtml+xml,application/xml;q=0.9,"
                "image/avif,image/webp,*/*;q=0.8")


def _bot_token():
    return "%s/%s" % (BOT_NAME, BOT_VERSION)


def _identified_ua():
    # Bentuk "Mozilla/5.0 (compatible; NamaBot/versi; +kontak)" adalah konvensi
    # crawler yang jujur (dipakai Bingbot, Applebot): situs tetap mengenali kita
    # sebagai mesin dan bisa menghubungi kita, tanpa kita berpura-pura manusia.
    return ("Mozilla/5.0 (compatible; %s; +%s) AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/%s.0.0.0 Safari/537.36" % (_bot_token(), BOT_CONTACT, CHROME_MAJOR))


def _browser_ua():
    return ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/%s.0.0.0 Safari/537.36" % CHROME_MAJOR)


def identity_profile(mode):
    """Kumpulan header yang saling konsisten untuk satu mode identitas.

    Konsistensi lebih penting daripada penyamaran: mengirim User-Agent Chrome
    bersama header Sec-CH-UA Chrome dari klien yang jelas bukan Chrome justru
    memperbesar peluang terdeteksi. Karena itu Sec-CH-UA hanya dikirim pada mode
    'browser'.
    """
    mode = (mode or "identified").lower()

    if mode == "honest":
        headers = {
            "User-Agent": "%s (+%s)" % (_bot_token(), BOT_CONTACT),
            "Accept": _ACCEPT_HTML,
            "Accept-Language": ACCEPT_LANGUAGE,
        }
    elif mode == "browser":
        headers = {
            "User-Agent": _browser_ua(),
            "Accept": _ACCEPT_HTML,
            "Accept-Language": ACCEPT_LANGUAGE,
            "Sec-Ch-Ua": '"Chromium";v="%s", "Google Chrome";v="%s", "Not?A_Brand";v="24"' % (CHROME_MAJOR, CHROME_MAJOR),
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Upgrade-Insecure-Requests": "1",
        }
    else:  # identified (bawaan)
        headers = {
            "User-Agent": _identified_ua(),
            "Accept": _ACCEPT_HTML,
            "Accept-Language": ACCEPT_LANGUAGE,
        }

    if "@" in BOT_CONTACT and "://" not in BOT_CONTACT:
        headers["From"] = BOT_CONTACT

    headers["Accept-Encoding"] = "gzip, deflate"
    headers["Connection"] = "keep-alive"
    return headers


def user_agent_for(url, mode=None):
    policy = net_policy.policy_for(net_policy.domain_of(url))
    return identity_profile(mode or policy.get("identity"))["User-Agent"]


# --- Proxy ---------------------------------------------------------------

def proxy_url():
    """Satu sumber kebenaran untuk proxy, menggantikan empat salinan kode yang
    sebelumnya tersebar dan tidak konsisten."""
    for name in ("HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"):
        value = os.environ.get(name, "").strip()
        if value:
            return value
    return None


def requests_proxies():
    url = proxy_url()
    if not url:
        return None
    return {"http": url, "https": url}


# Penanda kegagalan yang berasal dari proxy keluar kita sendiri, bukan dari situs
# target. Untuk target https, proxy menolak pada tahap CONNECT sehingga requests
# tidak pernah menerima respons -- kegagalannya muncul sebagai exception, dan
# tanpa pemeriksaan ini ia tersamar sebagai "koneksi ke situs target gagal".
_PROXY_FAILURE_MARKERS = (
    "proxy authentication required",
    "tunnel connection failed",
    "cannot connect to proxy",
    "unable to connect to proxy",
    "proxyerror",
)


def _proxy_failure_message(exc):
    """Pesan operator bila `exc` ternyata kegagalan proxy, selain itu None."""
    if not proxy_url():
        return None
    text = _scrub_proxy_credentials(str(exc))
    lowered = text.lower()
    if isinstance(exc, requests.exceptions.ProxyError) or any(
            marker in lowered for marker in _PROXY_FAILURE_MARKERS):
        # Endpoint disebut tanpa kredensial: pesan ini ikut masuk ke log job yang
        # dapat dibaca operator non-IPDS.
        return "Proxy keluar %s menolak permintaan (%s)." % (proxy_endpoint() or "yang dikonfigurasi", text)
    return None


# Pesan galat dari urllib3 kadang memuat URL proxy utuh. Kredensial di dalamnya
# tidak boleh ikut tersimpan ke log job yang dibaca operator.
_PROXY_USERINFO_RE = re.compile(r"//[^/\s:@]+:[^/\s@]+@")


def _scrub_proxy_credentials(text):
    return _PROXY_USERINFO_RE.sub("//***:***@", text or "")


def proxy_endpoint():
    """Host:port proxy tanpa kredensial, aman untuk ditulis ke log."""
    url = proxy_url()
    if not url:
        return None
    parsed = urllib.parse.urlparse(url)
    if not parsed.hostname:
        return None
    return "%s:%d" % (parsed.hostname, parsed.port) if parsed.port else parsed.hostname


def playwright_proxy():
    """Playwright memerlukan server tanpa kredensial, dengan username/password
    sebagai field terpisah. keyword_scraper.py sebelumnya mengirim URL utuh
    sebagai `server`, sehingga proxy berkredensial selalu gagal."""
    url = proxy_url()
    if not url:
        return None
    parsed = urllib.parse.urlparse(url)
    if not parsed.hostname:
        return None
    server = "%s://%s" % (parsed.scheme or "http", parsed.hostname)
    if parsed.port:
        server += ":%d" % parsed.port
    config = {"server": server}
    if parsed.username:
        config["username"] = urllib.parse.unquote(parsed.username)
    if parsed.password:
        config["password"] = urllib.parse.unquote(parsed.password)
    return config


# --- Cookie jar persisten ------------------------------------------------

def _cookie_path(domain):
    return os.path.join(net_policy.state_dir("cookies"), net_policy._safe_name(domain) + ".txt")


def make_session(url, persist_cookies=True):
    """Session dengan cookie jar per domain.

    Cookie disimpan agar penarikan berikutnya tidak memicu ulang alur
    "set cookie lalu redirect" yang dipakai banyak situs -- lebih sedikit
    permintaan, lebih kecil peluang dianggap pengunjung mencurigakan.
    Session yang membawa kredensial tidak pernah ditulis ke disk.
    """
    session = requests.Session()
    domain = net_policy.domain_of(url)
    if persist_cookies and domain:
        path = _cookie_path(domain)
        jar = http.cookiejar.LWPCookieJar(path)
        if os.path.exists(path):
            try:
                jar.load(ignore_discard=True, ignore_expires=True)
            except (OSError, http.cookiejar.LoadError):
                pass
        session.cookies = requests.cookies.merge_cookies(
            requests.cookies.RequestsCookieJar(), jar
        )
        session._bps_cookie_jar = jar
    return session


def save_cookies(session):
    jar = getattr(session, "_bps_cookie_jar", None)
    if jar is None:
        return
    try:
        for cookie in session.cookies:
            jar.set_cookie(cookie)
        jar.save(ignore_discard=True, ignore_expires=True)
        os.chmod(jar.filename, 0o600)
    except (OSError, http.cookiejar.LoadError, ValueError):
        pass


# --- Deteksi halaman verifikasi bot --------------------------------------

# Penanda ini penting karena hampir semua WAF menyajikan halaman verifikasi
# dengan HTTP 200. Tanpa deteksi, sistem menyimpannya sebagai "berhasil tapi
# kosong" dan operator menyimpulkan selector-nya salah.
_CHALLENGE_BODY_MARKERS = (
    ("just a moment", "Cloudflare JS challenge"),
    ("checking your browser before accessing", "Cloudflare interstitial"),
    ("attention required! | cloudflare", "Cloudflare block page"),
    ("cf-browser-verification", "Cloudflare browser verification"),
    ("cf_chl_opt", "Cloudflare challenge script"),
    ("enable javascript and cookies to continue", "Cloudflare/WAF challenge"),
    ("captcha-delivery.com", "DataDome CAPTCHA"),
    ("datadome", "DataDome"),
    ("incapsula incident id", "Imperva/Incapsula block"),
    ("_incapsula_resource", "Imperva/Incapsula challenge"),
    ("perimeterx", "PerimeterX"),
    ("px-captcha", "PerimeterX CAPTCHA"),
    ("verifying you are human", "WAF human verification"),
    ("ddos-guard", "DDoS-Guard"),
    ("请稍候", "WAF interstitial"),
)

_CHALLENGE_HEADER_KEYS = ("cf-mitigated", "x-datadome", "x-datadome-cid", "x-iinfo")


def detect_challenge(status_code=None, headers=None, body_text=None):
    """Kembalikan nama mekanisme verifikasi bila halaman ini bukan konten asli."""
    lower_headers = {str(k).lower(): str(v).lower() for k, v in (headers or {}).items()}
    for key in _CHALLENGE_HEADER_KEYS:
        if key in lower_headers:
            return "WAF (%s)" % key
    server = lower_headers.get("server", "")
    if "ddos-guard" in server:
        return "DDoS-Guard"

    if not body_text:
        return None
    snippet = body_text[:8000].lower()
    for marker, label in _CHALLENGE_BODY_MARKERS:
        if marker in snippet:
            return label
    return None


def _retry_after_seconds(headers):
    raw = (headers or {}).get("Retry-After") or (headers or {}).get("retry-after")
    if not raw:
        return None
    raw = str(raw).strip()
    try:
        return max(float(raw), 0.0)
    except ValueError:
        pass
    try:
        from email.utils import parsedate_to_datetime
        target = parsedate_to_datetime(raw)
        if target is None:
            return None
        delta = target.timestamp() - time.time()
        return max(delta, 0.0)
    except (TypeError, ValueError, OverflowError):
        return None


def _text_of(response, limit=8000):
    ctype = (response.headers.get("Content-Type") or "").lower()
    if ctype and not any(t in ctype for t in ("text", "html", "xml", "json", "javascript")):
        return ""
    try:
        return response.text[:limit]
    except Exception:
        return ""


def _classify(url, response):
    """Bungkus tipis di atas classify_raw() untuk objek respons `requests`."""
    return classify_raw(url, response.status_code, dict(response.headers),
                        _text_of(response), _retry_after_seconds(response.headers))


def _backoff(attempt, retry_after=None, cap=20.0):
    """Backoff eksponensial dengan jitter; header Retry-After selalu diutamakan."""
    if retry_after is not None and retry_after <= cap:
        return net_policy.sleep_with_jitter(retry_after, jitter_ratio=0.1)
    base = min(1.5 * (2 ** attempt), cap)
    return net_policy.sleep_with_jitter(base, jitter_ratio=0.5)


def _validate_chain(response):
    """Redirect bisa dipakai untuk menembus penjaga SSRF, jadi seluruh rantai
    alamat -- bukan hanya URL awal -- ikut divalidasi."""
    for hop in list(response.history) + [response]:
        try:
            validate_url(hop.url)
        except ValueError as exc:
            raise ValidationError("Redirect menuju alamat yang tidak diizinkan: %s" % exc,
                                  url=hop.url)


def classify_raw(url, status, headers, body_text, retry_after=None):
    """Klasifikasi berbasis data mentah, dipakai baik oleh jalur `requests`
    maupun jalur browser Playwright agar keduanya melaporkan hal yang sama."""
    if retry_after is None:
        retry_after = _retry_after_seconds(headers)
    domain = net_policy.domain_of(url)

    challenge = detect_challenge(status, headers, body_text)
    if challenge:
        detail = ("Situs %s menyajikan halaman verifikasi bot (%s), bukan konten"
                  % (domain, challenge))
        detail += " (HTTP %s)." % status if status else "."
        raise ChallengeDetectedError(detail, url=url, http_status=status, retry_after=retry_after)

    if status is None:
        return
    if 200 <= status < 300 or status == 304:
        return
    if status == 401:
        raise AuthFailedError("Situs target meminta autentikasi (HTTP 401).", url=url, http_status=status)
    if status in (403, 451):
        raise BlockedError("Situs %s menolak permintaan (HTTP %d)." % (domain, status),
                           url=url, http_status=status, retry_after=retry_after)
    if status in (404, 410):
        raise NotFoundError("Alamat tidak ditemukan di situs target (HTTP %d)." % status,
                            url=url, http_status=status)
    if status == 429:
        suffix = "; meminta jeda %d detik" % int(retry_after) if retry_after else ""
        raise RateLimitedError("Situs %s membatasi laju akses (HTTP 429)%s." % (domain, suffix),
                               url=url, http_status=status, retry_after=retry_after)
    if status >= 500:
        raise UpstreamError("Situs target sedang bermasalah (HTTP %d)." % status,
                            url=url, http_status=status, retry_after=retry_after)
    raise UpstreamError("Respons tidak terduga dari situs target (HTTP %d)." % status,
                        url=url, http_status=status, retry_after=retry_after)


class FetchResult:
    """Hasil satu permintaan yang sudah lolos klasifikasi."""

    __slots__ = ("url", "status_code", "content", "headers", "encoding",
                 "from_cache", "attempts", "elapsed")

    def __init__(self, url, status_code, content, headers, encoding="utf-8",
                 from_cache=False, attempts=1, elapsed=0.0):
        self.url = url
        self.status_code = status_code
        self.content = content or b""
        self.headers = headers or {}
        self.encoding = encoding or "utf-8"
        self.from_cache = from_cache
        self.attempts = attempts
        self.elapsed = elapsed

    @property
    def text(self):
        return self.content.decode(self.encoding, errors="replace")

    @property
    def content_type(self):
        for key, value in self.headers.items():
            if str(key).lower() == "content-type":
                return str(value).lower()
        return ""

    def json(self):
        import json as _json
        try:
            return _json.loads(self.text)
        except ValueError as exc:
            raise ContentTypeError(
                "Respons dari situs target bukan JSON yang valid: %s" % exc, url=self.url)


def _pick_encoding(response):
    # requests memakai ISO-8859-1 bila charset tidak dinyatakan pada text/html,
    # yang merusak teks Indonesia ber-UTF-8. Utamakan UTF-8 bila tidak dinyatakan.
    ctype = (response.headers.get("Content-Type") or "").lower()
    if "charset=" in ctype and response.encoding:
        return response.encoding
    return "utf-8"


def _check_expect(result, expect):
    if expect == "json":
        if result.content_type and "json" not in result.content_type:
            raise ContentTypeError(
                "Diharapkan JSON, tetapi situs mengirim '%s'. Sering merupakan tanda "
                "halaman blokir atau halaman login." % result.content_type,
                url=result.url, http_status=result.status_code)
    elif expect == "html":
        ctype = result.content_type
        if ctype and not any(t in ctype for t in ("html", "xml", "text")):
            raise ContentTypeError(
                "Diharapkan halaman HTML, tetapi situs mengirim '%s'." % ctype,
                url=result.url, http_status=result.status_code)


def fetch(url, method="GET", headers=None, params=None, data=None, json_body=None,
          timeout=None, allow_redirects=True, expect="any", use_cache=True,
          persist_cookies=True, identity=None, max_attempts=None, session=None):
    """Ambil satu alamat dengan seluruh kebijakan kesopanan diterapkan.

    Melempar turunan ScraperError yang sudah terklasifikasi; tidak pernah
    mengembalikan respons error tanpa penjelasan.
    """
    if not url or not isinstance(url, str):
        raise ValidationError("URL kosong atau bukan teks.")
    try:
        validate_url(url)
    except ValueError as exc:
        raise ValidationError(str(exc), url=url)

    domain = net_policy.domain_of(url)
    policy = net_policy.policy_for(domain)
    mode = identity or policy.get("identity")
    profile = identity_profile(mode)
    user_agent = profile["User-Agent"]
    timeout = float(timeout or policy["timeout"])
    attempts_allowed = max(int(max_attempts or policy["max_attempts"]), 1)
    method = method.upper()

    # Aturan tertulis pemilik situs diperiksa lebih dulu -- sebelum satu byte pun
    # permintaan konten dikirim.
    net_policy.check_robots(url, user_agent)
    interval = net_policy.effective_interval(url, user_agent)

    req_headers = dict(profile)
    for key, value in (headers or {}).items():
        req_headers[key] = value

    cache_entry = http_cache.lookup(url, method) if use_cache else None
    if cache_entry:
        req_headers.update(http_cache.conditional_headers(cache_entry))

    own_session = session is None
    sess = session if session is not None else make_session(url, persist_cookies=persist_cookies)
    proxies = requests_proxies()
    started = time.time()
    last_error = None

    try:
        for attempt in range(attempts_allowed):
            net_policy.assert_circuit_closed(domain)
            net_policy.wait_turn(domain, min_interval=interval)

            try:
                response = sess.request(
                    method, url, headers=req_headers, params=params, data=data,
                    json=json_body, timeout=timeout, allow_redirects=allow_redirects,
                    proxies=proxies,
                )
            except requests.Timeout as exc:
                last_error = FetchTimeoutError(
                    "Situs %s tidak merespons dalam %.0f detik." % (domain, timeout),
                    url=url)
            except requests.TooManyRedirects as exc:
                last_error = UpstreamError("Terlalu banyak redirect pada %s: %s" % (domain, exc), url=url)
            except requests.RequestException as exc:
                proxy_problem = _proxy_failure_message(exc)
                if proxy_problem:
                    # Tidak retryable dan tidak dihitung terhadap domain: mengulang
                    # tidak akan memperbaiki proxy, dan domainnya sendiri tak bersalah.
                    last_error = ProxyConfigError(proxy_problem, url=url)
                else:
                    last_error = NetworkError("Koneksi ke %s gagal: %s" % (domain, exc), url=url)
            else:
                _validate_chain(response)

                # 304 tanpa entri cache tidak berguna: ulangi tanpa validator.
                if response.status_code == 304 and not cache_entry:
                    req_headers.pop("If-None-Match", None)
                    req_headers.pop("If-Modified-Since", None)
                    if attempt < attempts_allowed - 1:
                        continue

                try:
                    _classify(url, response)
                except ScraperError as exc:
                    last_error = exc
                else:
                    net_policy.record_outcome(domain, True)
                    if persist_cookies:
                        save_cookies(sess)

                    if response.status_code == 304 and cache_entry:
                        http_cache.refresh(url, response.headers, method)
                        result = FetchResult(
                            url=response.url, status_code=200, content=cache_entry["content"],
                            headers={"Content-Type": cache_entry.get("content_type", "")},
                            encoding="utf-8", from_cache=True, attempts=attempt + 1,
                            elapsed=time.time() - started)
                    else:
                        if use_cache:
                            http_cache.store(url, response.status_code, response.headers,
                                             response.content, method)
                        result = FetchResult(
                            url=response.url, status_code=response.status_code,
                            content=response.content, headers=dict(response.headers),
                            encoding=_pick_encoding(response), from_cache=False,
                            attempts=attempt + 1, elapsed=time.time() - started)

                    _check_expect(result, expect)
                    return result

            if last_error.counts_against_domain:
                net_policy.record_outcome(domain, False, cooldown_hint=last_error.retry_after)

            if last_error.retryable and attempt < attempts_allowed - 1:
                _backoff(attempt, last_error.retry_after)
                continue
            raise last_error

        raise last_error or NetworkError("Permintaan gagal tanpa keterangan.", url=url)
    finally:
        if own_session:
            sess.close()


def fetch_text(url, **kwargs):
    return fetch(url, expect=kwargs.pop("expect", "html"), **kwargs).text


def fetch_json(url, **kwargs):
    return fetch(url, expect="json", **kwargs).json()


# --- Jalur browser (Playwright) ------------------------------------------
#
# Tiga teknik (css, headless, keyword_find) memakai browser sungguhan. Sebelumnya
# masing-masing menyalin sendiri kode proxy, User-Agent, dan opsi peluncuran,
# dengan hasil yang berbeda-beda. Helper di bawah membuat ketiganya identik dan
# ikut tunduk pada kebijakan yang sama seperti jalur `requests`.

def _env_bool(name, default):
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return default
    return raw in ("1", "true", "yes", "on")


IGNORE_TLS_ERRORS = _env_bool("SCRAPER_IGNORE_TLS_ERRORS", False)
BLOCK_ASSETS = _env_bool("SCRAPER_BLOCK_ASSETS", True)
BROWSER_LOCALE = (os.environ.get("SCRAPER_BROWSER_LOCALE", "").strip() or "id-ID")
BROWSER_TIMEZONE = (os.environ.get("SCRAPER_BROWSER_TIMEZONE", "").strip() or "Asia/Makassar")
BROWSER_TIMEOUT_MS = int(os.environ.get("SCRAPER_BROWSER_TIMEOUT_MS", "") or 30000)

_BLOCKED_RESOURCE_TYPES = {"image", "media", "font"}


def browser_launch_options(url=None, identity=None):
    policy = net_policy.policy_for(net_policy.domain_of(url or ""))
    mode = (identity or policy.get("identity") or "identified").lower()

    args = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
    # Penyamaran hanya masuk akal bila kita memang sedang menyamar. Pada mode
    # 'identified' kita justru menyatakan diri sebagai bot, sehingga flag stealth
    # separuh jalan hanya menambah ketidakkonsistenan.
    if mode == "browser":
        args.append("--disable-blink-features=AutomationControlled")

    options = {"headless": True, "args": args}
    proxy = playwright_proxy()
    if proxy:
        options["proxy"] = proxy
    return options


def browser_context_options(url=None, identity=None, extra_headers=None):
    policy = net_policy.policy_for(net_policy.domain_of(url or ""))
    profile = identity_profile(identity or policy.get("identity"))

    # Hanya Accept-Language yang dikirim manual; header Sec-*, Accept, dan
    # Accept-Encoding dibangun sendiri oleh Chromium dan harus tidak diganggu
    # agar tidak terjadi ketidakcocokan sidik jari.
    headers = {"Accept-Language": ACCEPT_LANGUAGE}
    if extra_headers:
        headers.update(extra_headers)

    return {
        "user_agent": profile["User-Agent"],
        "locale": BROWSER_LOCALE,
        "timezone_id": BROWSER_TIMEZONE,
        "viewport": {"width": 1366, "height": 768},
        "ignore_https_errors": IGNORE_TLS_ERRORS,
        "extra_http_headers": headers,
    }


def install_asset_blocking(context):
    """Batalkan gambar/font/video: beban ke situs target turun drastis dan
    halaman selesai lebih cepat, tanpa memengaruhi ekstraksi teks."""
    if not BLOCK_ASSETS:
        return

    def _handler(route):
        try:
            if route.request.resource_type in _BLOCKED_RESOURCE_TYPES:
                route.abort()
            else:
                route.continue_()
        except Exception:
            try:
                route.continue_()
            except Exception:
                pass

    try:
        context.route("**/*", _handler)
    except Exception:
        pass


def prepare_navigation(url, identity=None):
    """Jalankan seluruh pemeriksaan pra-permintaan untuk jalur browser."""
    if not url or not isinstance(url, str):
        raise ValidationError("URL kosong atau bukan teks.")
    try:
        validate_url(url)
    except ValueError as exc:
        raise ValidationError(str(exc), url=url)

    domain = net_policy.domain_of(url)
    policy = net_policy.policy_for(domain)
    user_agent = identity_profile(identity or policy.get("identity"))["User-Agent"]

    net_policy.assert_circuit_closed(domain)
    net_policy.check_robots(url, user_agent)
    net_policy.wait_turn(domain, min_interval=net_policy.effective_interval(url, user_agent))
    return user_agent


def navigate(page, url, wait_until="domcontentloaded", timeout=None):
    """page.goto() dengan error yang sudah diterjemahkan ke taksonomi kita.

    Sebelumnya kegagalan navigasi ditelan `except Exception: pass`, sehingga
    halaman blokir dan selector salah tidak bisa dibedakan.
    """
    timeout = int(timeout or BROWSER_TIMEOUT_MS)
    try:
        return page.goto(url, wait_until=wait_until, timeout=timeout)
    except Exception as exc:  # playwright melempar tipe khusus modulnya sendiri
        raise wrap_browser_error(url, exc)


def wrap_browser_error(url, exc):
    message = str(exc)
    lowered = message.lower()
    domain = net_policy.domain_of(url)
    if "timeout" in lowered:
        return FetchTimeoutError(
            "Browser kehabisan waktu saat memuat %s." % domain, url=url)
    if "net::err_proxy" in lowered or "err_tunnel_connection_failed" in lowered \
            or "err_proxy_auth_requested" in lowered:
        return ProxyConfigError(
            "Proxy keluar %s menolak permintaan browser (%s)."
            % (proxy_endpoint() or "yang dikonfigurasi", _scrub_proxy_credentials(message)), url=url)
    if "net::err_name_not_resolved" in lowered or "net::err_connection" in lowered \
            or "net::err_cert" in lowered:
        return NetworkError("Browser gagal terhubung ke %s: %s" % (domain, message), url=url)
    if "net::err_aborted" in lowered or "net::err_failed" in lowered:
        return NetworkError("Permintaan browser ke %s dibatalkan: %s" % (domain, message), url=url)
    from scraper_errors import BrowserError
    return BrowserError("Browser gagal memuat %s: %s" % (domain, message), url=url)


def assess_navigation(url, response, html):
    """Nilai hasil navigasi browser dengan aturan yang sama seperti jalur requests."""
    domain = net_policy.domain_of(url)
    status = None
    headers = {}
    if response is not None:
        try:
            status = response.status
            headers = dict(response.headers or {})
        except Exception:
            status, headers = None, {}
    try:
        classify_raw(url, status, headers, html or "")
    except ScraperError as exc:
        if exc.counts_against_domain:
            net_policy.record_outcome(domain, False, cooldown_hint=exc.retry_after)
        raise
    net_policy.record_outcome(domain, True)
    return status


CHALLENGE_WAIT_MS = int(os.environ.get("SCRAPER_CHALLENGE_WAIT_MS", "") or 8000)


def _page_html(page):
    try:
        return page.content()
    except Exception:
        return ""


def settle_page(page, url, response, poll_ms=1000):
    """Ambil HTML final halaman lalu nilai hasilnya.

    Bila yang dimuat ternyata halaman verifikasi JavaScript non-interaktif, browser
    diberi kesempatan menyelesaikannya sendiri sampai batas waktu. Ini bukan upaya
    menembus perlindungan -- tidak ada CAPTCHA yang dipecahkan dan tidak ada sidik
    jari yang dipalsukan; kita hanya membiarkan mesin JavaScript berjalan normal.
    Bila setelah batas waktu halaman masih berupa verifikasi, kegagalan dilaporkan
    apa adanya sebagai CHALLENGE_DETECTED.

    Mengembalikan pasangan (status_http, html).
    """
    html = _page_html(page)
    if detect_challenge(None, None, html) is None:
        return assess_navigation(url, response, html), html

    deadline = time.monotonic() + (CHALLENGE_WAIT_MS / 1000.0)
    while time.monotonic() < deadline:
        try:
            page.wait_for_timeout(poll_ms)
        except Exception:
            break
        html = _page_html(page)
        if detect_challenge(None, None, html) is None:
            # Verifikasi selesai sendiri; status respons awal sudah tidak relevan.
            net_policy.record_outcome(net_policy.domain_of(url), True)
            return None, html

    assess_navigation(url, response, html)
    return None, html
