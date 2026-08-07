import requests
import re
from bs4 import BeautifulSoup

def scrape(config_params):
    """
    Scrape by searching for a specific keyword in the page text and returning its context.
    Expected config_params:
    - url: The URL to scrape
    - keyword: The word or phrase to search for (case-insensitive)
    """
    url = config_params.get("url")
    keyword = config_params.get("keyword")
    
    if not url or not keyword:
        raise ValueError("Missing 'url' or 'keyword' in config parameters")

    response = requests.get(url, timeout=10)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Remove script and style elements to avoid extracting code
    for script in soup(["script", "style", "nav", "footer", "header"]):
        script.extract()

    # Search for the keyword (case-insensitive)
    pattern = re.compile(re.escape(keyword), re.IGNORECASE)
    matched_elements = soup.find_all(string=pattern)
    
    results = []
    seen_texts = set()
    
    for text_node in matched_elements:
        parent = text_node.parent
        
        # Don't grab whole body or html tags if the match is too broad
        if parent.name in ['html', 'body']:
            continue
            
        # Try to find a meaningful container (like p, li, td, h1-h6)
        container = parent
        meaningful_tags = ['p', 'li', 'td', 'th', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span']
        
        # Go up max 3 levels to find a meaningful container
        depth = 0
        while container.name not in meaningful_tags and container.parent and container.parent.name not in ['body', 'html'] and depth < 3:
            container = container.parent
            depth += 1
            
        clean_text = container.get_text(separator=' ', strip=True)
        
        # Deduplicate results
        if clean_text and clean_text not in seen_texts:
            # Simple heuristic: don't return blocks of text that are massively long unless it's a table
            if len(clean_text) < 1500:
                results.append(clean_text)
                seen_texts.add(clean_text)
                
    return results

if __name__ == "__main__":
    # Test execution
    print(scrape({"url": "https://example.com", "keyword": "Domain"}))
