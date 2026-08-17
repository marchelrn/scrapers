from playwright.sync_api import sync_playwright
import os

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
        
    # Build proxy dictionary from environment variables
    # Playwright requires a single proxy URL
    http_proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
    https_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    proxy_url = https_proxy or http_proxy
    
    proxy_config = None
    if proxy_url:
        import urllib.parse
        parsed_proxy = urllib.parse.urlparse(proxy_url)
        proxy_config = {
            "server": f"{parsed_proxy.scheme}://{parsed_proxy.hostname}:{parsed_proxy.port}"
        }
        if parsed_proxy.username and parsed_proxy.password:
            proxy_config["username"] = urllib.parse.unquote(parsed_proxy.username)
            proxy_config["password"] = urllib.parse.unquote(parsed_proxy.password)

    results = []
    
    with sync_playwright() as p:
        # Launch headless browser
        launch_kwargs = {"headless": True}
        if proxy_config:
            launch_kwargs["proxy"] = proxy_config
            
        browser = p.chromium.launch(**launch_kwargs)
        
        # Check if Auth Cookies are provided via secret
        context_kwargs = {
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        context = browser.new_context(**context_kwargs)
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
        
        import re
        def escape_css_chars(match):
            class_or_id = match.group(0)
            prefix = class_or_id[0]
            identifier = class_or_id[1:]
            
            # Escape `:` and `[` and `]` inside the class/id name. 
            # Using single backslash since Playwright uses standard CSS selectors matching browser behavior
            escaped = identifier.replace(':', '\\:').replace('[', '\\[').replace(']', '\\]')
            
            if re.match(r'^[0-9]', escaped):
                first_digit = escaped[0]
                # Standard CSS escape for leading digit: \3X followed by a space
                escaped = '\\3' + first_digit + ' ' + escaped[1:]
                
            return prefix + escaped
            
        # Find all `.classname` or `#idname` parts in the selector
        escaped_selector = re.sub(r'[\.\#][a-zA-Z0-9_\-\:\[\]]+', escape_css_chars, selector)
        
        # Navigate and wait for network to be idle
        page.goto(url, wait_until="networkidle")
        
        # Wait for the selector to appear.
        # Sometimes <title> tags or metadata are hidden, so we accept 'attached' instead of visible
        # We try escaped_selector first. If Playwright complains about invalid selector, we fallback
        try:
            page.wait_for_selector(escaped_selector, timeout=10000, state="attached")
            final_selector = escaped_selector
        except Exception as e:
            # Fallback for overly complex Tailwind CSS selectors 
            # by plucking just the base tag name
            last_tag_match = re.search(r'([a-zA-Z0-9_-]+)(?:\.[a-zA-Z0-9_\-\:\[\]]+)*$', selector)
            if last_tag_match:
                final_selector = last_tag_match.group(1)
                page.wait_for_selector(final_selector, timeout=10000, state="attached")
            else:
                final_selector = escaped_selector
        
        # Extract content
        elements = page.query_selector_all(final_selector)
        for el in elements:
            text = el.inner_text()
            if text:
                results.append(text.strip())
                
        browser.close()
        
    return results

if __name__ == "__main__":
    # Test execution
    print(scrape({"url": "https://bps.go.id", "selector": "h1"}))
