import warnings
import logging
import json
import re
import os
import urllib.parse
import xml.etree.ElementTree as ET
import concurrent.futures
import datetime
from email.utils import parsedate_to_datetime

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

# ---------------------------------------------------------------------------
# Gazetteer lokasi untuk penyaringan geografis
# ---------------------------------------------------------------------------
# Sistem ini khusus untuk BPS Provinsi Sulawesi Utara: ruang lingkup fenomena
# TERBATAS pada Sulawesi Utara dan kabupaten/kota di dalamnya. Karena itu ada
# dua kelompok:
#   * SULUT_REGIONS  -> satu-satunya lokasi target yang SAH untuk dicari.
#   * NON_SULUT_LOCATIONS -> kota/provinsi luar Sulut. Bukan target yang sah;
#     dipakai untuk (a) menolak query/instruksi yang menyebut lokasi luar Sulut,
#     dan (b) mengenali lokasi pesaing pada artikel.
# Setiap entri memetakan nama kanonik -> daftar varian kata kunci (huruf kecil)
# dan sengaja dibuat dapat diperluas bila cakupan wilayah bertambah.
SULUT_REGIONS = {
    "Kota Manado": ["manado"],
    "Kota Bitung": ["bitung"],
    "Kota Tomohon": ["tomohon"],
    "Kota Kotamobagu": ["kotamobagu"],
    "Kab. Minahasa": ["kabupaten minahasa", "tondano"],
    "Kab. Minahasa Utara": ["minahasa utara", "minut", "airmadidi", "likupang"],
    "Kab. Minahasa Selatan": ["minahasa selatan", "minsel", "amurang"],
    "Kab. Minahasa Tenggara": ["minahasa tenggara", "mitra", "ratahan", "tombatu"],
    "Kab. Bolaang Mongondow": ["bolaang mongondow", "bolmong", "lolak"],
    "Kab. Bolaang Mongondow Utara": ["bolaang mongondow utara", "bolmut", "boroko"],
    "Kab. Bolaang Mongondow Selatan": ["bolaang mongondow selatan", "bolsel", "bolaang uki"],
    "Kab. Bolaang Mongondow Timur": ["bolaang mongondow timur", "boltim", "tutuyan"],
    "Kab. Kepulauan Sangihe": ["sangihe", "tahuna"],
    "Kab. Kepulauan Talaud": ["talaud", "melonguane"],
    "Kab. Kepulauan Sitaro": ["sitaro", "siau", "tagulandang", "biaro", "ondong"],
    "Prov. Sulawesi Utara": ["sulawesi utara", "sulut"],
}

# Lokasi luar Sulut. Bila salah satu muncul sebagai target di query/instruksi,
# permintaan ditolak karena di luar ruang lingkup BPS Sulut.
NON_SULUT_LOCATIONS = {
    "DKI Jakarta": ["jakarta", "dki jakarta"],
    "Kota Surabaya": ["surabaya"],
    "Kota Bandung": ["bandung"],
    "Kota Semarang": ["semarang"],
    "Kota Medan": ["medan"],
    "Kota Makassar": ["makassar", "ujung pandang"],
    "Kota Palu": ["palu"],
    "Prov. Sulawesi Tengah": ["sulawesi tengah", "sulteng"],
    "Prov. Sulawesi Selatan": ["sulawesi selatan", "sulsel"],
    "Prov. Sulawesi Tenggara": ["sulawesi tenggara", "sultra"],
    "Prov. Sulawesi Barat": ["sulawesi barat", "sulbar"],
    "Prov. Gorontalo": ["gorontalo"],
    "Kota Kendari": ["kendari"],
    "Kota Yogyakarta": ["yogyakarta", "jogja", "yogya"],
    "Kota Denpasar": ["denpasar", "bali"],
    "Kota Balikpapan": ["balikpapan"],
    "Kota Samarinda": ["samarinda"],
    "Kota Ambon": ["ambon"],
    "Kota Jayapura": ["jayapura"],
}

