import os
import re
from playwright.sync_api import sync_playwright

def scrape(config_params):
    url = config_params.get("url")
    keyword = config_params.get("keyword")

    if not url or not keyword:
        raise ValueError("Missing 'url' or 'keyword' in config parameters")

    proxies = None
    http_proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
    if http_proxy:
        proxies = {"server": http_proxy}

    results = []

    with sync_playwright() as p:
        launch_options = {"headless": True}
        if proxies:
            launch_options["proxy"] = proxies

        browser = p.chromium.launch(**launch_options)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = context.new_page()

        # PERBAIKAN 1: Gunakan 'load' yang lebih aman dengan timeout secukupnya, silent exception bila timeout
        try:
            page.goto(url, wait_until="load", timeout=20000)
        except Exception:
            pass

        # PERBAIKAN 2: Beri jeda agar JavaScript selesai merender komponen
        page.wait_for_timeout(3000)

        # OPSI 1: Multi-kata AND Logic (Fleksibel Multi-Kata)
        # Pisahkan keyword panjang menjadi array kata.
        words = [w.strip() for w in keyword.split() if w.strip()]
        seen_texts = set()
        
        if len(words) == 1:
            # Jika hanya 1 kata, gunakan pencarian regex standar dari Playwright
            pattern = re.compile(re.escape(words[0]), re.IGNORECASE)
            elements = page.get_by_text(pattern).all()
            for el in elements:
                try:
                    text = el.inner_text().strip()
                    if text and text not in seen_texts and len(text) < 2500:
                        results.append(text)
                        seen_texts.add(text)
                except Exception:
                    continue
        else:
            # Jika multi-kata, ambil SEMUA elemen yang berpotensi berisi teks (paragraf, div, li, td, dll)
            # lalu filter secara manual di python untuk memastikan sebuah elemen memuat SEMUA kata dari input
            # terlepas dari urutannya.
            
            # Buat list locator tag yang umum mengandung teks konten
            tags_to_check = page.locator("p, li, td, h1, h2, h3, h4, h5, h6, div.content, span.text, article").all()
            
            # Jika tag spesifik terlalu sedikit, fallback ambil semua div yang memuat teks (berisiko duplikasi tinggi 
            # tapi nanti diatasi di tahap filter specificity). Untuk optimasi, kita limit ke p dan struktur konten.
            if len(tags_to_check) < 5:
                tags_to_check = page.locator("div, p, span, li, td, a").all()
                
            for el in tags_to_check:
                try:
                    text = el.inner_text().strip()
                    if not text or len(text) > 2500:
                        continue
                        
                    # Pengecekan AND Logic: Apakah semua kata ada di dalam teks ini?
                    text_lower = text.lower()
                    contains_all = all(w.lower() in text_lower for w in words)
                    
                    if contains_all and text not in seen_texts:
                        results.append(text)
                        seen_texts.add(text)
                except Exception:
                    continue

        browser.close()

    # Saring teks yang paling spesifik (menghindari duplikasi parent container)
    final_results = [
        t for t in results
        if not any(t != other and t in other for other in results)
    ]

    return final_results

if __name__ == "__main__":
    print(scrape({"url": "https://www.bps.go.id/id", "keyword": "Lembaga"}))