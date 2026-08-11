import warnings
import logging
import urllib.parse
import concurrent.futures
from itertools import islice

# Matikan semua peringatan stdout agar tidak merusak format output JSON
warnings.filterwarnings('ignore')
logging.getLogger().setLevel(logging.ERROR)

import requests
from bs4 import BeautifulSoup

# Try importing DDGS from duckduckgo_search or ddgs package if available
DDGS = None
try:
    from duckduckgo_search import DDGS
except ImportError:
    try:
        from ddgs import DDGS
    except ImportError:
        DDGS = None

MAX_ARTICLE_TEXT_LENGTH = 15000  # Cap per article text (~15KB)
MAX_SNIPPET_LENGTH = 1000        # Cap snippet length (~1KB)


def _search_ddg_fallback(query, max_results):
    """
    Fallback DuckDuckGo web search using requests and BeautifulSoup against html.duckduckgo.com.
    Does not require external packages beyond requests and beautifulsoup4.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    url = "https://html.duckduckgo.com/html/"
    try:
        resp = requests.post(url, data={"q": query}, headers=headers, timeout=(3.0, 5.0))
        if resp.status_code != 200:
            return []

        soup = BeautifulSoup(resp.text, "html.parser")
        results = []

        for div in soup.find_all("div", class_="web-result"):
            a_title = div.find("a", class_="result__a")
            snippet_elem = div.find("a", class_="result__snippet") or div.find("td", class_="result__snippet")
            if not a_title:
                continue

            href = a_title.get("href", "")
            if "uddg=" in href:
                parsed = urllib.parse.parse_qs(urllib.parse.urlparse(href).query)
                if "uddg" in parsed and parsed["uddg"]:
                    href = parsed["uddg"][0]

            snippet_text = snippet_elem.get_text(strip=True) if snippet_elem else ""
            if len(snippet_text) > MAX_SNIPPET_LENGTH:
                snippet_text = snippet_text[:MAX_SNIPPET_LENGTH] + "..."

            results.append({
                "title": a_title.get_text(strip=True),
                "link": href,
                "snippet": snippet_text,
                "source": ""
            })

            if len(results) >= max_results:
                break

        return results
    except Exception:
        return []


def _fetch_article_content(item):
    """Fetches and extracts text content from an article URL with strict stream timeout."""
    article_url = item.get("link")
    article_title = item.get("title", "")
    snippet = item.get("snippet", "")

    if len(snippet) > MAX_SNIPPET_LENGTH:
        snippet = snippet[:MAX_SNIPPET_LENGTH] + "..."

    if not article_url:
        return {
            "title": article_title,
            "url": "",
            "summary": snippet,
            "content": snippet
        }

    extracted_text = ""
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        }
        page_res = requests.get(article_url, headers=headers, timeout=(3.0, 5.0), stream=True)

        if page_res.status_code == 200:
            # Read at most 200KB of response HTML to prevent hanging on huge downloads
            raw_bytes = page_res.raw.read(200000)
            page_res.close()
            encoding = page_res.encoding or 'utf-8'
            html_text = raw_bytes.decode(encoding, errors='ignore')

            soup = BeautifulSoup(html_text, 'html.parser')

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
            page_res.close()
            extracted_text = snippet
    except Exception:
        extracted_text = snippet

    # Enforce maximum character limit per article to prevent stdout overflow (>5MB)
    if len(extracted_text) > MAX_ARTICLE_TEXT_LENGTH:
        extracted_text = extracted_text[:MAX_ARTICLE_TEXT_LENGTH] + "\n... [content truncated]"

    return {
        "title": article_title,
        "url": article_url,
        "summary": snippet,
        "content": extracted_text
    }


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
    except (ValueError, TypeError):
        max_results = 10

    if max_results > 15:
        max_results = 15

    if not query:
        raise ValueError("Missing 'query' parameter")

    # If domain_filter is provided, append it to the query
    if domain_filter:
        domains = [d.strip() for d in str(domain_filter).split(',') if d.strip()]
        if domains:
            site_query = " OR ".join([f"site:{d}" for d in domains])
            query = f"{query} {site_query}"

    # 1. DDG Search Request
    items = []
    if DDGS is not None:
        try:
            with DDGS() as ddgs:
                results = list(islice(ddgs.text(query), max_results))
                for r in results:
                    snip = r.get("body", "")
                    if len(snip) > MAX_SNIPPET_LENGTH:
                        snip = snip[:MAX_SNIPPET_LENGTH] + "..."
                    items.append({
                        "title": r.get("title", ""),
                        "link": r.get("href", ""),
                        "snippet": snip,
                        "source": ""
                    })
        except Exception:
            # Fallback to HTTP search if DDGS fails (e.g., rate limit or API change)
            items = _search_ddg_fallback(query, max_results)
    else:
        items = _search_ddg_fallback(query, max_results)

    if not items:
        return []

    # 2. Extract content from each URL in parallel with non-blocking shutdown
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)
    futures = {executor.submit(_fetch_article_content, item): item for item in items}
    final_results = []

    try:
        for future in concurrent.futures.as_completed(futures, timeout=15):
            try:
                res = future.result()
                if res:
                    final_results.append(res)
            except Exception:
                pass
    except concurrent.futures.TimeoutError:
        pass
    finally:
        executor.shutdown(wait=False, cancel_futures=True)

    # Sort final_results to match the order of items
    url_to_index = {item.get("link"): i for i, item in enumerate(items)}
    final_results.sort(key=lambda r: url_to_index.get(r.get("url"), 999))

    return final_results


if __name__ == "__main__":
    pass
