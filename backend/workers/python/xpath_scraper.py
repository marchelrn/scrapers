"""
Teknik ekstraksi XPath untuk metode target_url.

Seluruh akses jaringan disalurkan lewat fetcher.py sehingga jeda antar-permintaan,
robots.txt, cache bersyarat, dan deteksi halaman blokir berlaku otomatis. Modul ini
hanya bertanggung jawab pada penguraian dokumen.
"""

from lxml import etree
from lxml import html as lxml_html

import fetcher
from scraper_errors import ContentTypeError, EmptyResultError, SelectorNotFoundError, ValidationError


def scrape(config_params):
    url = (config_params.get("url") or "").strip()
    xpath = (config_params.get("xpath") or "").strip()

    if not url:
        raise ValidationError("Parameter 'url' wajib diisi.")
    if not xpath:
        raise ValidationError("Parameter 'xpath' wajib diisi.")

    response = fetcher.fetch(url, expect="html")

    try:
        tree = lxml_html.fromstring(response.content)
    except (etree.ParserError, etree.XMLSyntaxError, ValueError) as exc:
        raise ContentTypeError(
            "Isi halaman tidak dapat diuraikan sebagai HTML: %s" % exc, url=url)

    try:
        elements = tree.xpath(xpath)
    except etree.XPathError as exc:
        raise ValidationError("Ekspresi XPath tidak valid: %s" % exc, url=url)

    if not elements:
        raise SelectorNotFoundError(
            "Halaman berhasil diambil (HTTP %d), tetapi XPath '%s' tidak cocok dengan "
            "elemen mana pun." % (response.status_code, xpath), url=url)

    results = []
    for element in elements:
        if isinstance(element, str):
            text = element.strip()
        elif hasattr(element, "text_content"):
            text = element.text_content().strip()
        else:
            text = str(element).strip()
        if text:
            results.append(text)

    if not results:
        raise EmptyResultError(
            "XPath '%s' cocok dengan %d elemen, tetapi semuanya kosong."
            % (xpath, len(elements)), url=url)

    return results