# Gabungan untuk mendeteksi lokasi apa pun yang disebut dalam artikel (target
# maupun pesaing).
LOCATION_GAZETTEER = {**SULUT_REGIONS, **NON_SULUT_LOCATIONS}

# Lokasi yang muncul di potongan "Baca Juga" / tautan terkait sering menipu
# filter berbasis kata kunci. Frasa berikut menandai awal blok tersebut sehingga
# teks setelahnya diabaikan saat membentuk lede untuk pengecekan lokasi.
_RELATED_LINK_MARKERS = re.compile(
    r'(baca\s+juga|baca\s*:|simak\s+juga|lihat\s+juga|artikel\s+terkait|'
    r'berita\s+terkait|tautan\s+terkait|selengkapnya|topik\s+terkait|'
    r'download\s+kompastv|#\w+)',
    re.IGNORECASE
)


def _strip_related_blocks(text):
    """Buang baris "Baca Juga", tautan terkait, dan baris hashtag dari teks.

    Bagian-bagian ini kerap menyebut lokasi lain (mis. tautan "...di Manado"
    pada artikel yang sebenarnya membahas Bitung), sehingga menyesatkan filter
    lokasi maupun penilai LLM. Baris apa pun yang memuat penanda tautan terkait
    dibuang seluruhnya.
    """
    if not text:
        return ""
    kept = []
    for line in text.split('\n'):
        l = line.strip()
        if not l:
            continue
        if _RELATED_LINK_MARKERS.search(l):
            continue
        kept.append(l)
    return "\n".join(kept)


def _detect_locations_in_text(text, gazetteer=LOCATION_GAZETTEER):
    """Kembalikan himpunan nama kanonik lokasi yang disebut dalam teks.

    Pencocokan memakai batas kata agar "bitung" tidak cocok dengan substring
    yang lebih panjang, dan varian multi-kata (mis. "minahasa utara") diperiksa
    apa adanya. Gazetteer dapat dipersempit (mis. hanya Sulut, atau hanya luar
    Sulut) sesuai kebutuhan pemanggil.
    """
    if not text:
        return set()
    low = text.lower()
    found = set()
    for canonical, variants in gazetteer.items():
        for v in variants:
            if re.search(r'\b' + re.escape(v) + r'\b', low):
                found.add(canonical)
                break
    return found


def _detect_target_locations(query, ai_instruction):
    """Deteksi lokasi TARGET (khusus wilayah Sulut) dari query + AI Instruction.

    Mengembalikan tuple (set nama kanonik Sulut, set varian kata kunci). Bila
    kosong, berarti user tidak menyebut wilayah Sulut tertentu sehingga filter
    lokasi dilewati (tidak ada penyaringan geografis yang dipaksakan). Hanya
    wilayah di dalam Sulawesi Utara yang dianggap target sah -- lokasi luar
    Sulut ditangani terpisah oleh _detect_out_of_scope_locations.
    """
    combined = " ".join([query or "", ai_instruction or ""])
    canonicals = _detect_locations_in_text(combined, SULUT_REGIONS)
    variants = set()
    for c in canonicals:
        variants.update(SULUT_REGIONS.get(c, []))
    # Bila user menyebut provinsi Sulut secara umum, seluruh kabupaten/kota di
    # dalamnya dianggap sah sebagai target agar berita tingkat kota tetap lolos.
    if "Prov. Sulawesi Utara" in canonicals:
        for region_variants in SULUT_REGIONS.values():
            variants.update(region_variants)
    return canonicals, variants


def _detect_out_of_scope_locations(query, ai_instruction):
    """Kembalikan himpunan lokasi LUAR Sulut yang disebut di query/instruksi.

    Ruang lingkup sistem terbatas pada Sulawesi Utara, jadi penyebutan kota atau
    provinsi lain sebagai kriteria pencarian tidak sah dan permintaan harus
    ditolak sebelum scraping dijalankan.
    """
    combined = " ".join([query or "", ai_instruction or ""])
    return _detect_locations_in_text(combined, NON_SULUT_LOCATIONS)


