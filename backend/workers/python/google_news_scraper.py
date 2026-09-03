import warnings
import logging
import json
import re
import os
import urllib.parse
import xml.etree.ElementTree as ET
import concurrent.futures

# Silence stdout warnings to protect JSON output contract
warnings.filterwarnings('ignore')
logging.getLogger().setLevel(logging.ERROR)

import requests
from bs4 import BeautifulSoup

import fetcher
import net_policy
from scraper_errors import ContentTypeError, ScraperError, ValidationError

try:
    from newspaper import Article
    NEWSPAPER_AVAILABLE = True
except ImportError:
    NEWSPAPER_AVAILABLE = False

try:
    from googlenewsdecoder import gnewsdecoder
    DECODER_AVAILABLE = True
except ImportError:
    DECODER_AVAILABLE = False

MAX_ARTICLE_TEXT_LENGTH = 15000
TIMEOUT = 15
# Jumlah artikel yang diambil bersamaan. Nilainya kecil dengan sengaja: jeda per
# domain di net_policy sudah menyerialkan penerbit yang sama, jadi konkurensi
# tinggi hanya menambah beban tanpa mempercepat apa pun.
ARTICLE_WORKERS = int(os.environ.get("SCRAPER_ARTICLE_WORKERS", "") or 3)

INDONESIAN_STOPWORDS = {
    "yang", "di", "dari", "dan", "itu", "dengan", "ke", "adalah", "ini", "untuk", 
    "pada", "juga", "atau", "saya", "kami", "mereka", "dia", "anda", "kita", "tersebut",
    "dalam", "oleh", "ada", "telah", "bisa", "dapat", "akan", "tapi", "namun", "karena",
    "seperti", "sebagai", "sehingga", "serta", "yaitu", "yakni", "secara", "bagi", "bahwa",
    "tengah", "saat", "lalu", "setelah", "ia", "sudah", "kembali", "banyak", "beberapa"
}

KEYWORDS = {
    "Tanaman Pangan": ["padi", "beras", "jagung", "kedelai", "gabah", "sawah", "traktor", "alsintan", "ketahanan pangan", "pangan", "produksi tani"],
    "Hortikultura": ["bawang", "cabai", "rica", "sayur", "tomat", "buah", "mangga", "durian", "pisang"],
    "Perkebunan": ["kelapa", "cengkeh", "cengkih", "kopra", "kakao", "sawit", "kopi", "pala", "perkebunan", "bibit kelapa"],
    "Perikanan": ["ikan", "cakalang", "nelayan", "perikanan", "budidaya", "udang", "tangkapan", "tuna", "hasil laut"],
    "Peternakan": ["sapi", "ayam", "babi", "kambing", "bebek", "telur", "daging", "ternak", "peternakan"],
    "Industri": ["industri", "pabrik", "manufaktur", "olahan", "pengolahan", "hilirisasi", "industri hijau", "produksi pabrik"],
    "Pertambangan": ["tambang", "emas", "nikel", "bijih", "mineral", "batubara", "pertambangan"],
    "Energi": ["listrik", "energi", "pltp", "panas bumi", "geothermal", "bbm", "pertalite", "solar", "minyak bumi", "gas", "lpg", "psel"],
    "Konstruksi": ["konstruksi", "semen", "jalan", "jembatan", "gedung", "proyek", "tol", "infrastruktur"],
    "Ekonomi": ["ekonomi", "perekonomian", "pdrb", "inflasi", "yoy", "ihk", "investasi", "apbn", "apbd", "keuangan", "bank indonesia", "perbankan", "fiskal", "daya beli", "pad", "pendapatan daerah", "anggaran"],
    "Perdagangan": ["harga", "pasar", "sembako", "pihps", "eceran", "minyak goreng", "perdagangan", "harga pangan", "pasar modern", "pasar tradisional"]
}

