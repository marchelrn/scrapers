# Sistem Manajemen Scrapers BPS

## 1. Deskripsi Singkat Project
Sistem Manajemen Scrapers adalah aplikasi *Backend-as-a-Service* (BaaS) berbasis Golang dan Python yang dikembangkan khusus untuk instansi Badan Pusat Statistik (BPS). Sistem ini bertujuan untuk membantu pegawai BPS mengambil data dari sumber eksternal (website berita, portal statistik, API publik) secara terstruktur, terjadwal otomatis (Cron), terdokumentasi, dan bebas hambatan koding kompleks (*Low-Code*).

Sistem ini mendukung fitur *Smart Extraction* tanpa bergantung pada kunci API berbayar (memanfaatkan DuckDuckGo News Search), ekstraksi CSS/XPath langsung, *Bypass Anti-Bot*, penyimpanan kredensial rahasia (*Secret Vault*), dan penjadwalan konkuren yang kokoh.

## 2. Tech Stack yang Digunakan
Sistem ini menggunakan arsitektur pemisahan *Executor Worker* (Python) yang dikendalikan oleh *Backend Orchestrator* (Golang).
*   **Bahasa Pemrograman:** Golang 1.25+, Python 3.10+
*   **Framework Web (Go):** Gin Web Framework
*   **ORM (Go):** GORM (PostgreSQL Driver)
*   **Database Migration:** Goose (`github.com/pressly/goose`)
*   **Penjadwalan (Scheduler):** Robfig Cron v3
*   **Keamanan (Auth):** JSON Web Token (JWT)
*   **Python Worker Libraries:**
    *   `requests` (HTTP Client)
    *   `beautifulsoup4` (HTML Parser & Cleaner)
    *   `duckduckgo-search` (`ddgs` untuk pencarian berita otomatis tanpa API Key)
    *   `playwright` (Untuk mode ekstrak *headless browser*)

## 3. Daftar Endpoint API Utama
Sistem dilindungi otorisasi JWT bertipe *Bearer*. Setiap endpoint (kecuali `/auth`) wajib menyertakan _header_:
`Authorization: Bearer <TOKEN_JWT_ANDA>`

### A. Authentication (`/auth`)
*   `POST /auth/login` : Mendapatkan Token JWT.
    *   **Payload:** `{"email": "admin@bps.go.id", "password": "pass"}`
    *   **Response:** `{"token": "eyJhbG..."}`

### B. Scraping Configuration (`/configs`)
*   `POST /configs` : Membuat Konfigurasi (Blueprint) Scraping baru.
    *   **Payload (Google Web Search Mode):**
        ```json
        {
          "name": "Berita Pertanian Sulut",
          "method_code": "google_search",
          "status": "active",
          "parameters": [
            { "parameter_name": "query", "parameter_value": "Pertanian Sulawesi Utara" },
            { "parameter_name": "auth_type", "parameter_value": "none" }
          ]
        }
        ```
    *   **Response (201 Created):** Mengembalikan JSON Config lengkap beserta `id` (UUID).

*   `POST /configs/:id/run` : *(Shortcut)* Update parameter kueri dan langsung eksekusi scraping job.
    *   **Payload:** `{"parameters": [{"parameter_name": "query", "parameter_value": "Inflasi Mei 2026"}]}`
    *   **Response:** Data *Job* baru yang di-_dispatch_.

### C. Jobs Execution (`/jobs`)
*   `POST /jobs` : Memicu eksekusi manual pada suatu konfigurasi.
    *   **Payload:** `{"config_id": "<UUID_CONFIG>"}`
*   `GET /jobs/:id` : Melihat status dan hasil (*Results* & *Logs*) scraping dari eksekusi worker Python.
    *   **Response (Jika Sukses):**
        ```json
        {
          "status": "success",
          "results": [
            {
              "result_json": {
                "status": "success",
                "method": "google_search",
                "results": [
                  {
                    "title": "Produksi Beras Naik",
                    "url": "https://bps.go.id/berita1",
                    "content": "Isi teks bersih tanpa HTML..."
                  }
                ],
                "metadata": { "item_count": 1 }
              }
            }
          ]
        }
        ```

### D. Scheduler (`/schedules`)
*   `POST /schedules` : Membuat jadwal agar sistem mengeksekusi Job otomatis.
    *   **Payload:**
        ```json
        {
          "config_id": "<UUID_CONFIG>",
          "cron_expression": "*/5 * * * *", 
          "enabled": true
        }
        ```

### E. Secret Vault (`/secrets`)
*   `POST /secrets` : Menyimpan Token/Cookie/API Key ke sistem dengan aman.
    *   **Payload:** `{"name": "API BMKG", "secret_type": "api_key", "secret_value": "123XYZ"}`

*(Catatan: Operator hanya dapat mengakses/mengubah Config, Schedule, dan Job yang dibuatnya sendiri. Admin dapat melihat semuanya.)*

---

## 4. Environment Pengembangan (Prerequisites)
Sebelum menjalankan proyek di laptop / server Anda, pastikan beberapa infrastruktur berikut telah terpasang:
1. **Golang** (versi 1.22 atau lebih baru).
2. **Python 3** (versi 3.9 atau lebih baru) beserta `pip` dan modul `venv`.
3. **PostgreSQL** (Bisa di-install lokal, menggunakan Docker Compose, atau via Cloud seperti Supabase).
4. **Goose** (Global Go module) untuk menjalankan migrasi skema database. `go install github.com/pressly/goose/v3/cmd/goose@latest`.

---

## 5. Cara Menjalankan Project

### Langkah 1: Setup Environment File
Salin file `.env.example` ke `.env` lalu sesuaikan isinya.
```bash
cp .env.example .env
```
*(Sesuaikan blok `DB_HOST` jika menggunakan DB Lokal, atau isikan `DB_URL` bila terkoneksi ke Supabase).*

### Langkah 2: Setup Python Virtual Environment (Wajib)
Sistem Golang akan memanggil interpreter Python di dalam `venv` untuk menjalankan worker.
```bash
# Pindah ke direktori worker Python
cd workers/python

# Buat Virtual Environment
python3 -m venv venv

# Aktifkan (Linux/MacOS)
source venv/bin/activate
# Aktifkan (Windows)
# venv\Scripts\activate

# Install Library Kebutuhan Scraper
pip install -r requirements.txt
# (Atau jika manual: pip install requests beautifulsoup4 ddgs playwright)

# Kembali ke root folder
cd ../../
```

### Langkah 3: Migrasi Database
Pastikan seluruh tabel terbentuk dengan mengeksekusi `goose up` di direktori `db/`.
```bash
# Jika Anda menginstall Goose secara global:
goose -dir db postgres "postgresql://user:password@host:port/dbname?sslmode=disable" up

# Atau menggunakan go run (pastikan DB_URL sesuai dengan .env):
go run github.com/pressly/goose/v3/cmd/goose@latest -dir db postgres "$DB_URL" up
```
*(Baca panduan spesifik Supabase di `docs/SETUP_MIGRATION.md` untuk rincian konfigurasi port Pooler).*

### Langkah 4: Jalankan Backend (Golang Runner)
Jalankan file utama dari *root* folder.
```bash
# Menjalankan server dalam mode development
go run main.go

# (Opsional) Menggunakan Air untuk Live Reload
air
```

Sistem akan otomatis me-_recover_ Job yang *stuck* dan mengaktifkan mesin *Scheduler* (Cron) di background. API siap diakses pada `http://localhost:8080`!
