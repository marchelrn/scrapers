# Sistem Manajemen Scrapers BPS

Repositori ini terdiri dari 2 bagian utama:

```
scrapers/
├── backend/     # Aplikasi Go (Gin) API Server & Python Workers
└── frontend/    # Aplikasi React 19 + Vite + Tailwind CSS Web Platform
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
* API Server akan berjalan di `http://localhost:8080`

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