def _clean_noise(text, title=""):
    if not text:
        return ""
    lines = text.split('\n')
    cleaned_lines = []
    title_lower = title.strip().lower() if title else ""

    for line in lines:
        l = line.strip()
        if not l:
            continue
        if title_lower and l.lower() == title_lower:
            continue
        if re.search(r'\b(senin|selasa|rabu|kamis|jumat|sabtu|minggu),\s+\d+\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)', l, re.IGNORECASE):
            continue
        if re.search(r'^\d{1,2}\s+(jan|feb|mar|apr|mei|jun|jul|agu|sep|okt|nov|des)\w*\s+\d{4}', l, re.IGNORECASE):
            continue
        if re.search(r'\b\d{1,2}:\d{2}\s+(wib|wita|wit)\b', l, re.IGNORECASE):
            continue
        if re.search(r'^(copyright|pewarta\s*:|editor\s*:|post views:|loader|mohon tunggu)', l, re.IGNORECASE):
            continue
            
        l = re.sub(r'^(manado|minut|jakarta|tnews|antara|koranmetro|gosulut)\s*\([^)]*\)\s*[-–]?\s*', '', l, flags=re.IGNORECASE)
        l = re.sub(r'^[A-Z0-9\s,–-]{2,20}\s*[-–]\s*', '', l)
        
        if len(l) > 25:
            cleaned_lines.append(l)

    return "\n\n".join(cleaned_lines) if cleaned_lines else text

def _clean_text(text):
    if not text:
        return ""
    clean = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    clean = re.sub(r'[\u200b\u200e\u200f\u2028\u202a-\u202e\u2060-\u206f\ufff0-\uffff]', '', clean)
    return clean.strip()

# ---------------------------------------------------------------------------
# Penerjemahan tautan Google News
# ---------------------------------------------------------------------------
# Tautan pada feed RSS Google News berbentuk
# https://news.google.com/rss/articles/CBMi<base64 opaque>. Format lama masih
# dapat dibaca langsung dari base64-nya, tetapi format baru (AU_yqL...) tidak
# memuat URL penerbit sama sekali -- ia hanya sebuah pengenal yang harus
# ditukarkan lewat endpoint yang dipakai klien Google News sendiri.
#
# Tanpa penerjemahan ini, real_url tetap menunjuk ke news.google.com, sehingga
# yang diekstrak justru halaman pembungkus milik Google -- itulah sebab semua
# artikel sebelumnya berjudul "Google Berita" dan isinya kosong.
GNEWS_DECODE_TIMEOUT = float(os.environ.get("SCRAPER_GNEWS_DECODE_TIMEOUT", "") or 12.0)
GNEWS_BATCH_URL = "https://news.google.com/_/DotsSplashUi/data/batchexecute"
_GNEWS_ARTICLE_RE = re.compile(r"/(?:rss/)?articles/([A-Za-z0-9_\-]{20,})")
_GNEWS_CACHE_NAME = "gnews_urls.json"


def _gnews_article_id(url):
    match = _GNEWS_ARTICLE_RE.search(urllib.parse.urlsplit(url).path)
    return match.group(1) if match else ""


def _gnews_cache_path():
    return os.path.join(net_policy.state_dir(), _GNEWS_CACHE_NAME)


