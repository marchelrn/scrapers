"""
Teknik headless browser untuk metode target_url.

Bedanya dengan teknik 'css': teknik ini menunggu jaringan tenang (networkidle),
sehingga cocok untuk halaman yang seluruh isinya dirender JavaScript.

Seluruh kebijakan jaringan (robots.txt, jeda per domain, deteksi halaman
verifikasi, circuit breaker) diwarisi dari fetcher.py.
"""

import os
import re

from playwright.sync_api import sync_playwright

import fetcher
import net_policy
from scraper_errors import (
    EmptyResultError,
    ScraperError,
    SelectorNotFoundError,
    ValidationError,
)

SELECTOR_TIMEOUT_MS = int(os.environ.get("SCRAPER_SELECTOR_TIMEOUT_MS", "") or 15000)


def _escape_css_identifiers(selector):
    """Escape karakter `:`/`[`/`]` dan digit awal pada nama class/id.

    Diperlukan karena selector dari Visual Selector sering memuat class Tailwind
    seperti `.md:ml-4` yang tidak valid sebagai CSS mentah.
    """
    def _escape(match):
        token = match.group(0)
        prefix, identifier = token[0], token[1:]
        escaped = identifier.replace(':', '\\:').replace('[', '\\[').replace(']', '\\]')
        if re.match(r'^[0-9]', escaped):
            escaped = '\\3' + escaped[0] + ' ' + escaped[1:]
        return prefix + escaped

    return re.sub(r'[\.\#][a-zA-Z0-9_\-\:\[\]]+', _escape, selector)


def _locate(page, escaped_selector, original_selector, url):
    try:
        page.wait_for_selector(escaped_selector, timeout=SELECTOR_TIMEOUT_MS, state="attached")
        elements = page.query_selector_all(escaped_selector)
        if elements:
            return elements
    except Exception:
        pass

    # Jaring pengaman: pakai nama tag terakhir pada selector.
    match = re.search(r'([a-zA-Z][a-zA-Z0-9_-]*)(?:\.[a-zA-Z0-9_\-\:\[\]]+)*$', original_selector)
    if match:
        base = match.group(1)
        try:
            page.wait_for_selector(base, timeout=5000, state="attached")
            elements = page.query_selector_all(base)
        except Exception:
            elements = []
        if elements:
            net_policy.add_warning(
                "Selector '%s' tidak ditemukan; hasil diambil dari tag dasar '%s'."
                % (original_selector, base))
            return elements

    raise SelectorNotFoundError(
        "Halaman berhasil dimuat, tetapi tidak ada elemen yang cocok dengan selector "
        "'%s'." % original_selector, url=url)


def scrape(config_params):
    url = (config_params.get("url") or "").strip()
    selector = (config_params.get("selector") or "").strip()

    if not url:
        raise ValidationError("Parameter 'url' wajib diisi.")
    if not selector:
        raise ValidationError("Parameter 'selector' wajib diisi.")

    fetcher.prepare_navigation(url)

    escaped_selector = _escape_css_identifiers(selector)
    results = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**fetcher.browser_launch_options(url))
        try:
            context = browser.new_context(**fetcher.browser_context_options(url))
            fetcher.install_asset_blocking(context)
            page = context.new_page()

            response = fetcher.navigate(page, url, wait_until="networkidle")
            fetcher.settle_page(page, url, response)

            for element in _locate(page, escaped_selector, selector, url):
                try:
                    text = (element.inner_text() or "").strip()
                except Exception:
                    continue
                if text:
                    results.append(text)
        except ScraperError:
            raise
        except Exception as exc:
            raise fetcher.wrap_browser_error(url, exc)
        finally:
            try:
                browser.close()
            except Exception:
                pass

    if not results:
        raise EmptyResultError(
            "Elemen '%s' ditemukan, tetapi seluruh isinya kosong." % selector, url=url)

    return results
