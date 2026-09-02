"""
Cache HTTP dengan permintaan bersyarat (ETag / If-Modified-Since).

Ini praktik paling langsung untuk "tidak ditolak situs target": banyak halaman
fenomena (indeks berita, halaman harga, siaran pers) hanya berubah sekali sehari,
sedangkan penjadwal bisa menariknya jauh lebih sering. Dengan mengirim ETag /
If-Modified-Since, situs dapat menjawab `304 Not Modified` -- nol byte badan
respons, beban server mereka mendekati nol, dan kita tidak pernah terlihat
seperti pengunjung yang mengunduh ulang halaman yang sama berkali-kali.

Cache disimpan sebagai berkas agar tetap hidup lintas proses job.
"""

import hashlib
import json
import os
import time

import net_policy


def _env_bool(name, default):
    raw = os.environ.get(name, "").strip().lower()
    if not raw:
        return default
    return raw in ("1", "true", "yes", "on")


ENABLED = _env_bool("SCRAPER_HTTP_CACHE", True)
MAX_BODY_BYTES = int(os.environ.get("SCRAPER_HTTP_CACHE_MAX_BYTES", "") or 2 * 1024 * 1024)
TTL_SECONDS = float(os.environ.get("SCRAPER_HTTP_CACHE_TTL_SECONDS", "") or 7 * 24 * 3600)


def _key(url, method="GET"):
    return hashlib.sha256(("%s %s" % (method.upper(), url)).encode("utf-8")).hexdigest()


def _paths(url, method="GET"):
    base = net_policy.state_dir("httpcache")
    key = _key(url, method)
    return os.path.join(base, key + ".json"), os.path.join(base, key + ".body")


def lookup(url, method="GET"):
    """Entri cache yang masih berlaku, atau None."""
    if not ENABLED or method.upper() != "GET":
        return None
    meta_path, body_path = _paths(url, method)
    try:
        with open(meta_path, "r", encoding="utf-8") as fh:
            meta = json.load(fh)
    except (OSError, ValueError):
        return None
    if not isinstance(meta, dict):
        return None
    if time.time() - float(meta.get("stored_at") or 0.0) > TTL_SECONDS:
        return None
    try:
        with open(body_path, "rb") as fh:
            meta["content"] = fh.read()
    except OSError:
        return None
    return meta


def conditional_headers(entry):
    """Header validator agar situs bisa menjawab 304 alih-alih mengirim ulang."""
    headers = {}
    if not entry:
        return headers
    if entry.get("etag"):
        headers["If-None-Match"] = entry["etag"]
    if entry.get("last_modified"):
        headers["If-Modified-Since"] = entry["last_modified"]
    return headers


def store(url, status, headers, content, method="GET"):
    """Simpan respons 200 yang punya validator. Tanpa validator, cache tidak
    berguna untuk permintaan bersyarat, jadi tidak disimpan."""
    if not ENABLED or method.upper() != "GET" or status != 200:
        return False
    if content is None or len(content) > MAX_BODY_BYTES:
        return False

    lower = {str(k).lower(): v for k, v in (headers or {}).items()}
    etag = lower.get("etag")
    last_modified = lower.get("last-modified")
    if not etag and not last_modified:
        return False

    meta_path, body_path = _paths(url, method)
    meta = {
        "url": url,
        "etag": etag,
        "last_modified": last_modified,
        "content_type": lower.get("content-type", ""),
        "stored_at": time.time(),
        "status": status,
    }
    try:
        with open(body_path + ".tmp", "wb") as fh:
            fh.write(content)
        os.replace(body_path + ".tmp", body_path)
        with open(meta_path + ".tmp", "w", encoding="utf-8") as fh:
            json.dump(meta, fh)
        os.replace(meta_path + ".tmp", meta_path)
    except OSError:
        return False
    return True


def refresh(url, headers, method="GET"):
    """Setelah 304, perbarui validator dan waktu simpan tanpa menulis ulang badan."""
    if not ENABLED:
        return False
    meta_path, _ = _paths(url, method)
    try:
        with open(meta_path, "r", encoding="utf-8") as fh:
            meta = json.load(fh)
    except (OSError, ValueError):
        return False
    lower = {str(k).lower(): v for k, v in (headers or {}).items()}
    if lower.get("etag"):
        meta["etag"] = lower["etag"]
    if lower.get("last-modified"):
        meta["last_modified"] = lower["last-modified"]
    meta["stored_at"] = time.time()
    try:
        with open(meta_path + ".tmp", "w", encoding="utf-8") as fh:
            json.dump(meta, fh)
        os.replace(meta_path + ".tmp", meta_path)
    except OSError:
        return False
    return True
