import os
import re
from playwright.sync_api import sync_playwright

def clean_selector(selector: str) -> str:
    """
    Membersihkan selector raksasa dari Visual Selector UI.
    Abaikan class Tailwind layout/spacing/responsive dan ambil tag/class bermakna.
    """
    if not selector:
        return "body"

    parts = [p.strip() for p in selector.split('>')]
    clean_parts = []

    # Daftar kata kunci class Tailwind/Next.js yang HARUS dibuang karena rawan break
    ignored_keywords = [
        'flex', 'grid', 'col', 'row', 'items', 'justify', 'center', 'relative', 'absolute',
        'portrait', 'w-', 'h-', 'max-', 'min-', 'mx-', 'my-', 'px-', 'py-', 'pt-', 'pb-',
        'leading-', 'text-', 'gap-', 'z-', 'font-', 'bg-', 'st-', '__'
    ]

    for part in parts:
        match = re.match(r'^([a-zA-Z0-9_-]+)', part)
        if not match:
            continue

        tag_name = match.group(1)

        # Jaga ID jika ada
        id_match = re.search(r'#([a-zA-Z0-9_-]+)', part)
        if id_match:
            clean_parts.append(f"{tag_name}#{id_match.group(1)}")
            continue

        # Filter class, buang class utility Tailwind
        classes = re.findall(r'\.([a-zA-Z0-9_-]+)', part)
        valid_classes = [
            cls for cls in classes
            if not any(cls.startswith(kw) or f":{kw}" in cls for kw in ignored_keywords)
        ]

        if valid_classes:
            clean_parts.append(f"{tag_name}.{valid_classes[0]}")
        else:
            clean_parts.append(tag_name)

    # Ambil elemen paling spesifik di ujung selector
    # Jika tag paling akhir adalah elemen teks utama (h1-h6, p, span, a), gunakan tag tersebut
    last_tag = clean_parts[-1]
    return last_tag if last_tag else "body"


def scrape(config_params):
    url = config_params.get("url")
    raw_selector = config_params.get("selector")

    if not url or not raw_selector:
        raise ValueError("Missing 'url' or 'selector' in config parameters")
        
    # Hapus karakter quotes (`"` atau `'`) di awal/akhir selector yang mungkin disuntikkan dari GUI Visual Selector
    raw_selector = raw_selector.strip(' "\'')
    import urllib.parse
    raw_selector = urllib.parse.unquote(raw_selector)

    selector = clean_selector(raw_selector)
    # Output cleaning agar JSON return tidak error
    # Log dibiarkan menggunakan std.err bila diperlukan, tapi di sini direkomendasikan dihapus 
    # karena ini dipanggil via shell command oleh Go dan print out standard (stdout) MENGGANGGU proses unmarshalling (JSON parsing) pada Golang.
    
    launch_options = {
        "headless": True,
        "args": [
            "--disable-setuid-sandbox",
            "--no-sandbox",
            "--ignore-certificate-errors",
            "--disable-blink-features=AutomationControlled"
        ]
    }

    http_proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy") or os.environ.get("HTTPS_PROXY")
    if http_proxy:
        # Playwright format uses server/username/password explicitly if the URL contains auth
        import urllib.parse
        parsed_proxy = urllib.parse.urlparse(http_proxy)
        
        proxy_settings = {
            "server": f"{parsed_proxy.scheme}://{parsed_proxy.hostname}:{parsed_proxy.port}"
        }
        
        if parsed_proxy.username and parsed_proxy.password:
            proxy_settings["username"] = urllib.parse.unquote(parsed_proxy.username)
            proxy_settings["password"] = urllib.parse.unquote(parsed_proxy.password)
            
        launch_options["proxy"] = proxy_settings

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(**launch_options)

        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1366, "height": 768},
            ignore_https_errors=True
        )
        # Optional optimization: block image/fonts
        # context.route("**/*.{png,jpg,jpeg,svg,gif,woff,woff2}", lambda route: route.abort())
        page = context.new_page()

        try:
            # Berikan timeout navigasi wajar 
            try:
                page.goto(url, wait_until="load", timeout=30000)
            except Exception as goto_err:
                pass # Silent exception

            # Menunggu elemen target muncul (maksimal 15 detik).
            # Ini memberikan waktu yang cukup bagi browser untuk secara alami (natural) 
            # menyelesaikan Cloudflare JS Challenge (Just a moment...) jika tidak ada CAPTCHA interaktif.
            try:
                page.wait_for_selector(selector, timeout=15000, state="attached")
            except Exception:
                # Jika selector tidak ditemukan (mungkin terblokir permanen atau salah), fallback ke tag dasar
                if "." in selector:
                    base_tag = selector.split(".")[0]
                    try:
                        page.wait_for_selector(base_tag, timeout=5000, state="attached")
                    except:
                        pass

            # Ekstraksi langsung dari DOM
            elements = page.query_selector_all(selector)

            # Fallback eksekusi
            if not elements and "." in selector:
                base_tag = selector.split(".")[0]
                elements = page.query_selector_all(base_tag)

            seen_texts = set()
            for el in elements:
                try:
                    text = el.inner_text().strip()
                    if text and text not in seen_texts:
                        results.append(text)
                        seen_texts.add(text)
                except Exception:
                    continue

        except Exception as e:
            pass # Return empty array if playwright fails internally to not pollute JSON
        finally:
            browser.close()

    return results


if __name__ == "__main__":
    import json
    import sys
    
    # Simple JSON interface testing wrapper
    config = {"url": "https://bps.go.id", "selector": "title"}
    
    if len(sys.argv) > 1:
        try:
            config = json.loads(sys.argv[1])
        except:
            pass
            
    print(json.dumps(scrape(config)))