def _build_location_lede(result):
    """Bentuk teks "lede" (judul + awal isi bersih) untuk pengecekan lokasi.

    Blok "Baca Juga"/tautan terkait dibuang lebih dulu, lalu diambil ~800
    karakter pertama. Artikel biasanya menegaskan lokasi utamanya di judul dan
    paragraf pembuka; menyebut kota lain jauh di bawah tidak menjadikannya
    tentang kota itu.
    """
    title = result.get("title") or ""
    body = _strip_related_blocks(result.get("content") or "")
    return (title + "\n" + body[:800]).lower()


def _passes_location_filter(result, target_canonicals, target_variants):
    """True bila artikel benar-benar membahas salah satu lokasi target.

    Aturan:
    - Lokasi target harus muncul di judul atau lede (bukan sekadar di ekor
      artikel / tautan terkait yang sudah dibuang).
    - Bila judul justru didominasi lokasi PESAING (lokasi non-target dari
      gazetteer) sementara target tidak ada di judul, artikel dianggap tentang
      kota lain dan ditolak -- inilah kasus "Bitung lolos karena menyebut
      Manado di Baca Juga".
    """
    if not target_canonicals:
        return True  # user tidak menentukan lokasi -> jangan menyaring

    title_low = (result.get("title") or "").lower()
    lede = _build_location_lede(result)

    target_in_title = any(
        re.search(r'\b' + re.escape(v) + r'\b', title_low) for v in target_variants
    )
    target_in_lede = any(
        re.search(r'\b' + re.escape(v) + r'\b', lede) for v in target_variants
    )

    # Lokasi target sama sekali tidak muncul di judul/lede -> bukan tentang
    # wilayah yang diminta.
    if not target_in_lede:
        return False

    # Judul menyebut lokasi lain (pesaing) tetapi tidak menyebut target ->
    # kemungkinan besar berita itu tentang kota lain.
    if not target_in_title:
        title_locations = _detect_locations_in_text(title_low)
        competing_in_title = title_locations - target_canonicals
        if competing_in_title:
            return False

    return True

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

