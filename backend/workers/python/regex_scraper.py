import requests
import re
import os

def scrape(config_params):
    """
    Scrape using Regular Expression.
    Expected config_params:
    - url: The URL to scrape
    - pattern: The Regex pattern to extract
    """
    url = config_params.get("url")
    pattern = config_params.get("pattern")
    
    if not url or not pattern:
        raise ValueError("Missing 'url' or 'pattern' in config parameters")

    # Build proxies dictionary from environment variables
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

    req_kwargs = {"timeout": 15, "headers": headers}
    if proxies:
        req_kwargs["proxies"] = proxies

    response = requests.get(url, **req_kwargs)
    response.raise_for_status()

    # Find all matches
    matches = re.findall(pattern, response.text)
    
    # Process results (convert tuples to string if multiple groups are matched)
    results = []
    for match in matches:
        if isinstance(match, tuple):
            results.append(" ".join(match))
        else:
            results.append(match)
            
    return results

if __name__ == "__main__":
    # Test execution
    print(scrape({"url": "https://example.com", "pattern": r"<title>(.*?)</title>"}))
