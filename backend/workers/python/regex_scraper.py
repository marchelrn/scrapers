"""
Teknik ekstraksi Regular Expression untuk metode target_url.

Akses jaringan sepenuhnya didelegasikan ke fetcher.py.
"""

import os
import re

import fetcher
from scraper_errors import EmptyResultError, SelectorNotFoundError, ValidationError

# Batas wajar agar pola yang keliru tidak menghasilkan jutaan baris hasil.
MAX_MATCHES = int(os.environ.get("SCRAPER_MAX_REGEX_MATCHES", "") or 5000)


def scrape(config_params):
    url = (config_params.get("url") or "").strip()
    pattern = config_params.get("pattern") or ""

    if not url:
        raise ValidationError("Parameter 'url' wajib diisi.")
    if not pattern:
        raise ValidationError("Parameter 'pattern' wajib diisi.")

    try:
        compiled = re.compile(pattern)
    except re.error as exc:
        raise ValidationError("Pola regex tidak valid: %s" % exc, url=url)

    response = fetcher.fetch(url, expect="html")
    matches = compiled.findall(response.text)

    if not matches:
        raise SelectorNotFoundError(
            "Halaman berhasil diambil (HTTP %d), tetapi pola regex tidak menemukan "
            "kecocokan." % response.status_code, url=url)

    results = []
    for match in matches[:MAX_MATCHES]:
        if isinstance(match, tuple):
            text = " ".join(part for part in match if part).strip()
        else:
            text = str(match).strip()
        if text:
            results.append(text)

    if not results:
        raise EmptyResultError(
            "Pola regex cocok %d kali, tetapi seluruh hasilnya kosong." % len(matches),
            url=url)

    return results
