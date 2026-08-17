## Sesi 7.1: DuckDuckGo Web Search Provider

Status: accepted
Fase: 7 - Search Provider (Revisi)
Dependency: Sesi 6.1 (accepted)

### Tujuan

- Menyediakan metode pencarian berita otomatis yang murni *free* (gratis) dan tidak bergantung pada kuota harian atau *setup* tagihan akun Google Cloud Platform, sebagai respon atas restriksi HTTP 403 / 400.
- Menghasilkan ekstraksi data yang kaya tanpa membebani _end-user_ dengan keharusan memasukkan _credentials_ atau URL spesifik.

### Scope

- Ubah `GoogleSearchMethod` di Golang menjadi metode berbasis DuckDuckGo.
- Ganti parameter *Google-specific* (`cx`, `auth_type`, `secret_reference`) menjadi parameter umum untuk mesin penelusur (`query`, `domain_filter`, `max_results`).
- Terapkan library `duckduckgo_search` (versi terbaru `ddgs`) pada worker Python `google_search_scraper.py`.
- Terapkan fungsi pembersihan (sanitasi) peringatan dan log stdout pada worker Python agar *warning* library pihak ketiga tidak merusak bentuk (format) JSON yang dikembalikan ke eksekutor Golang.
- Terapkan ekstraksi `BeautifulSoup` yang mengambil elemen teks yang berarti dari artikel URL yang ditemukan oleh DDG.

### Out of Scope

- Mempertahankan integrasi Google Custom Search API yang bermasalah dengan akun milik instansi saat fase MVP ini.

### Perubahan yang Dilakukan

- Registry (Go):
  - `pkg/registry/methods/google_search.go`: Diganti namanya di dalam string balasan menjadi `"Web Search (News)"`. Kebutuhan otorisasi parameter ditiadakan.
  - `pkg/registry/methods/google_search_test.go`: Disesuaikan dengan validasi *no-auth*.
- Worker (Python):
  - `workers/python/google_search_scraper.py`: Mengimpor `DDGS` dan fungsi *iterator slicing* (`islice`) untuk berinteraksi dengan API internal DuckDuckGo. Bila *News Search* diblokir (Ratelimit/Kosong), skrip akan mencoba jalur mundur (fallback) ke *Text Search* standar.
  - Mematikan `warnings.filterwarnings('ignore')` dan mengubah *level logging* agar format `JSON dumps` murni tersaji.

### Acceptance Gate

- [x] Worker bisa mengambil pencarian tanpa adanya variabel lingkungan eksternal (API Key).
- [x] Skrip Python mengeluarkan bentuk JSON utuh meskipun *library* memancarkan *warning*.
- [x] Backend *Go* dan *Python* lulus unit test.

### Verifikasi

- Command: `python workers/python/worker.py google_search_scraper.py '{"query": "Pertanian Sulawesi Utara", "max_results": "3"}'`
- Hasil: 3 Berita terkait didapatkan langsung dari BPS Sulut dan Pertanian Sulut dengan status 200 OK.

### Keputusan Sesi

- Status akhir: accepted
- Catatan: Mengganti ke DuckDuckGo adalah solusi terbaik untuk MVP karena langsung memberikan fungsi *"Low Code Search"* yang diminta klien tanpa proses penyetelan kredensial yang rentan salah (error-prone). Kita dapat kembali merestorasi _Google Search API_ di masa depan bila akun resmi dan penagihan institusi telah disiapkan dengan matang.