def _gnews_cache_read():
    try:
        with open(_gnews_cache_path(), "r", encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else {}
    except (OSError, ValueError):
        return {}


def _gnews_cache_get(article_id):
    return _gnews_cache_read().get(article_id) or ""


def _gnews_cache_put(article_id, resolved):
    """Simpan hasil penerjemahan; pengenal artikel bersifat tetap sehingga aman
    di-cache selamanya. Ini menekan dua permintaan ke news.google.com per artikel
    menjadi nol pada eksekusi berikutnya."""
    path = _gnews_cache_path()
    try:
        with net_policy._FileLock(path + ".lock"):
            data = _gnews_cache_read()
            data[article_id] = resolved
            # Batasi pertumbuhan berkas: sisakan entri termuda.
            if len(data) > 5000:
                data = dict(list(data.items())[-4000:])
            tmp = path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as handle:
                json.dump(data, handle)
            os.replace(tmp, path)
    except OSError:
        pass


def _gnews_batch_payload(article_id, timestamp, signature):
    inner = [
        "garturlreq",
        [["X", "X", ["X", "X"], None, None, 1, 1, "US:en", None, 1,
          None, None, None, None, None, 0, 1],
         "X", "X", 1, [1, 1, 1], 1, 1, None, 0, 0, None, 0],
        article_id,
        timestamp,
        signature,
    ]
    return urllib.parse.urlencode(
        {"f.req": json.dumps([[["Fbv4je", json.dumps(inner)]]])})


def _decode_via_batchexecute(url, article_id):
    page = fetcher.fetch(url, expect="any", use_cache=False, max_attempts=1,
                         timeout=GNEWS_DECODE_TIMEOUT)
    html = page.text
    signature = re.search(r'data-n-a-sg="([^"]+)"', html)
    stamp = re.search(r'data-n-a-ts="([^"]+)"', html)
    if not (signature and stamp):
        return ""

    response = fetcher.fetch(
        GNEWS_BATCH_URL, method="POST",
        data=_gnews_batch_payload(article_id, int(stamp.group(1)), signature.group(1)),
        headers={"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
        expect="any", use_cache=False, max_attempts=1, timeout=GNEWS_DECODE_TIMEOUT)

    # Balasan batchexecute didahului baris penjaga anti-XSSI, jadi baris pertama
    # dilewati bila ada.
    lines = [line for line in response.text.split("\n") if line.strip()]
    for line in reversed(lines):
        if not line.lstrip().startswith("["):
            continue
        try:
            envelope = json.loads(line)
            resolved = json.loads(envelope[0][2])[1]
        except (ValueError, IndexError, TypeError, KeyError):
            continue
        if isinstance(resolved, str) and resolved.startswith("http"):
            return resolved
    return ""


def _resolve_google_news_link(url):
    """Ubah tautan pengalih Google News menjadi URL penerbit aslinya.

    Permintaan disalurkan lewat fetcher.py agar jeda per domain, robots.txt, dan
    deteksi blokir tetap berlaku. Gagal resolusi bukan hal fatal: tautan RSS asli
    masih dapat dipakai sebagai identitas artikel.
    """
    article_id = _gnews_article_id(url)

    if article_id:
        cached = _gnews_cache_get(article_id)
        if cached:
            return cached

    if DECODER_AVAILABLE:
        try:
            decoded = gnewsdecoder(url, interval=1)
            if decoded.get("status") and decoded.get("decoded_url"):
                if article_id:
                    _gnews_cache_put(article_id, decoded["decoded_url"])
                return decoded["decoded_url"]
        except Exception:
            pass

    if article_id:
        try:
            resolved = _decode_via_batchexecute(url, article_id)
        except ScraperError:
            resolved = ""
        if resolved:
            _gnews_cache_put(article_id, resolved)
            return resolved

    # Tautan lama masih menjawab dengan pengalihan HTTP biasa.
    for method in ("HEAD", "GET"):
        try:
            result = fetcher.fetch(url, method=method, allow_redirects=True,
                                   expect="any", use_cache=False, max_attempts=1)
        except ScraperError:
            continue
        if result.url and "news.google.com" not in result.url:
            if article_id:
                _gnews_cache_put(article_id, result.url)
            return result.url
    return url

def _split_into_sentences(text):
    text = re.sub(r'\s+', ' ', text)
    sentence_end = re.compile(r'(?<!\b[A-Z][a-z]\.)(?<!\b[A-Za-z]\.)(?<=\.|\?|\!)\s')
    sentences = sentence_end.split(text)
    return [s.strip() for s in sentences if s.strip()]

def _extractive_summarize(text, num_sentences=3, title=""):
    if not text:
        return ""
    
    cleaned_body = _clean_noise(text, title)
    sentences = _split_into_sentences(cleaned_body)
    if not sentences:
        return title or ""

    if len(sentences) <= num_sentences:
        return " ".join(sentences)

    word_frequencies = {}
    for sentence in sentences:
        words = sentence.split()
        for word in words:
            cleaned = re.sub(r'[^\w\s]', '', word).lower()
            if not cleaned or cleaned in INDONESIAN_STOPWORDS or cleaned.isdigit():
                continue
            word_frequencies[cleaned] = word_frequencies.get(cleaned, 0) + 1

    if not word_frequencies:
        return " ".join(sentences[:num_sentences])

    max_freq = max(word_frequencies.values())
    for word in word_frequencies:
        word_frequencies[word] = word_frequencies[word] / max_freq

    sentence_scores = {}
    for i, sentence in enumerate(sentences):
        words = sentence.split()
        if len(words) < 6:
            continue
        score = sum(word_frequencies.get(re.sub(r'[^\w\s]', '', w).lower(), 0) for w in words)
        
        # Boost key statistics or main statements
        if re.search(r'\b\d+([.,]\d+)?\s*(persen|%|hektar|ton|rp|jutaan|miliar|triliun)\b', sentence, re.IGNORECASE):
            score *= 1.4
        if i in (0, 1):
            score *= 1.25
        sentence_scores[i] = score

    if not sentence_scores:
        return " ".join(sentences[:num_sentences])

    top_indices = sorted(sentence_scores, key=sentence_scores.get, reverse=True)[:num_sentences]
    top_indices.sort()
    
    summary_sentences = [sentences[idx] for idx in top_indices]
    final_summary = " ".join(summary_sentences)
    return re.sub(r'\s+', ' ', final_summary).strip()

PERTANIAN_GROUP = {"Tanaman Pangan", "Hortikultura", "Perkebunan", "Perikanan", "Peternakan", "Pertanian"}
PRODUKSI_GROUP = {"Industri", "Pertambangan", "Energi", "Konstruksi", "Produksi"}
EKONOMI_GROUP = {"Ekonomi", "Perekonomian", "Keuangan", "Inflasi", "PDRB"}

def _extract_main_category_from_query(query):
    if not query:
        return "Ekonomi", "Ekonomi"

    q = query.strip().replace('"', '').replace("'", '')

    noise_patterns = [
        r'\b(sulawesi\s+utara|sulut|manado|bitung|tomohon|kotamobagu|minahasa|minut|minsel|mitra|bolmong|bolmut|bolsel|boltim|sangihe|talaud|sitaro|tondano|airmadidi|amurang|tombatu|lolak|boroko|bolaang\s+uki|tutuyan|tahuna|melonguane|siau|tagulandang|biaro|ondong)\b',
        r'\b(triwulan\s+[i|v|x]+|triwulan\s+\d+|kuartal\s+\d+|q[1-4])\b',
        r'\b(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b',
        r'\b(2020|2021|2022|2023|2024|2025|2026|2027|2028|2029|2030)\b',
        r'\b(kabupaten|kab|kota|provinsi|prov)\b'
    ]

    clean_q = q
    for pattern in noise_patterns:
        clean_q = re.sub(pattern, '', clean_q, flags=re.IGNORECASE)
    clean_q = re.sub(r'\s+', ' ', clean_q).strip().lower()

    category_map = {
        "tanaman pangan": ("Tanaman Pangan", "Pertanian"),
        "hortikultura": ("Hortikultura", "Pertanian"),
        "perkebunan": ("Perkebunan", "Pertanian"),
        "perikanan": ("Perikanan", "Pertanian"),
        "peternakan": ("Peternakan", "Pertanian"),
        "pertanian": ("Pertanian", "Pertanian"),
        "industri": ("Industri", "Produksi"),
        "pertambangan": ("Pertambangan", "Produksi"),
        "energi": ("Energi", "Produksi"),
        "konstruksi": ("Konstruksi", "Produksi"),
        "produksi": ("Industri", "Produksi"),
        "ekonomi": ("Ekonomi", "Ekonomi"),
        "perekonomian": ("Ekonomi", "Ekonomi"),
        "inflasi": ("Ekonomi", "Ekonomi"),
        "pdrb": ("Ekonomi", "Ekonomi"),
        "pariwisata": ("Pariwisata", "Lainnya"),
        "kesehatan": ("Kesehatan", "Lainnya"),
        "pendidikan": ("Pendidikan", "Lainnya"),
        "perdagangan": ("Perdagangan", "Lainnya"),
        "transportasi": ("Transportasi", "Lainnya")
    }

    for key, val in category_map.items():
        if key in clean_q:
            return val

    if clean_q:
        cat_title = clean_q.title()
        return cat_title, cat_title

    return "Ekonomi", "Ekonomi"

def _classify_category(title, text, query=""):
    main_query_cat, query_group = _extract_main_category_from_query(query)

    if not title and not text:
        return main_query_cat

    title_lower = title.lower() if title else ""
    text_lower = text.lower() if text else ""

    scores = {}
    for subcategory, kw_list in KEYWORDS.items():
        score = 0
        for kw in kw_list:
            pattern = r'\b' + re.escape(kw.lower()) + r'\b'
            title_matches = len(re.findall(pattern, title_lower))
            score += title_matches * 50  # Title matches have dominant priority
            text_matches = len(re.findall(pattern, text_lower))
            score += text_matches

        scores[subcategory] = score

    best_cat = None
    max_score = 0
    for subcategory, score in scores.items():
        if score > max_score:
            max_score = score
            best_cat = subcategory

    if max_score > 0 and best_cat:
        return best_cat

    return main_query_cat

def search_google_news_rss(query, max_results=15):
    encoded_query = urllib.parse.quote(query)
    url = f"https://news.google.com/rss/search?q={encoded_query}&hl=id&gl=ID&ceid=ID:id"
    # Kegagalan di sini sengaja dibiarkan naik ke pemanggil: bila feed Google News
    # sendiri tidak dapat diambil, job harus melaporkan alasannya, bukan
    # mengembalikan daftar kosong yang terlihat seperti "tidak ada berita".
    response = fetcher.fetch(url, expect="any")

    try:
        root = ET.fromstring(response.content)
        articles = []
        for item in root.findall(".//item")[:max_results]:
            title = item.find("title").text if item.find("title") is not None else ""
            link = item.find("link").text if item.find("link") is not None else ""
            pub_date = item.find("pubDate").text if item.find("pubDate") is not None else ""
            source = item.find("source").text if item.find("source") is not None else ""

            clean_title = title
            if " - " in title:
                clean_title = " - ".join(title.split(" - ")[:-1])

            articles.append({
                "raw_title": title,
                "title": clean_title.strip(),
                "link": link,
                "pub_date": pub_date,
                "source_name": source
            })
        return articles
    except ET.ParseError as exc:
        raise ContentTypeError(
            "Balasan Google News bukan feed RSS yang valid: %s" % exc, url=url)

def _extract_article_content(item):
    rss_link = item.get("link", "")
    raw_title = item.get("title", "")
    pub_date = item.get("pub_date", "")
    query = item.get("_query", "")

    real_url = _resolve_google_news_link(rss_link)

    extracted_text = ""
    article_title = raw_title
    status = "rss_extracted"
    is_fallback = False
    error_code = None

    # Satu penerbit yang memblokir kita tidak boleh menggagalkan seluruh job --
    # judul dari RSS masih berguna sebagai catatan fenomena. Tetapi ALASAN
    # kegagalannya dicatat, supaya IPDS bisa melihat domain mana yang menolak
    # sistem ini alih-alih menebak-nebak.
    html = ""
    if "news.google.com" in (net_policy.domain_of(real_url) or ""):
        # Penerjemahan tautan gagal. Mengambil real_url di sini berarti mengunduh
        # halaman pembungkus milik Google -- judulnya "Google Berita", isinya
        # kosong, dan permintaannya sia-sia. Lebih baik jujur memakai cuplikan RSS.
        error_code = "GNEWS_UNRESOLVED"
        net_policy.add_warning(
            "Sebagian tautan Google News tidak dapat diterjemahkan ke URL penerbit, "
            "sehingga hanya cuplikan RSS yang tersedia (contoh: %s)." % rss_link,
            key="gnews-unresolved")
    else:
        try:
            response = fetcher.fetch(real_url, expect="html")
            html = response.text
        except ScraperError as exc:
            error_code = exc.code
            failing_domain = net_policy.domain_of(real_url) or real_url
            net_policy.add_warning(
                "%s: %s" % (failing_domain, exc.public_message()),
                key="publisher:%s:%s" % (failing_domain, exc.code))

    if html and NEWSPAPER_AVAILABLE:
        try:
            article = Article(real_url, language='id')
            # HTML disuplai dari fetcher, tidak diunduh ulang oleh newspaper,
            # agar tidak ada jalur jaringan yang lolos dari kebijakan kesopanan.
            article.set_html(html)
            article.parse()

            if article.text and article.text.strip():
                extracted_text = article.text.strip()
                if article.title and len(article.title) > 5:
                    article_title = article.title
        except Exception:
            extracted_text = ""

    if html and not extracted_text:
        try:
            soup = BeautifulSoup(html, 'html.parser')

            # Judul dari RSS Google News sudah berupa headline ("Judul - Penerbit"
            # yang sudah dibersihkan), sehingga tag <title> halaman penerbit hanya
            # dipakai bila RSS tidak memberi judul. Menimpanya justru merusak:
            # banyak portal menaruh nama situs di awal ("InfoPublik - ...") atau
            # memakai <title> generik, sehingga judul artikel berubah menjadi nama
            # situs.
            if not article_title:
                title_tag = soup.find('title')
                if title_tag and title_tag.text:
                    t_text = title_tag.text.strip()
                    if " - " in t_text:
                        t_text = " - ".join(t_text.split(" - ")[:-1]).strip()
                    if t_text:
                        article_title = t_text

            paragraphs = soup.find_all('p')
            extracted_text = "\n\n".join(
                [p.text.strip() for p in paragraphs if len(p.text.strip()) > 35])
        except Exception:
            extracted_text = ""

    extracted_text = _clean_text(extracted_text)

    # Fallback ke judul/snippet RSS bila isi artikel tidak bisa diambil (403,
    # Cloudflare, WAF, atau situs sedang bermasalah). Kode error disertakan agar
    # operator tahu ini bukan "berita tanpa isi", tetapi penolakan dari penerbit.
    if not extracted_text:
        extracted_text = raw_title
        status = "rss_snippet_fallback"
        is_fallback = True

    if len(extracted_text) > MAX_ARTICLE_TEXT_LENGTH:
        extracted_text = extracted_text[:MAX_ARTICLE_TEXT_LENGTH] + "\n... [content truncated]"

    summary = _extractive_summarize(extracted_text, num_sentences=3, title=article_title)
    if not summary:
        summary = raw_title

    category = _classify_category(article_title, extracted_text, query)

    return {
        "title": article_title or raw_title,
        "url": real_url,
        "summary": summary,
        "content": extracted_text,
        "category": category,
        "published_date": pub_date,
        "extraction_status": status,
        "is_fallback": is_fallback,
        "error_code": error_code
    }

def scrape(config_params):
    """
    Scrapes articles via Google News RSS and extracts their contents.
    Expected config_params:
    - query or keyword: Search keyword
    - max_results: (Optional) number of results to fetch (default 10)
    - domain_filter: (Optional) comma separated domains
    - ai_instruction: (Optional) Gemini AI prompt to filter/summarize
    - previously_scraped_urls: (Optional) list of URLs to skip
    """
    query = config_params.get("query") or config_params.get("keyword")
    if not query:
        raise ValidationError("Parameter 'query' atau 'keyword' wajib diisi.")

    domain_filter = config_params.get("domain_filter", "")
    if domain_filter:
        raw_domains = [d.strip() for d in str(domain_filter).split(',') if d.strip()]
        if raw_domains:
            site_query = " OR ".join([f"site:{d}" for d in raw_domains])
            query = f"{query} {site_query}"

    try:
        max_results = int(config_params.get("max_results", 10))
    except (ValueError, TypeError):
        max_results = 10

    if max_results > 25:
        max_results = 25

    previously_scraped_urls = set()
    raw_prev_urls = config_params.get("previously_scraped_urls") or config_params.get("_previously_scraped_urls") or []
    if isinstance(raw_prev_urls, list):
        for u in raw_prev_urls:
            if isinstance(u, str) and u:
                previously_scraped_urls.add(u.strip().rstrip('/'))

    # Kolam kandidat. Pelipatan tiga hanya diperlukan ketika penyaringan AI aktif,
    # karena penyaring itu membuang sebagian artikel. Tanpa instruksi AI, satu-satunya
    # penyaring adalah deduplikasi, sehingga melipatgandakan kolam berarti mengunduh
    # belasan artikel yang tidak akan pernah dipakai -- beban sia-sia bagi penerbit
    # dan sumber pemblokiran yang paling mudah dihindari.
    if config_params.get("ai_instruction"):
        candidate_pool_size = max(max_results * 3, 15)
    else:
        candidate_pool_size = max_results + 3
    rss_items = search_google_news_rss(query, max_results=candidate_pool_size + len(previously_scraped_urls) + 5)
    if not rss_items:
        return []

    items = []
    for item in rss_items:
        url_clean = (item.get("link") or "").strip().rstrip('/')
        if url_clean and url_clean in previously_scraped_urls:
            continue
        item["_query"] = query
        items.append(item)
        if len(items) >= candidate_pool_size:
            break

    if not items:
        return []

    # Parallel extraction
    final_results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=ARTICLE_WORKERS) as executor:
        futures = {executor.submit(_extract_article_content, item): item for item in items}
        for future in concurrent.futures.as_completed(futures):
            try:
                res = future.result()
                if res and res.get("url"):
                    url_clean = res["url"].strip().rstrip('/')
                    if url_clean not in previously_scraped_urls:
                        final_results.append(res)
                        previously_scraped_urls.add(url_clean)
            except Exception:
                pass

    # Optional AI Summarization & Relevancy Filtering
    ai_instruction = config_params.get("ai_instruction", "").strip()
    gemini_api_key = os.environ.get("GEMINI_API_KEY", "").strip()

    if (ai_instruction or gemini_api_key) and final_results:
        final_results = _filter_and_summarize_with_ai(final_results, query, ai_instruction, gemini_api_key)

    return final_results[:max_results]

def _filter_and_summarize_with_ai(final_results, query, ai_instruction, gemini_api_key):
    if not final_results:
        return []

    ai_instruction_clean = (ai_instruction or "").strip()
    key_clean = (gemini_api_key or "").strip()

    # Try Gemini REST API if key is present
    if key_clean:
        models = ["gemini-3.6-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash"]
        for res in final_results:
            title = res.get("title", "")
            raw_content = res.get("content", "")
            if not raw_content or len(raw_content) < 30:
                continue

            if ai_instruction_clean:
                instruction_text = f"Instruksi Filter Tambahan: {ai_instruction_clean}"
            else:
                instruction_text = "Fokus pada keakuratan topik utama berita terhadap query pencarian."

            prompt = f"""
Query Pencarian User: {query}
{instruction_text}

Judul Berita: {title}
Isi Berita:
{raw_content[:5000]}

Evaluasi apakah artikel berita di atas RELEVAN dengan Query Pencarian User dan Instruksi Filter di atas:
1. Jika TIDAK RELEVAN (misal: topik di luar query pencarian, atau melanggar instruksi filter user), jawab HANYA:
TIDAK RELEVAN

2. Jika RELEVAN, jawab dalam format:
RELEVAN: <ringkasan padat 2-3 kalimat mengenai poin utama berita tersebut>
"""
            success = False
            for m in models:
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={key_clean}"
                    payload = {"contents": [{"parts": [{"text": prompt}]}]}
                    r = requests.post(url, json=payload, timeout=12)
                    if r.status_code == 200:
                        data = r.json()
                        ai_out = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                        if "TIDAK RELEVAN" in ai_out.upper():
                            res["ai_filtered"] = True
                        elif ai_out.startswith("RELEVAN:"):
                            res["ai_filtered"] = False
                            res["summary"] = ai_out.replace("RELEVAN:", "").strip()
                        else:
                            res["ai_filtered"] = False
                            res["summary"] = ai_out
                        success = True
                        break
                except Exception:
                    pass

            if not success:
                _apply_rule_based_filter(res, query, ai_instruction_clean)
    else:
        for res in final_results:
            _apply_rule_based_filter(res, query, ai_instruction_clean)

    return [r for r in final_results if not r.get("ai_filtered", False)]

def _apply_rule_based_filter(res, query, ai_instruction):
    title = (res.get("title") or "").lower()
    content = (res.get("content") or "").lower()
    published_date = (res.get("published_date") or "").lower()
    combined = title + " " + content + " " + published_date

    ai_lower = ai_instruction.lower() if ai_instruction else ""
    query_lower = query.lower() if query else ""

    # 1. Year Relevancy Filter (e.g. Query specifies "2025")
    target_years = re.findall(r'\b(20\d{2})\b', query_lower)
    if target_years:
        has_year_in_pub_date = any(yr in published_date for yr in target_years)
        has_year_in_content = any(yr in (title + " " + content) for yr in target_years)

        # Require target year to be mentioned in published_date or title/content
        if not (has_year_in_pub_date or has_year_in_content):
            res["ai_filtered"] = True
            return

        # If user explicitly requested published date filtering in ai_instruction
        if "published date" in ai_lower or "tanggal terbit" in ai_lower or "tahun terbit" in ai_lower:
            if not has_year_in_pub_date:
                res["ai_filtered"] = True
                return

    is_agri_query = "pertanian" in ai_lower or "fenomena" in ai_lower or "pertanian" in query_lower

    if is_agri_query:
        # Filter out Macroeconomic Reports for agriculture-specific queries
        macro_kws = ["inflasi", "ihk", "pdrb", "daya beli", "pertumbuhan ekonomi", "indeks harga konsumen"]
        if any(kw in title for kw in macro_kws) or (res.get("category") == "Ekonomi" and any(kw in title for kw in macro_kws)):
            res["ai_filtered"] = True
            return

        # Filter out Ceremonial Handovers for agriculture-specific queries
        ceremony_kws = ["serahkan", "menyerahkan", "penyerahan bantuan", "serah terima", "penyerahan secara simbolis"]
        if any(kw in title for kw in ceremony_kws):
            res["ai_filtered"] = True
            return

    # Filter out Speeches / Sambutan / Pelantikan
    if "sambutan" in ai_lower or "pelantikan" in ai_lower or "pidato" in ai_lower or ("bukan" in ai_lower and "instansi" in ai_lower):
        speech_keywords = ["sambutan", "membawakan sambutan", "membuka secara resmi", "pelantikan", "mengukuhkan", "resmikan", "acara pelantikan"]
        if any(w in title for w in speech_keywords) or any(w in content[:400] for w in ["sambutan", "membawakan sambutan", "pelantikan"]):
            res["ai_filtered"] = True
            return

    # Require agricultural phenomena keywords for agriculture-specific queries
    if is_agri_query:
        fenomena_kws = [
            "panen", "gagal panen", "kemarau", "kekeringan", "hama", "penyakit", "bibit", 
            "pupuk", "tanam", "lahan", "irigasi", "produksi", "kebun", "sawah", "padi", 
            "jagung", "kelapa", "cengkeh", "cabai", "bawang", "ternak", "nelayan", "ikan", 
            "el nino", "krisis air", "curah hujan", "opt"
        ]
        if not any(kw in combined for kw in fenomena_kws):
            res["ai_filtered"] = True
            return

if __name__ == "__main__":
    pass
