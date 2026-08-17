# Panduan UAT (User Acceptance Testing) MVP

Dokumen ini berisi kriteria penerimaan (_acceptance criteria_) untuk **Sistem Manajemen Scrapers BPS**. Silakan uji fungsionalitas berikut di environment *Staging/Development* sebelum memutuskan perilisan *Production* (Sesi 9.3).

## 1. Otorisasi dan Kepemilikan (Sesi 2.1)
- [ ] Login sebagai **Admin**: Dapat melihat seluruh data dari *Dashboard*, *Jobs*, *Configs*, *Secrets*, dan *Schedules*.
- [ ] Login sebagai **Operator A**: Dapat membuat konfigurasi baru dan menjalankannya.
- [ ] Login sebagai **Operator B**: Tidak dapat melihat, menghapus, atau mengedit konfigurasi, job, dan jadwal milik **Operator A**.

## 2. Scraping Target URL (Sesi 3.1 & 4.3)
Buat Konfigurasi `target_url` melalui _endpoint_ `POST /configs`.
- [ ] **Test HTML Scraping:** Menggunakan target `https://example.com` dengan teknik `css` (selector: `h1`). Eksekusi job dan pastikan hasil berisikan teks "Example Domain".
- [ ] **Test Keyword Scraping:** Menggunakan target URL berita apa saja, teknik `keyword_find`, dan masukkan kata kunci tertentu. Pastikan job mereturn potongan paragraf yang mengandung kata kunci tersebut.
- [ ] **Test Proteksi SSRF:** Cobalah mengarahkan URL target ke `http://localhost:8080` atau `http://127.0.0.1`. Sistem harus memblokirnya saat divalidasi.

## 3. Web Search News / DuckDuckGo (Sesi 7.1)
Buat Konfigurasi dengan `method_code: google_search`.
- [ ] Menggunakan _query_ `Pertanian Sulawesi Utara`. Eksekusi secara manual (`POST /jobs`).
- [ ] Pastikan di dalam `results` *job endpoint* terdapat susunan _JSON_ dengan _keys_: `title`, `url`, `summary`, dan `content` (isi teks berita yang dibersihkan).
- [ ] Pastikan tidak ada _error library_ di log.

## 4. Keamanan Secret / Autentikasi (Sesi 6.1)
- [ ] Masukkan API Key / Token rekaan Anda ke `POST /secrets`. 
- [ ] Panggil konfigurasi `target_url` dengan `auth_type: bearer_token` dan merujuk ke ID secret tersebut.
- [ ] Secara sengaja, masukan URL *target* yang tidak bisa dijangkau agar eksekusi _Failed_.
- [ ] Buka log kegagalan job. Pastikan nilai token asli Anda TIDAK TAMPIL di log (tersensor menjadi `***REDACTED***`).

## 5. Scheduler Otomatis (Sesi 5.1 & 5.2)
- [ ] Buat jadwal untuk config dengan CRON ekspresi `*/1 * * * *` (setiap menit).
- [ ] Tunggu beberapa menit dan pastikan di dalam `GET /jobs`, terdapat catatan *job* baru yang terus dihasilkan sistem setiap menitnya tanpa _overlap_ beruntun (Concurrency Check berjalan).
- [ ] Matikan (disable) jadwal tersebut via `PUT /schedules/:id`. Pastikan sistem berhenti mencetak job.

---
### Catatan Penutup MVP (Release Handover)
Jika semua _check box_ di atas sudah bisa di centang pada UAT bersama *User*, maka seluruh fase fondasi MVP Sistem Scrapers BPS telah resmi **Selesai**. 

Segala fitur seperti pengunduhan data secara _native_ via `.xlsx` atau ringkasan menggunakan model Bahasa Buatan (AI ChatGPT Summarizer) masuk ke dalam jajaran _Post-MVP_ (_Backlog_) yang bisa dikembangkan secara fleksibel oleh Frontend dan Backend di masa yang akan datang.
