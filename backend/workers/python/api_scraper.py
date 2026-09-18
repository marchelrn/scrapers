"""
Teknik pemanggilan API/JSON untuk metode target_url.

Akses jaringan lewat fetcher.py, sehingga seluruh kebijakan kesopanan
(robots.txt, jeda per domain, cache, circuit breaker) berlaku sama seperti
teknik lain.
"""

import fetcher
from scraper_errors import ContentTypeError, EmptyResultError, ValidationError

ALLOWED_METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD")


def scrape(config_params):
    url = (config_params.get("url") or "").strip()
    method = (config_params.get("method") or "GET").upper()
    json_path = (config_params.get("json_path") or "").strip()

    if not url:
        raise ValidationError("Parameter 'url' wajib diisi.")
    if method not in ALLOWED_METHODS:
        raise ValidationError("Metode HTTP '%s' tidak didukung." % method)

    headers = config_params.get("headers") or {}
    if not isinstance(headers, dict):
        raise ValidationError("Parameter 'headers' harus berupa objek key-value.")
    headers = dict(headers)

    if not any(k.lower() == "accept" for k in headers):
        headers["Accept"] = "application/json, text/plain, */*"

    response = fetcher.fetch(
        url,
        method=method,
        headers=headers,
        expect="json",
    )

    data = response.json()

    if json_path:
        current = data
        # Mendukung jalur bersarang sederhana, mis. "data.items".
        for segment in [s for s in json_path.split(".") if s]:
            if isinstance(current, dict) and segment in current:
                current = current[segment]
            else:
                raise ContentTypeError(
                    "json_path '%s' tidak ditemukan pada respons API." % json_path, url=url)
        data = current

    if isinstance(data, list):
        results = data
    elif data is None:
        results = []
    else:
        results = [data]

    if not results:
        raise EmptyResultError("API merespons dengan sukses tetapi tanpa data.", url=url)

    return results
