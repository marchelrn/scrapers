import warnings
import logging
import re
import urllib.parse
import concurrent.futures
from itertools import islice

# Matikan semua peringatan stdout agar tidak merusak format output JSON
warnings.filterwarnings('ignore')
warnings.filterwarnings("ignore", category=RuntimeWarning, module="ddgs")
warnings.filterwarnings("ignore", message=".*has been renamed to `ddgs`.*")
logging.getLogger().setLevel(logging.ERROR)

import requests
from bs4 import BeautifulSoup

# Try importing DDGS from duckduckgo_search or ddgs package if available
DDGS = None
try:
    from ddgs import DDGS
except ImportError:
    try:
        from ddgs import DDGS
    except ImportError:
        DDGS = None

MAX_ARTICLE_TEXT_LENGTH = 15000  # Cap per article text (~15KB)
MAX_SNIPPET_LENGTH = 1000        # Cap snippet length (~1KB)

def _clean_text(text):
    """Removes non-printable ASCII control characters and specific corrupt unicode strings to prevent JSON corruption."""
    if not text:
        return ""
    # Strip basic control chars
    clean = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    # Strip non-standard unicode garbage often injected by bot-protection or malformed encoding
    clean = re.sub(r'[\u200b\u200e\u200f\u2028\u202a-\u202e\u2060-\u206f\ufff0-\uffff]', '', clean)
    
    # Heuristic to detect fully encrypted/garbled WAF responses (like Cloudflare Captcha pages)
    if len(clean) > 100:
        # Check ratio of weird symbols/letters to total length
        # A normal text has mostly letters, numbers, and common punctuation.
        alnum_count = sum(1 for c in clean if c.isalnum() or c.isspace() or c in '.,;:-?!()\'"')
        if alnum_count / len(clean) < 0.6: # If less than 60% of the text is normal words/punctuation, it's garbled
            return ""
            
    return clean.strip()


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
                "title": _clean_text(a_title.get_text(strip=True)),
                "link": href,
                "snippet": _clean_text(snippet_text),
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
    article_title = _clean_text(item.get("title", ""))
    snippet = _clean_text(item.get("snippet", ""))
    proxies = item.get("_proxies", {})

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
        
        req_kwargs = {
            "headers": headers, 
            "timeout": (3.0, 5.0), 
            "stream": True
        }
        if proxies:
            req_kwargs["proxies"] = proxies
            
        page_res = requests.get(article_url, **req_kwargs)

        if page_res.status_code == 200:
            content_type = page_res.headers.get("Content-Type", "").lower()
            # Skip non-text files (PDFs, ZIPs, images, binary downloads)
            if "text/html" not in content_type and "text/plain" not in content_type and "application/xhtml" not in content_type and "application/xml" not in content_type:
                page_res.close()
                return {
                    "title": article_title,
                    "url": article_url,
                    "summary": snippet,
                    "content": snippet
                }

            # Read at most 200KB of response HTML to prevent hanging on huge downloads
            # Note: If the content is compressed with gzip/brotli, reading raw directly 
            # might return compressed bytes. Better to use page_res.iter_content or page_res.content
            # but bounded to avoid memory explosion.
            
            # We will read chunks until we hit 250KB or EOF
            # We use iter_content with decode_unicode=True so it automatically handles gzip/deflate
            # and returns decoded unicode strings directly if possible, preventing mangled text
            chunks = []
            bytes_read = 0
            for chunk in page_res.iter_content(chunk_size=16384, decode_unicode=True):
                if chunk:
                    # Depending on requests version, decode_unicode=True might return str instead of bytes
                    if isinstance(chunk, bytes):
                        chunks.append(chunk)
                        bytes_read += len(chunk)
                    else:
                        chunks.append(chunk.encode('utf-8', errors='ignore'))
                        bytes_read += len(chunk.encode('utf-8'))
                        
                    if bytes_read > 250000:
                        break
            
            page_res.close()
            
            raw_bytes = b"".join(chunks)
            # We enforce UTF-8 since we already handled decoding in iter_content when possible
            html_text = raw_bytes.decode('utf-8', errors='ignore')

            soup = BeautifulSoup(html_text, 'html.parser')

            # Remove junk (noting that removing header, footer, nav can drop core content on some sites like portfolios, 
            # but usually for news articles we DO want to remove them. We'll leave them to remove navigation but keep main content)
            for element in soup(["script", "style", "nav", "footer", "aside", "form"]):
                element.extract()

            # For generic search content extraction, try to find a meaningful container or fallback to p tags
            # Try to grab paragraphs and lists
            content_tags = soup.find_all(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'td'])
            texts = [p.get_text(separator=' ', strip=True) for p in content_tags]
            
            # Remove very short navigation-like links that survived
            texts = [t for t in texts if len(t) > 35]
            
            # Deduplicate while preserving order
            seen = set()
            dedup_texts = []
            for t in texts:
                if t not in seen:
                    dedup_texts.append(t)
                    seen.add(t)
                    
            extracted_text = "\n".join(dedup_texts)

            if len(extracted_text) < 100:
                extracted_text = snippet
        else:
            page_res.close()
            extracted_text = snippet
    except Exception:
        extracted_text = snippet

    extracted_text = _clean_text(extracted_text)

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

    # If domain_filter is provided, sanitize schemes (http://, https://) and path parts
    if domain_filter:
        raw_domains = [d.strip() for d in str(domain_filter).split(',') if d.strip()]
        cleaned_domains = []
        for d in raw_domains:
            d_clean = re.sub(r'^https?://', '', d, flags=re.IGNORECASE).split('/')[0].strip()
            if d_clean:
                cleaned_domains.append(d_clean)
        if cleaned_domains:
            site_query = " OR ".join([f"site:{d}" for d in cleaned_domains])
            query = f"{query} {site_query}"

    # 1. DDG Search Request
    items = []
    if DDGS is not None:
        try:
            with DDGS() as ddgs:
                results = list(islice(ddgs.text(query), max_results))
                for r in results:
                    snip = _clean_text(r.get("body", ""))
                    if len(snip) > MAX_SNIPPET_LENGTH:
                        snip = snip[:MAX_SNIPPET_LENGTH] + "..."
                    items.append({
                        "title": _clean_text(r.get("title", "")),
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
    # Add proxy capability from environment variables
    import os
    http_proxy = os.environ.get("HTTP_PROXY") or os.environ.get("http_proxy")
    https_proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    proxies = {}
    if http_proxy:
        proxies["http"] = http_proxy
    if https_proxy:
        proxies["https"] = https_proxy
        
    def fetch_with_proxy(item):
        item["_proxies"] = proxies
        return _fetch_article_content(item)

    executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)
    futures = {executor.submit(fetch_with_proxy, item): item for item in items}
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

    # 3. Opsional: Integrasi Gemini AI untuk Meringkas & Memfilter Konten
    ai_instruction = config_params.get("ai_instruction", "").strip()
    gemini_api_key = os.environ.get("GEMINI_API_KEY", "").strip()

    if ai_instruction and gemini_api_key:
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_api_key)
            model = genai.GenerativeModel("gemini-1.5-flash") # Use fast model
            
            for res in final_results:
                raw_content = res.get("content", "")
                if not raw_content or len(raw_content) < 50:
                    continue
                
                # Buat prompt yang menggabungkan instruksi user dan teks konten mentah
                prompt = f"""
Anda adalah AI asisten analisis data BPS.
Instruksi Filter & Ringkas: {ai_instruction}

Berdasarkan instruksi di atas, analisis dan ringkas teks berita di bawah ini.
Jika teks berita TIDAK RELEVAN dengan instruksi (misalnya instruksi meminta fenomena pertanian tapi berita berisi pelantikan pejabat/politik), KEMBALIKAN TEKS KOSONG atau tulis "TIDAK RELEVAN".
Jika relevan, berikan ringkasan yang padat, jelas, dan hanya memuat informasi/data yang diminta.

Teks Berita:
{raw_content[:8000]} # Batasi 8000 karakter agar hemat token
"""
                try:
                    response = model.generate_content(prompt)
                    ai_result = response.text.strip()
                    
                    if "TIDAK RELEVAN" in ai_result.upper() or len(ai_result) < 10:
                        res["ai_filtered"] = True
                        res["content"] = "[AI Filtered: Tidak Relevan dengan Instruksi]"
                    else:
                        res["ai_filtered"] = False
                        res["content"] = ai_result
                except Exception as e:
                    # Fallback jika gemini limit/error
                    res["content"] = f"[AI Error: {str(e)}] " + raw_content
                    
            # Hapus hasil yang ditandai tidak relevan oleh AI
            final_results = [r for r in final_results if not r.get("ai_filtered", False)]
            
        except ImportError:
            pass # google-generativeai module not installed

    return final_results


if __name__ == "__main__":
    pass
