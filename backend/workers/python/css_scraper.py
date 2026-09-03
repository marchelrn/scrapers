"""
Teknik ekstraksi CSS selector untuk metode target_url (browser sungguhan).

Ini teknik yang paling banyak dipakai operator non-teknis karena selector-nya
dihasilkan oleh Visual Selector di frontend. Karena itu dua hal diprioritaskan:

1. Semua akses jaringan tunduk pada kebijakan di fetcher.py (robots.txt, jeda
   antar-permintaan, deteksi halaman verifikasi, circuit breaker).
2. Kegagalan TIDAK pernah ditelan diam-diam. Versi sebelumnya menutup seluruh
   blok dengan `except Exception: pass` sehingga "situs memblokir kita" dan
   "selector saya salah" sama-sama muncul sebagai hasil kosong.
"""

import os
import re
import urllib.parse

from playwright.sync_api import sync_playwright

import fetcher
import net_policy
from scraper_errors import EmptyResultError, ScraperError, SelectorNotFoundError, ValidationError

SELECTOR_TIMEOUT_MS = int(os.environ.get("SCRAPER_SELECTOR_TIMEOUT_MS", "") or 15000)


# --- Pembersihan & pelonggaran selector ----------------------------------
#
# Visual Selector menghasilkan selector panjang seperti
#
#   div:nth-of-type(1) > div.md\:mt-4:nth-of-type(1)
#     > div.wrap__article-detail-content:nth-of-type(4) > p:nth-of-type(1)
#
# yang perlu dibersihkan dari class utility sebelum dipakai. Versi sebelumnya
# membersihkannya dengan regex `\.([\w-]+):([\w-]+)` yang dimaksudkan untuk class
# bertitik dua (mis. `.md:mt-4`) -- tetapi pola itu juga cocok dengan
# `.class:nth-of-type`, sehingga nama pseudo-class-nya ikut terhapus dan hanya
# menyisakan kelompok tanpa induk: `div.wrap__article-detail-content(4)`.
# Selector seperti itu bukan CSS yang valid, Playwright menolaknya, dan seluruh
# pencarian jatuh ke tag dasar `div` -- itulah sebab peringatan "hasil diambil
# dari tag dasar ... lebih longgar dari yang diinginkan" yang dilaporkan operator
# padahal ia sudah memilih paragraf secara spesifik.
#
# Pembersih di bawah bekerja per token, bukan dengan penghapusan substring, jadi
# pseudo-class tidak mungkin lagi rusak. Ia juga memulihkan selector lama yang
# sudah tersimpan dalam keadaan rusak di basis data: kelompok `(N)` yatim
# dikembalikan menjadi `:nth-of-type(N)`, sehingga konfigurasi yang sudah ada
# ikut berfungsi tanpa harus dipilih ulang lewat Visual Selector.

_TOKEN_RE = re.compile(
    r"""
      (?P<id>\#(?:[A-Za-z0-9_-]|\\.)+)
    | (?P<cls>\.(?:[A-Za-z0-9_-]|\\.)+)
    | (?P<pseudo>::?[A-Za-z-]+(?:\([^()]*\))?)
    | (?P<attr>\[[^\]]*\])
    | (?P<orphan>\([^()]*\))
    | (?P<tag>\*|[A-Za-z][A-Za-z0-9_-]*)
    | (?P<junk>\S)
    """,
    re.VERBOSE,
)

# Class utility yang tidak menjelaskan APA isi elemen, hanya bagaimana ia
# ditampilkan. Menyertakannya membuat selector rapuh terhadap perubahan tata
# letak, jadi dibuang -- kecuali bila membuangnya menyisakan tag telanjang.
_UTILITY_RE = re.compile(
    r"^(?:mt|mb|ml|mr|p|pt|pb|pl|pr|w|h|mx|my|px|py|rounded|text|bg|flex|grid"
    r"|border|items|justify|gap|z|font|col|row|order|leading|tracking|shadow"
    r"|opacity|space)-[A-Za-z0-9_./-]+$"
)

_POSITION_PSEUDO_RE = re.compile(
    r":nth-(?:of-type|child|last-of-type|last-child)\([^()]*\)"
    r"|:(?:first|last|only)-(?:of-type|child)"
)

_COMBINATORS = (">", "+", "~")


