import os
import re
from playwright.sync_api import sync_playwright

def clean_selector(selector: str) -> str:
    """
    Membersihkan selector raksasa dari Visual Selector UI.
    Hapus class internal bps-picker, saring class dengan titik dua tak ter-escape (seperti .md:ml-4),
    dan hapus class utility Tailwind agar selector CSS valid & presisi.
    """
    if not selector:
        return "body"

    sub_selectors = [s.strip() for s in selector.split(',') if s.strip()]
    cleaned_subs = []

    for sub in sub_selectors:
        # Hapus class picker internal jika ada
        sub = re.sub(r'\.bps-picker-[a-zA-Z0-9_-]+', '', sub)
        # Hapus class dengan colon tak ter-escape seperti .md:ml-4 atau .hover:bg-red
        sub = re.sub(r'\.([a-zA-Z0-9_-]+):([a-zA-Z0-9_-]+)', '', sub)
        # Hapus class utility Tailwind umum (mt-*, rounded-*, p-*, ml-*, dsb)
        sub = re.sub(r'\.(mt|mb|ml|mr|p|pt|pb|pl|pr|w|h|mx|my|px|py|rounded|text|bg|flex|grid|border|items|justify|gap|z|font)-[a-zA-Z0-9_-]+', '', sub)
        
        # Bersihkan spasi / operator berlebih
        sub = re.sub(r'\s+>\s+', ' > ', sub).strip()
        if sub:
            cleaned_subs.append(sub)

    result = ", ".join(cleaned_subs)
    return result if result else "body"


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