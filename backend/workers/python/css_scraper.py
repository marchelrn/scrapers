import requests
from bs4 import BeautifulSoup
import os

def scrape(config_params):
    """
    Scrape using CSS Selector.
    Expected config_params:
    - url: The URL to scrape
    - selector: The CSS selector to extract
    """
    url = config_params.get("url")
    selector = config_params.get("selector")
    
    if not url or not selector:
        raise ValueError("Missing 'url' or 'selector' in config parameters")
        
    # Build proxies dictionary from environment variables (like HTTP_PROXY/HTTPS_PROXY)
    proxies = {}
    http_proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
    https_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    
    if http_proxy:
        proxies["http"] = http_proxy
    if https_proxy:
        proxies["https"] = https_proxy

    # Only pass proxies arg if we have proxies configured
    req_kwargs = {"timeout": 10}
    if proxies:
        req_kwargs["proxies"] = proxies

    response = requests.get(url, **req_kwargs)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, 'html.parser')
    elements = soup.select(selector)
    
    results = [el.get_text(strip=True) for el in elements]
    return results

if __name__ == "__main__":
    # Test execution
    print(scrape({"url": "https://example.com", "selector": "h1"}))