def _parse_pub_date(pub_date_str):
    if not pub_date_str:
        return None
    try:
        dt = parsedate_to_datetime(pub_date_str)
        if dt:
            return dt.date()
    except Exception:
        pass
    try:
        match = re.search(r'(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+(\d{4})', str(pub_date_str), re.IGNORECASE)
        if match:
            day, month_str, year = match.groups()
            months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
            month = months.index(month_str.lower()[:3]) + 1
            return datetime.date(int(year), month, int(day))
    except Exception:
        pass
    return None

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

    # Ruang lingkup sistem terbatas pada Sulawesi Utara (BPS Prov. Sulut). Bila
    # query atau AI Instruction menyebut kota/provinsi di luar Sulut sebagai
    # kriteria, permintaan ditolak sejak awal -- tidak ada gunanya menarik
    # berita wilayah lain yang pasti di luar cakupan.
    ai_instruction_scope = config_params.get("ai_instruction", "") or ""
    out_of_scope = _detect_out_of_scope_locations(query, ai_instruction_scope)
    if out_of_scope:
        lokasi = ", ".join(sorted(out_of_scope))
        raise ValidationError(
            "Lokasi di luar ruang lingkup Sulawesi Utara terdeteksi pada query "
            "atau AI Instruction: %s. Sistem ini hanya mencakup Sulawesi Utara "
            "dan kabupaten/kota di dalamnya." % lokasi
        )

    domain_filter = config_params.get("domain_filter", "")
    if domain_filter:
        raw_domains = [d.strip() for d in str(domain_filter).split(',') if d.strip()]
        if raw_domains:
            site_query = " OR ".join([f"site:{d}" for d in raw_domains])
            query = f"{query} {site_query}"

    start_date_str = config_params.get("start_date")
    end_date_str = config_params.get("end_date")

    start_date_obj = None
    end_date_obj = None

    if start_date_str:
        try:
            start_date_obj = datetime.datetime.strptime(str(start_date_str).strip(), "%Y-%m-%d").date()
        except ValueError:
            raise ValidationError("Parameter 'start_date' harus berformat YYYY-MM-DD.")

    if end_date_str:
        try:
            end_date_obj = datetime.datetime.strptime(str(end_date_str).strip(), "%Y-%m-%d").date()
        except ValueError:
            raise ValidationError("Parameter 'end_date' harus berformat YYYY-MM-DD.")

    if start_date_obj and end_date_obj and start_date_obj > end_date_obj:
        raise ValidationError("Parameter 'start_date' tidak boleh setelah 'end_date'.")

    if start_date_obj:
        query = f"{query} after:{start_date_obj.strftime('%Y-%m-%d')}"
    if end_date_obj:
        next_day = end_date_obj + datetime.timedelta(days=1)
        query = f"{query} before:{next_day.strftime('%Y-%m-%d')}"

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
    # Deteksi lokasi target lebih awal: bila user meminta wilayah tertentu,
    # penyaringan geografis akan membuang sebagian besar kandidat, jadi kolam
    # perlu diperbesar agar hasil akhir tidak kering.
    ai_instruction_early = config_params.get("ai_instruction", "") or ""
    target_canonicals, target_variants = _detect_target_locations(query, ai_instruction_early)

    if target_canonicals:
        candidate_pool_size = max(max_results * 4, 20)
    elif config_params.get("ai_instruction"):
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

        # Filter tanggal publikasi
        pub_d = _parse_pub_date(item.get("pub_date"))
        if pub_d:
            if start_date_obj and pub_d < start_date_obj:
                continue
            if end_date_obj and pub_d > end_date_obj:
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

    # Penyaring lokasi deterministik. Berjalan lebih dulu dan TIDAK bergantung
    # pada LLM, sehingga permintaan wilayah user (mis. "hanya Manado") tetap
    # ditegakkan meski GEMINI_API_KEY tidak tersedia. Bila user tidak menyebut
    # lokasi mana pun, langkah ini tidak membuang apa-apa.
    if target_canonicals and final_results:
        final_results = [
            r for r in final_results
            if _passes_location_filter(r, target_canonicals, target_variants)
        ]

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

            # Buang blok "Baca Juga"/tautan terkait sebelum dikirim ke model.
            # Bagian itu sering menyebut kota lain dan membuat model salah menilai
            # lokasi utama berita.
            clean_content = _strip_related_blocks(raw_content)

            if ai_instruction_clean:
                instruction_text = f"Instruksi Filter Tambahan (WAJIB dipatuhi): {ai_instruction_clean}"
            else:
                instruction_text = "Fokus pada keakuratan topik utama berita terhadap query pencarian."

            prompt = f"""
Query Pencarian User: {query}
{instruction_text}

Judul Berita: {title}
Isi Berita:
{clean_content[:5000]}

Evaluasi apakah artikel berita di atas RELEVAN dengan Query Pencarian User dan Instruksi Filter di atas.

Aturan penilaian lokasi (penting):
- Jika Instruksi Filter menyebut wilayah/kota tertentu, artikel hanya RELEVAN bila wilayah itu adalah SUBJEK UTAMA berita (disebut di judul atau paragraf pembuka).
- ABAIKAN penyebutan kota pada bagian "Baca Juga", tautan terkait, atau daftar berita lain -- itu bukan topik utama.
- Jika berita utamanya membahas kota LAIN (mis. Bitung) meski sempat menyebut kota target, jawab TIDAK RELEVAN.

Jawaban:
1. Jika TIDAK RELEVAN (topik di luar query, lokasi tidak sesuai, atau melanggar instruksi filter), jawab HANYA:
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
