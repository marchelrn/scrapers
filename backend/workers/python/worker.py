"""
Titik masuk tunggal yang dipanggil backend Go untuk setiap job scraping.

Tugasnya: memilih modul teknik yang tepat, menjalankannya, lalu mencetak SATU
objek JSON sesuai output contract (dto.WorkerResult) ke stdout.

Perubahan penting: kegagalan tidak lagi dilaporkan sebagai satu kode generik.
Setiap turunan ScraperError membawa kode dan saran tindakan berbahasa Indonesia,
sehingga operator divisi dapat membedakan "selector saya salah" dari "situs
targetnya menolak sistem ini". Lihat scraper_errors.py.
"""

import datetime
import importlib
import json
import sys

import net_policy
from scraper_errors import ScraperError
from url_validator import validate_url

# Pemetaan nama berkas yang dikirim backend ke nama modul Python.
# Sistem ini hanya mendukung dua metode scraping: target_url dan google_news.
SCRAPER_MODULES = {
    # teknik-teknik dari metode target_url
    "css_scraper.py": "css_scraper",
    "xpath_scraper.py": "xpath_scraper",
    "regex_scraper.py": "regex_scraper",
    "api_scraper.py": "api_scraper",
    "headless_scraper.py": "headless_scraper",
    "keyword_scraper.py": "keyword_scraper",
    # metode google_news
    "google_news_scraper.py": "google_news_scraper",
}

# Metode yang dilaporkan pada output contract, per berkas scraper.
GOOGLE_NEWS_FILES = ["google_news_scraper.py"]

MAX_WARNINGS = 20


def resolve_method_code(python_file):
    return "google_news" if python_file in GOOGLE_NEWS_FILES else "target_url"


def resolve_source(python_file, target_url):
    if target_url:
        return target_url
    return resolve_method_code(python_file)


def _now_iso():
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z")


def _emit(payload):
    # ensure_ascii=False agar pesan berbahasa Indonesia tetap terbaca di UI.
    print(json.dumps(payload, ensure_ascii=False))


def _metadata(source, item_count):
    metadata = {
        "source": source,
        "fetched_at": _now_iso(),
        "item_count": item_count,
    }
    warnings = net_policy.warnings_log()
    if warnings:
        metadata["warnings"] = warnings[:MAX_WARNINGS]
    return metadata


def _fail(method_code, source, code, message):
    _emit({
        "status": "failed",
        "method": method_code,
        "results": [],
        "metadata": _metadata(source, 0),
        "error": {
            "code": code,
            "message": message,
        },
    })
    sys.exit(1)


def execute_job(python_file, config_params):
    method_code = resolve_method_code(python_file)
    target_url = config_params.get("url", "") or ""
    source = resolve_source(python_file, target_url)

    module_name = SCRAPER_MODULES.get(python_file)
    if not module_name:
        _fail(method_code, source, "VALIDATION_ERROR",
              "Teknik scraping '%s' tidak dikenali oleh worker." % python_file)

    try:
        # Penjaga SSRF: dijalankan sebelum permintaan jaringan apa pun. fetcher.py
        # memvalidasi ulang termasuk seluruh rantai redirect.
        if target_url:
            validate_url(target_url)

        scraper_module = importlib.import_module(module_name)
        results = scraper_module.scrape(config_params)

        if isinstance(results, list):
            item_count = len(results)
        elif results is None:
            results, item_count = [], 0
        else:
            results, item_count = [results], 1

        _emit({
            "status": "success",
            "method": method_code,
            "results": results,
            "metadata": _metadata(source, item_count),
            "error": None,
        })

    except ScraperError as exc:
        # Kegagalan yang sudah terklasifikasi: kode dan sarannya langsung dipakai.
        _fail(method_code, source, exc.code, exc.public_message())
    except ValueError as exc:
        # Validasi URL dan parameter warisan masih memakai ValueError.
        _fail(method_code, source, "VALIDATION_ERROR", str(exc))
    except ImportError as exc:
        _fail(method_code, source, "EXECUTION_ERROR",
              "Modul scraper '%s' tidak dapat dimuat: %s" % (module_name, exc))
    except Exception as exc:
        _fail(method_code, source, "EXECUTION_ERROR",
              "%s: %s" % (type(exc).__name__, exc))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python worker.py <python_file> '<json_config_params>'")
        sys.exit(1)

    p_file = sys.argv[1]
    params_str = sys.argv[2]

    try:
        params = json.loads(params_str)
    except json.JSONDecodeError:
        _emit({
            "status": "failed",
            "method": resolve_method_code(p_file),
            "results": [],
            "metadata": {"source": "", "fetched_at": _now_iso(), "item_count": 0},
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "Parameter konfigurasi bukan JSON yang valid.",
            },
        })
        sys.exit(1)

    execute_job(p_file, params)
