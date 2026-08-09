# Panduan Integrasi Frontend (MVP Scrapers BPS)

Dokumen ini adalah panduan lengkap bagi Developer Frontend (FE) mengenai fitur, endpoint, dan kapabilitas yang telah disediakan oleh Backend Golang untuk aplikasi Sistem Manajemen Scrapers BPS (MVP).

---

## 1. Fitur Utama yang Disediakan Backend

Backend telah menyediakan fungsionalitas berikut yang siap dihubungkan dengan UI:
1. **Otentikasi & Otorisasi:** Login JWT. Backend otomatis memfilter data (Configs, Jobs, Schedules) agar Operator hanya melihat miliknya sendiri, sementara Admin bisa melihat semua.
2. **Formulir Dinamis (Dynamic Form):** Backend menyediakan blueprint parameter via `/methods`. FE tidak perlu melakukan _hardcode_ form input.
3. **Penyimpanan Kredensial (Secret Vault):** Menyimpan API Key atau Cookie tanpa menampilkannya sebagai _plain text_.
4. **Eksekusi Sekali Klik (Shortcut):** Kemampuan untuk mengubah parameter dan langsung menjalankan _Job_ dalam satu panggilan API.
5. **Pemantauan Dashboard:** Endpoint statistik _real-time_ untuk merender grafik atau angka ringkasan di halaman utama.

---

## 2. Alur Penggunaan Dasar (UX Flow)

### Skenario A: Membuat dan Menjalankan Konfigurasi Web Search (DuckDuckGo News)
_Skenario Low-Code untuk mencari berita triwulan otomatis._
1. FE mengambil form blueprint: `GET /methods`
2. FE menampilkan form dengan isian `query`, `domain_filter`, `max_results`.
3. User mengisi form, FE mengirimkan `POST /configs` untuk menyimpannya.
4. User mengklik "Jalankan", FE memanggil `POST /configs/:id/run` (body kosong).
5. FE me-redirect user ke halaman detail Job dan melakukan _polling_ `GET /jobs/:id` setiap 3 detik hingga statusnya `success` atau `failed`.

### Skenario B: Ekstraksi Web Khusus (Target URL)
Metode `target_url` digunakan apabila pengguna ingin mengekstrak data dari satu situs web spesifik secara mendalam. Di metode ini, **Frontend wajib merancang dua opsi antarmuka (UX)** untuk mengakomodasi baik pengguna teknis maupun awam:

1. **Opsi Low Code (Keyword Search):** 
   - User hanya diminta menginputkan `url` situs web dan `keyword` (kata kunci yang dicari, misal: "Inflasi"). 
   - Frontend akan mengirim JSON dengan tipe ekstraksi `"technique": "keyword_find"`. Backend akan mengurus pencarian paragraf/tabel yang relevan dari situs tersebut secara otomatis.
2. **Opsi Interactive Click (Visual Selector / CSS):**
   - User memasukkan `url` situs web, lalu Frontend merender situs web tersebut di dalam layar aplikasi menggunakan *IFrame*. (Untuk merender web luar, FE harus memakai endpoint proksi backend `GET /proxy?url=...` agar tidak diblokir kebijakan *CORS Browser*).
   - Pengguna berinteraksi dengan pratinjau (preview) web tersebut: menggeser kursor dan **mengklik (point-and-click)** persis elemen data (teks/tabel/judul) mana yang mau diambil.
   - Frontend menangkap klik tersebut, secara otomatis men-generate teks *CSS Selector* (misal: `table#data > tr > td`), lalu menyimpannya. 
   - Frontend akan mengirim JSON ke backend dengan tipe ekstraksi `"technique": "css"` dan kolom `"selector": "hasil-generate-klik-tadi"`. Pengguna sama sekali tidak menyadari bahwa ia telah "mengkoding" sintaks CSS.
3. *Catatan Kredensial:* Jika web target mengharuskan *login* sebelum datanya bisa di-*scrape*, user sebelumnya harus menyimpan *Cookie* login-nya di menu `POST /secrets` lalu Frontend menyisipkan `secret_reference` ke form konfigurasi ini.

---

## 3. Daftar Endpoint API Esensial

Semua request wajib menyertakan header:
`Authorization: Bearer <TOKEN_JWT_ANDA>`
*(Kecuali `/auth/login`)*

### A. Otentikasi
- **`POST /auth/login`**
  - **Body:** `{"email": "admin@bps.go.id", "password": "..."}`
  - **Response:** `{"token": "..."}`

