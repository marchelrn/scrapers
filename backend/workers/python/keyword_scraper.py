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

        # PERBAIKAN 1: Gunakan 'domcontentloaded' agar tidak tertahan oleh WebSocket/Polling
        page.goto(url, wait_until="domcontentloaded", timeout=15000)

        # PERBAIKAN 2: Beri jeda singkat agar JavaScript (React/Next.js) selesai merender komponen
        page.wait_for_timeout(2000)

        pattern = re.compile(re.escape(keyword), re.IGNORECASE)
        elements = page.get_by_text(pattern).all()

        seen_texts = set()
        for el in elements:
            try:
                text = el.inner_text().strip()
                if text and text not in seen_texts and len(text) < 1500:
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