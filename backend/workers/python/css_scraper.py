import requests
from bs4 import BeautifulSoup

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

    response = requests.get(url, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, 'html.parser')
    elements = soup.select(selector)
    
    results = [el.get_text(strip=True) for el in elements]
    return results

if __name__ == "__main__":
    # Test execution
    print(scrape({"url": "https://example.com", "selector": "h1"}))
