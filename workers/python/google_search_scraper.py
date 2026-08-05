import warnings
import logging
# Matikan semua peringatan stdout agar tidak merusak format output JSON
warnings.filterwarnings('ignore')
logging.getLogger().setLevel(logging.ERROR)

import requests
from bs4 import BeautifulSoup
from ddgs import DDGS
from itertools import islice

def scrape(config_params):
    """
    Search articles via DuckDuckGo Search (Gratis, No API Key) and extract their contents.
    Expected config_params:
    - query: Search keyword
    - domain_filter: (Optional) comma separated domains
    - max_results: (Optional) number of results to fetch (default 10)
    """
    query = config_params.get("query")
    domain_filter = config_params.get("domain_filter", "")
    
    try:
        max_results = int(config_params.get("max_results", 10))
    except ValueError:
        max_results = 10
    
    if max_results > 15:
        max_results = 15
        
    if not query:
        raise ValueError("Missing 'query' parameter")

    # If domain_filter is provided, append it to the query
    if domain_filter:
        domains = [d.strip() for d in domain_filter.split(',') if d.strip()]
        if domains:
            site_query = " OR ".join([f"site:{d}" for d in domains])
            query = f"{query} {site_query}"

    # 1. DDG Search Request
    items = []
    try:
        with DDGS() as ddgs:
            # Menggunakan islice untuk mengambil n hasil pertama, untuk bypass struktur iterator ddgs yang baru
            # Coba cari lewat metode text biasa karena DDG news sering kali limit di IP tertentu
            results = list(islice(ddgs.text(query), max_results))
            
            for r in results:
                # Map DDG output to our expected structure
                items.append({
                    "title": r.get("title", ""),
                    "link": r.get("href", ""),
                    "snippet": r.get("body", ""),
                    "source": ""
                })
    except Exception as e:
        raise RuntimeError(f"Search API Error: {str(e)}")

    if not items:
        return []

    final_results = []
    
    # 2. Extract content from each URL found
    for item in items:
        article_url = item.get("link")
        article_title = item.get("title")
        snippet = item.get("snippet")
        
        extracted_text = ""
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept-Language": "en-US,en;q=0.9",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
            }
            page_res = requests.get(article_url, headers=headers, timeout=10)
            
            if page_res.status_code == 200:
                soup = BeautifulSoup(page_res.text, 'html.parser')
                
                # Remove junk
                for element in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
                    element.extract()
                
                # Extract paragraphs
                paragraphs = soup.find_all('p')
                texts = [p.get_text(separator=' ', strip=True) for p in paragraphs]
                texts = [t for t in texts if len(t) > 30]
                extracted_text = "\n".join(texts)
                
                if len(extracted_text) < 100:
                    extracted_text = snippet
            else:
                extracted_text = snippet
        except Exception:
            extracted_text = snippet

        final_results.append({
            "title": article_title,
            "url": article_url,
            "summary": snippet,
            "content": extracted_text
        })

    return final_results

if __name__ == "__main__":
    pass
