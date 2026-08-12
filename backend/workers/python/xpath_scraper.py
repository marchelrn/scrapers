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

    # Add standard User-Agent header to avoid basic 403 Forbidden responses
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        "Sec-Ch-Ua": "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"",
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": "\"Windows\""
    }

    # Only pass proxies arg if we have proxies configured
    req_kwargs = {"timeout": 15, "headers": headers}
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