### B. Blueprint Metode (Form Generator)
- **`GET /methods`**
  - **Deskripsi:** Mendapatkan daftar metode scraping dan parameternya.
  - **Response:**
    ```json
    {
      "data": [
        {
          "code": "target_url",
          "name": "Target URL",
          "parameters": [
            { "Name": "url", "Label": "Target URL", "Required": true },
            { "Name": "technique", "Label": "Extraction Technique", "Required": true }
          ]
        },
        {
          "code": "google_search",
          "name": "Web Search (News)",
          "parameters": [
            { "Name": "query", "Label": "Search Query", "Required": true }
          ]
        }
      ]
    }
    ```

### C. Konfigurasi (Configs)
- **`GET /configs`** : Mengambil daftar konfigurasi (bisa dipasangkan Pagination).
- **`POST /configs`** : Membuat konfigurasi baru.
  - **Body Payload:**
    ```json
    {
      "name": "Berita Pertanian BPS",
      "method_code": "google_search",
      "status": "active",
      "parameters": [
        { "parameter_name": "query", "parameter_value": "Pertanian Sulut" },
        { "parameter_name": "auth_type", "parameter_value": "none" }
      ]
    }
    ```
- **`PUT /configs/:id`** : Mengubah parameter atau status.
- **`POST /configs/:id/run`** : *Jalan Pintas* -> Menjalankan job dari konfigurasi yang ada. Bisa dikirim dengan Body kosong `{}` atau dengan array `parameters` untuk meng-update parameter terlebih dahulu.

### D. Eksekusi & Riwayat (Jobs)
- **`GET /jobs?page=1&limit=10`** : Mengambil daftar riwayat Job.
- **`GET /jobs/:id`** : Melihat detail eksekusi. Di sini FE akan mendapatkan logs (error) atau results (data JSON hasil ekstraksi artikel).
  - **Status yang mungkin:** `pending`, `running`, `success`, `failed`.

### E. Penjadwalan (Schedules)
- **`GET /schedules`** : Daftar jadwal aktif.
- **`POST /schedules`** : Membuat penjadwalan.
  - **Body Payload:**
    ```json
    {
      "config_id": "UUID_CONFIG_DI_SINI",
      "cron_expression": "0 0 * * *", 
      "enabled": true
    }
    ```

### F. Dashboard & Proxy
- **`GET /dashboard/summary`** : Menampilkan angka `ActiveWorkers`, `RunningJobs`, `SuccessfulJobs`, dll. (Angka menyesuaikan hak akses pengguna).
- **`GET /proxy?url=https://example.com`** : Mem-bypass kebijakan CORS browser agar FE dapat merender HTML web target ke dalam Iframe.

---

## 4. Tips & Saran Implementasi untuk Frontend

1. **State Polling:** Backend Golang mengeksekusi Job di *background* (asynchronous). Ketika FE menembak `POST /configs/:id/run`, status job adalah `pending`. Terapkan fungsi `setInterval` di React/Vue Anda untuk memanggil `GET /jobs/:job_id` setiap 3-5 detik sampai status berubah menjadi `success` atau `failed`, baru tampilkan hasilnya.
2. **Dynamic UI:** Gunakan array parameter dari `GET /methods` untuk merender komponen form input secara looping. Jangan meng-*hardcode* form. Jika Backend kelak menambahkan metode baru (misalnya "Twitter Scraper"), UI Anda akan otomatis menyesuaikan tanpa perlu deploy ulang.
3. **Pencegahan Error Kredensial:** Di dalam konfigurasi, jika `auth_type` tidak sama dengan `none`, FE harus memastikan user memilih *Secret ID* dari daftar `GET /secrets` untuk dimasukkan ke parameter `secret_reference`.
4. **Data Ekspor (Excel/CSV):** Backend mereturn data hasil ekstraksi mentah dalam bentuk JSON (`results[].result_json`). Gunakan pustaka _Frontend_ (seperti `SheetJS` atau `xlsx` di NPM) untuk mengubah array JSON tersebut menjadi file tabel yang bisa diunduh langsung oleh pengguna.

---

## 5. MVP Essential Pages (Halaman Wajib Frontend)

Untuk membangun aplikasi web yang lengkap berdasarkan API Backend di atas, tim Frontend harus membangun daftar halaman antarmuka (UI) minimal berikut ini:

### A. Halaman Otentikasi (Login & Register)
- **Tujuan:** Pintu masuk sistem.
- **Komponen:** Form email dan password. 
- **Aksi:** Memanggil `/auth/login`, menyimpan JWT token di `localStorage` / `cookies`, lalu me-redirect user ke Dashboard.

### B. Halaman Dashboard (Beranda)
- **Tujuan:** Memberikan ringkasan cepat kepada user tentang status sistem scraping-nya saat ini.
- **Komponen:** 4 Kartu Angka (Card Metrics) dan tabel aktivitas terakhir.
- **Aksi:** Memanggil `GET /dashboard/summary` untuk merender jumlah `RunningJobs`, `SuccessfulJobs`, `FailedJobs`, dan `ActiveWorkers`. Jika user adalah Admin, sediakan menu tambahan di sidebar untuk "Manajemen User".

### C. Halaman Secrets Vault (Manajemen Kredensial)
- **Tujuan:** Tempat user menyimpan API Key, Token, atau Cookie rahasia mereka agar dapat dipakai berulang-ulang di berbagai konfigurasi.
- **Komponen:** Tabel daftar secret (menampilkan nama dan tipe, **jangan pernah** menampilkan `secret_value` kembali di tabel), tombol "Tambah Secret Baru", dan tombol Hapus.
- **Aksi:** Memanggil `GET /secrets` (tabel) dan `POST /secrets` (saat menambah kunci baru).

### D. Halaman Konfigurasi Scraping (Configs & Schedules)
- **Tujuan:** Inti (Core) dari aplikasi. Tempat user mendefinisikan apa yang mau mereka scrape dan jadwalnya.
- **Komponen:** 
  1. Daftar konfigurasi (Tabel berisi Nama Config, Metode, Status).
  2. **Wizard / Pembuat Config:**
     - Menampilkan dropdown "Metode Scraping" yang datanya ditarik dinamis dari `GET /methods`.
     - *Jika pilih Web Search:* Tampilkan input kata kunci.
     - *Jika pilih Target URL:* Sediakan 2 *Tab*, Tab "Low Code" (Keyword) dan Tab "Visual Selector" (IFrame Preview + Klik elemen untuk mengenerate CSS).
  3. Form penjadwalan (Scheduler) dengan dropdown pilihan waktu (Harian, Mingguan, dsb yang dikonversi ke Cron).
- **Aksi:** Memanggil `POST /configs`, `POST /schedules`, dan menyambungkan data dari `GET /methods`.

### E. Halaman Daftar Riwayat Job (Jobs History)
- **Tujuan:** Menampilkan riwayat eksekusi (seperti *Inbox* hasil scraping).
- **Komponen:** Tabel dengan paginasi berisi ID Job, Nama Config, Status (Pill Badge: Success/Failed/Pending), Waktu Mulai, Waktu Selesai.
- **Aksi:** Memanggil `GET /jobs?limit=15&page={currentPage}`. Memberikan tautan klik untuk melihat detail pada setiap baris.

### F. Halaman Detail Job (Hasil, Logs, & Downloader)
- **Tujuan:** Tempat pengguna melihat secara detail apa yang terjadi pada satu sesi scraping dan mengambil hasilnya.
- **Komponen:** 
  1. **Status Header:** Menampilkan info job.
  2. **Tab Logs (Terminal Preview):** Menampilkan daftar log proses dari Python (wajib untuk debugging jika status `Failed`).
  3. **Tab Results (Tabel Data):** Jika status `Success`, merender JSON hasil ekstrak artikel/teks ke dalam tabel HTML yang rapi.
  4. **Tombol "Download CSV / Excel":** Tombol melayang di atas tabel result.
- **Aksi:** 
  - Memanggil `GET /jobs/:id`.
  - Frontend menggunakan pustaka pengurai tabel (`SheetJS` atau `xlsx`) untuk mengkonversi nilai `results[].result_json` dari respons API menjadi file fisik `.xlsx` yang diunduh langsung ke komputer pengguna. Backend **tidak** menyediakan endpoint download file fisik, semua dikonversi via Frontend!

---

## Kesimpulan Implementasi
Jika 6 halaman esensial di atas berhasil Anda bangun dengan framework seperti React, Vue, atau Svelte, aplikasi *Sistem Manajemen Scrapers BPS* Anda sudah dapat diluncurkan ke *production* dan sepenuhnya *Low-Code* bagi pengguna awam.