def _class_is_noise(name):
    if name.startswith("bps-picker"):
        return True
    # Class Tailwind responsif ikut terbawa sebagai `.md\:mt-4`; titik dua di
    # dalamnya membuat selector rapuh dan isinya selalu utility.
    if ":" in name or "\\" in name:
        return True
    return bool(_UTILITY_RE.match(name))


def _clean_compound(compound):
    """Bersihkan satu compound selector (mis. `div.a.b:nth-of-type(3)`).

    Class disaring per token; id, atribut, dan pseudo-class SELALU dipertahankan.
    """
    kept = []
    dropped = []
    has_anchor = False

    for match in _TOKEN_RE.finditer(compound):
        kind = match.lastgroup
        text = match.group()
        if kind == "cls":
            if _class_is_noise(text[1:]):
                dropped.append(text)
            else:
                kept.append(text)
                has_anchor = True
        elif kind == "orphan":
            # Sisa kerusakan pembersih lama: `div(4)` seharusnya
            # `div:nth-of-type(4)`.
            inner = text[1:-1].strip()
            if inner.isdigit() or inner in ("odd", "even"):
                kept.append(":nth-of-type(%s)" % inner)
                has_anchor = True
        elif kind == "junk":
            continue
        elif kind in ("id", "attr", "pseudo"):
            kept.append(text)
            has_anchor = True
        else:
            kept.append(text)

    if not has_anchor and dropped:
        # Satu class utility masih jauh lebih presisi daripada tag telanjang.
        kept.append(dropped[0])
    return "".join(kept)


def _clean_sub_selector(sub):
    pieces = [piece for piece in re.split(r"\s*([>+~])\s*|\s+", sub) if piece]
    out = []
    for piece in pieces:
        if piece in _COMBINATORS:
            if out and out[-1] not in _COMBINATORS:
                out.append(piece)
            continue
        compound = _clean_compound(piece)
        if compound:
            out.append(compound)
        elif out and out[-1] in _COMBINATORS:
            out.pop()
    while out and out[-1] in _COMBINATORS:
        out.pop()
    return " ".join(out)


def _dedupe(values):
    seen = set()
    unique = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            unique.append(value)
    return unique


def clean_selector(selector: str) -> str:
    """Selector dari Visual Selector -> CSS yang valid dan tidak berlebihan.

    Class utility dibuang, pseudo-class dipertahankan utuh, dan sub-selector
    kembar digabung. Bila hasilnya kosong, "body" dipakai agar galat yang muncul
    kemudian adalah EMPTY_RESULT yang jelas, bukan exception dari Playwright.
    """
    if not selector:
        return "body"
    subs = _dedupe(_clean_sub_selector(sub) for sub in selector.split(",") if sub.strip())
    return ", ".join(subs) if subs else "body"


def _base_tag(selector):
    """Tag dasar dari selector, dipakai sebagai jaring pengaman terakhir."""
    first = selector.split(",")[0].strip()
    match = re.match(r"^([a-zA-Z][a-zA-Z0-9_-]*)", first)
    return match.group(1) if match else ""


def _drop_positions(selector):
    """Buang penomoran posisi, pertahankan class dan tag.

    Ini pelonggaran yang paling sering menyelamatkan hasil: operator memilih lima
    paragraf berurutan, lalu situs menambah satu elemen di atasnya dan semua
    nomor posisi bergeser. Tanpa nomor, kelima sub-selector runtuh menjadi satu
    `div.wrap__article-detail-content > p` yang justru merupakan maksud aslinya.
    """
    subs = []
    for sub in selector.split(","):
        cleaned = _clean_sub_selector(_POSITION_PSEUDO_RE.sub("", sub))
        if cleaned:
            subs.append(cleaned)
    return ", ".join(_dedupe(subs))


def _anchor_only(selector):
    """Pertahankan hanya compound terakhir yang punya id/class, plus turunannya.

    Rantai `div > div > div.isi-artikel > p` menjadi `div.isi-artikel p`: jangkar
    yang bermakna tetap ada, tetapi posisi persis di dalam pohon dokumen tidak
    lagi diikat.
    """
    subs = []
    for sub in selector.split(","):
        pieces = [p for p in _clean_sub_selector(sub).split(" ") if p and p not in _COMBINATORS]
        anchor_at = -1
        for index, piece in enumerate(pieces):
            if "." in piece or "#" in piece or "[" in piece:
                anchor_at = index
        if anchor_at < 0:
            continue
        tail = [_POSITION_PSEUDO_RE.sub("", piece) for piece in pieces[anchor_at:]]
        candidate = " ".join(piece for piece in tail if piece)
        if candidate:
            subs.append(candidate)
    return ", ".join(_dedupe(subs))


