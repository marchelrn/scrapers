# Panduan Setup dan Migrasi Database (Goose & Supabase)

Dokumen ini berisi panduan lengkap untuk mengatur konfigurasi lingkungan (Environment Variables) dan menjalankan migrasi database proyek Sistem Manajemen Scrapers BPS. 

Sistem ini didesain menggunakan PostgreSQL. Anda bisa menjalankannya di Localhost (Docker/PGAdmin) maupun di layanan Cloud seperti **Supabase**. Alat migrasi resmi yang digunakan proyek ini adalah **Goose**.

---

## 1. Persiapan Konfigurasi (`.env`)

Sebelum menjalankan aplikasi, salin file `.env.example` menjadi `.env`.

```bash
cp .env.example .env
```

### Penjelasan Variabel Database di `.env`:

Backend Golang (`config/config.go`) dirancang untuk membaca konfigurasi database berdasarkan mode jalannya aplikasi (`GIN_MODE`):

*   **Mode Development (`GIN_MODE=debug`):**
    Aplikasi akan membaca `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, dan `DB_SSLMODE` satu per satu. Sangat cocok jika Anda memiliki PostgreSQL lokal yang jalan di komputer Anda.
    
*   **Mode Production (`GIN_MODE=release` atau `production`):**
    Aplikasi akan **mengabaikan** `DB_HOST/PORT/USER` dan hanya akan membaca **`DB_URL`** secara utuh. Jika `DB_URL` kosong saat aplikasi berjalan di mode rilis, aplikasi akan crash (_fatal error_).
    
#### Contoh Supabase Connection String (`DB_URL`)
Format koneksi Supabase yang direkomendasikan adalah *Transaction Pooler* (Port 6543) karena ini kompatibel dengan jaringan IPv4:
```text
DB_URL="postgresql://postgres.[ID_PROYEK_ANDA]:[PASSWORD_ANDA]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

---

## 2. Cara Menjalankan Migrasi Database

Anda memiliki 2 cara untuk menjalankan migrasi ini, melalui _Goose CLI_ atau via instalasi Go murni (_go run_).

### Cara A: Menggunakan Goose CLI (Disarankan)
Jika Anda sudah menginstal Goose secara global di komputer Anda (`go install github.com/pressly/goose/v3/cmd/goose@latest`), gunakan perintah ini:

**Cek Status Migrasi:**
```bash
goose -dir db postgres "postgresql://user:password@host:port/dbname" status
```

**Terapkan Migrasi (UP):**
```bash
goose -dir db postgres "postgresql://user:password@host:port/dbname" up
```
*(Ganti parameter connection string di atas dengan `DB_URL` Supabase atau Lokal Anda).*

### Cara B: Menggunakan Go Run (Tanpa Instalasi Global)
Jika Anda tidak mau menginstal Goose secara global, Anda bisa menyuruh Go untuk mengunduh dan menjalankannya sementara:

**Cek Status Migrasi:**
```bash
go run github.com/pressly/goose/v3/cmd/goose@latest -dir db postgres "DB_URL_ANDA_DISINI" status
```

**Terapkan Migrasi (UP):**
```bash
go run github.com/pressly/goose/v3/cmd/goose@latest -dir db postgres "DB_URL_ANDA_DISINI" up
```

---

## 3. Catatan Khusus Saat Migrasi ke Supabase

### A. Gunakan Port 6543 (Pooler IPv4)
Supabase generasi terbaru secara default hanya menyediakan koneksi langsung (Port 5432) melalui IPv6. Karena banyak ISP (Internet Service Provider) Indonesia yang belum mendukung IPv6 penuh, koneksi langsung Anda mungkin _Timeout_ atau _ENOTFOUND_.
Oleh karenanya, selalu gunakan _Connection String_ bertuliskan **Pooler** dengan port **6543**.

### B. Session Mode vs Transaction Mode
Ketika Anda mendaftarkan koneksi Pooler di Dashboard Supabase, Anda memiliki opsi mode. Sebagian besar *migration tool* yang mengeksekusi DDL (`CREATE TABLE`, `ALTER TABLE`) membutuhkan **Session Mode**. 
Jika perintah `goose up` di Supabase gagal dengan *error schema*, pastikan koneksi Pooler Anda di-setting ke Session Mode (atau tambahkan parameter `?pgbouncer=true&connection_limit=1` pada ujung URL bila diperlukan oleh driver Go).

---

## 4. Reset & Rollback (Development Only)
Jika skema database terasa berantakan selama masa pengembangan dan Anda ingin me-reset (rollback) satu langkah:

```bash
goose -dir db postgres "DB_URL_ANDA_DISINI" down
```

Untuk menghapus bersih database dan memulai dari nol (HATI-HATI):
```bash
goose -dir db postgres "DB_URL_ANDA_DISINI" reset
goose -dir db postgres "DB_URL_ANDA_DISINI" up
```

Setelah Anda mengeksekusi perintah `up` dan berhasil, tabel `scraping_configs`, `scraping_jobs`, `secrets`, `schedules` dll siap untuk diakses oleh Backend API Scraper BPS ini.
