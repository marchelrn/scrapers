"""
Teknik 'keyword_find' untuk metode target_url.

Teknik paling ramah bagi pengguna non-teknis: operator hanya mengisi URL dan kata
kunci, tanpa perlu tahu selector apa pun. Semua elemen teks pada halaman disaring
dengan logika AND -- sebuah elemen diambil bila memuat SEMUA kata kunci, tanpa
memedulikan urutannya.

Perbaikan penting dibanding versi sebelumnya:
  * proxy: versi lama mengirim URL proxy utuh sebagai `server`, sehingga proxy
    berkredensial selalu gagal. Sekarang memakai parser terpusat di fetcher.py.
  * kegagalan navigasi tidak lagi ditelan `except Exception: pass`.
  * halaman verifikasi bot terdeteksi dan dilaporkan, bukan dianggap "kosong".
"""

import os
import re

from playwright.sync_api import sync_playwright

import fetcher
from scraper_errors import EmptyResultError, ScraperError, ValidationError

RENDER_SETTLE_MS = int(os.environ.get("SCRAPER_RENDER_SETTLE_MS", "") or 2000)
MAX_TEXT_LENGTH = int(os.environ.get("SCRAPER_MAX_ELEMENT_TEXT", "") or 2500)

CONTENT_SELECTORS = "p, li, td, h1, h2, h3, h4, h5, h6, div.content, span.text, article"
FALLBACK_SELECTORS = "div, p, span, li, td, a"


def _collect_texts(page, selectors):
    texts = []
    try:
        elements = page.locator(selectors).all()
    except Exception:
        return texts
    for element in elements:
        try:
            text = (element.inner_text() or "").strip()
        except Exception:
            continue
        if text and len(text) <= MAX_TEXT_LENGTH:
            texts.append(text)
    return texts


def _matches_all_words(text, words):
    lowered = text.lower()
    return all(word in lowered for word in words)


def scrape(config_params):
    url = (config_params.get("url") or "").strip()
    keyword = (config_params.get("keyword") or "").strip()

    if not url:
        raise ValidationError("Parameter 'url' wajib diisi.")
    if not keyword:
        raise ValidationError("Parameter 'keyword' wajib diisi.")

    words = [w.lower() for w in keyword.split() if w.strip()]
    if not words:
        raise ValidationError("Parameter 'keyword' tidak memuat kata apa pun.")

    fetcher.prepare_navigation(url)

    matches = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**fetcher.browser_launch_options(url))
        try:
            context = browser.new_context(**fetcher.browser_context_options(url))
            fetcher.install_asset_blocking(context)
            page = context.new_page()

            response = fetcher.navigate(page, url, wait_until="domcontentloaded")
            fetcher.settle_page(page, url, response)

            # Beri jeda singkat agar komponen yang dirender JavaScript selesai muncul.
            try:
                page.wait_for_timeout(RENDER_SETTLE_MS)
            except Exception:
                pass

            if len(words) == 1:
                pattern = re.compile(re.escape(words[0]), re.IGNORECASE)
                try:
                    elements = page.get_by_text(pattern).all()
                except Exception:
                    elements = []
                candidates = []
                for element in elements:
                    try:
                        text = (element.inner_text() or "").strip()
                    except Exception:
                        continue
                    if text and len(text) <= MAX_TEXT_LENGTH:
                        candidates.append(text)
            else:
                candidates = _collect_texts(page, CONTENT_SELECTORS)
                if len(candidates) < 5:
                    candidates = _collect_texts(page, FALLBACK_SELECTORS)
                candidates = [t for t in candidates if _matches_all_words(t, words)]

            seen = set()
            for text in candidates:
                if text not in seen:
                    seen.add(text)
                    matches.append(text)
        except ScraperError:
            raise
        except Exception as exc:
            raise fetcher.wrap_browser_error(url, exc)
        finally:
            try:
                browser.close()
            except Exception:
                pass

    # Buang teks kontainer induk yang hanya membungkus teks yang lebih spesifik.
    results = [t for t in matches if not any(t != other and t in other for other in matches)]

    if not results:
        raise EmptyResultError(
            "Halaman berhasil dimuat, tetapi tidak ada elemen yang memuat semua kata "
            "kunci '%s'." % keyword, url=url)

    return results
