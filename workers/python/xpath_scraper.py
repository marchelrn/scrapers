import requests
from lxml import html

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

    response = requests.get(url, timeout=10)
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
