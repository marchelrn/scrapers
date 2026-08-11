import requests
from lxml import html
import os

def scrape(config_params):
    """
    Scrape using XPath.
    Expected config_params:
    - url: The URL to scrape
    - xpath: The XPath expression to extract
    """
    url = config_params.get("url")
    xpath = config_params.get("xpath")
    
    if not url or not xpath:
        raise ValueError("Missing 'url' or 'xpath' in config parameters")
        
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

    tree = html.fromstring(response.content)
    elements = tree.xpath(xpath)
    
    results = []
    for el in elements:
        if isinstance(el, str):
            results.append(el.strip())
        else:
            results.append(el.text_content().strip())
            
    return results

if __name__ == "__main__":
    # Test execution
    print(scrape({"url": "https://example.com", "xpath": "//h1/text()"}))
