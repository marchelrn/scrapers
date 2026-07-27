import requests
import re

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

    response = requests.get(url, timeout=10)
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
