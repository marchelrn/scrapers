from playwright.sync_api import sync_playwright

def scrape(config_params):
    """
    Scrape using Headless Browser (Playwright).
    Expected config_params:
    - url: The URL to scrape
    - selector: The CSS selector to extract (or wait for)
    """
    url = config_params.get("url")
    selector = config_params.get("selector")
    
    auth_type = config_params.get("auth_type", "none")
    secret_value = config_params.get("_resolved_secret_value", "")
    if isinstance(secret_value, str):
        secret_value = secret_value.strip()
    
    if not url or not selector:
        raise ValueError("Missing 'url' or 'selector' in config parameters")

    results = []
    
    with sync_playwright() as p:
        # Launch headless browser
        browser = p.chromium.launch(headless=True)
        
        # Check if Auth Cookies are provided via secret
        context = browser.new_context()
        if auth_type == "cookie" and secret_value:
            import json
            try:
                # We expect the secret_value to be a valid JSON array of cookie dicts
                cookies = json.loads(secret_value)
                if isinstance(cookies, list):
                    context.add_cookies(cookies)
            except Exception as e:
                raise ValueError("Invalid cookie format in secret. Must be JSON array.")
        
        page = context.new_page()
        
        # Navigate and wait for network to be idle
        page.goto(url, wait_until="networkidle")
        
        # Wait for the selector to appear
        page.wait_for_selector(selector, timeout=10000)
        
        # Extract content
        elements = page.query_selector_all(selector)
        for el in elements:
            text = el.inner_text()
            if text:
                results.append(text.strip())
                
        browser.close()
        
    return results

if __name__ == "__main__":
    # Test execution
    print(scrape({"url": "https://example.com", "selector": "h1"}))