def selector_ladder(selector):
    """Urutan percobaan: dari yang paling presisi ke yang paling longgar.

    Sebelumnya hanya ada dua tingkat -- selector utuh, lalu langsung tag dasar
    (`div`), yang praktis berarti "ambil seluruh halaman". Dua tingkat di
    antaranya menjaga hasil tetap relevan ketika struktur halaman bergeser
    sedikit, dan itulah kasus yang paling sering terjadi.
    """
    ladder = []
    for candidate, reason in (
        (_drop_positions(selector),
         "penomoran posisi (:nth-of-type) diabaikan karena struktur halaman bergeser"),
        (_anchor_only(selector),
         "hanya class penanda yang dipakai, jalur lengkap dari atas halaman diabaikan"),
        (_base_tag(selector),
         "hanya tag dasar yang dipakai sehingga hasilnya jauh lebih longgar dari yang dipilih"),
    ):
        if candidate and candidate != selector and all(candidate != item[0] for item in ladder):
            ladder.append((candidate, reason))
    return ladder


def _try_selector(page, selector, timeout_ms):
    try:
        page.wait_for_selector(selector, timeout=timeout_ms, state="attached")
        return page.query_selector_all(selector)
    except Exception:
        # Selector tidak valid maupun tidak ditemukan sama-sama berakhir di sini;
        # keduanya berarti "coba tingkat berikutnya".
        return []


def _locate(page, selector, url):
    """Cari elemen target menuruni tangga pelonggaran; laporkan tingkat yang dipakai.

    Setiap pelonggaran dicatat sebagai peringatan beserta alasannya, sehingga
    operator tahu hasil yang ia lihat lebih longgar dari yang ia pilih -- dan tahu
    apa yang perlu diperbaiki.
    """
    elements = _try_selector(page, selector, SELECTOR_TIMEOUT_MS)
    if elements:
        return elements, selector

    for candidate, reason in selector_ladder(selector):
        elements = _try_selector(page, candidate, 5000)
        if not elements:
            continue
        net_policy.add_warning(
            "Selector '%s' tidak menemukan elemen apa pun, sehingga dilonggarkan menjadi "
            "'%s' (%s). Hasil ini kemungkinan tidak seketat pilihan Anda; bila isinya "
            "tidak sesuai, pilih ulang elemen lewat Visual Selector."
            % (selector, candidate, reason),
            key="selector-relaxed:%s" % candidate)
        return elements, candidate

    raise SelectorNotFoundError(
        "Halaman berhasil dimuat, tetapi tidak ada elemen yang cocok dengan selector "
        "'%s', termasuk setelah selector dilonggarkan. Struktur halaman kemungkinan "
        "sudah berubah -- pilih ulang elemen lewat Visual Selector." % selector, url=url)


def scrape(config_params):
    url = (config_params.get("url") or "").strip()
    raw_selector = config_params.get("selector") or ""

    if not url:
        raise ValidationError("Parameter 'url' wajib diisi.")
    if not raw_selector:
        raise ValidationError("Parameter 'selector' wajib diisi.")

    # Bersihkan sisa kutip dan URL-encoding yang bisa terbawa dari Visual Selector.
    raw_selector = urllib.parse.unquote(raw_selector.strip(' "\''))
    selector = clean_selector(raw_selector)

    # Validasi URL, robots.txt, circuit breaker, dan jeda antar-permintaan.
    fetcher.prepare_navigation(url)

    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**fetcher.browser_launch_options(url))
        try:
            context = browser.new_context(**fetcher.browser_context_options(url))
            fetcher.install_asset_blocking(context)
            page = context.new_page()

            response = fetcher.navigate(page, url, wait_until="domcontentloaded")
            # Melempar CHALLENGE_DETECTED / BLOCKED_403 / dsb bila yang dimuat
            # ternyata halaman verifikasi atau halaman penolakan.
            fetcher.settle_page(page, url, response)

            elements, used_selector = _locate(page, selector, url)

            seen = set()
            for element in elements:
                try:
                    text = (element.inner_text() or "").strip()
                except Exception:
                    continue
                if text and text not in seen:
                    seen.add(text)
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
            "Elemen '%s' ditemukan pada halaman, tetapi seluruh isinya kosong." % selector,
            url=url)

    return results
