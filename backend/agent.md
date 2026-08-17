# Agent Guide: Sistem Manajemen Scrapers

Dokumen ini adalah sumber arahan untuk agent dan developer yang mengerjakan proyek. Gunakan dokumen ini untuk menjaga implementasi tetap sesuai kebutuhan Sistem Manajemen Scrapers BPS dan mencegah scope proyek melebar.

## 1. Visi dan Masalah yang Diselesaikan

Proyek ini adalah Sistem Manajemen Scrapers untuk membantu pegawai BPS Provinsi mengambil data dari sumber eksternal secara terstruktur, terjadwal, terdokumentasi, dan mudah disajikan.

Contoh kebutuhan utama adalah mengambil data dari website BPS Pusat, kemudian menyajikannya secara ringkas dan mudah dipahami oleh Kepala BPS Provinsi.

Sistem harus memisahkan tanggung jawab berikut:

- Konfigurasi metode scraping.
- Definisi dan validasi parameter.
- Autentikasi ke sumber data jika diperlukan.
- Pembuatan dan eksekusi job.
- Penjadwalan job.
- Pencatatan status dan log.
- Penyimpanan serta penyajian hasil.

## 2. Prinsip Scope

MVP harus membuktikan tiga fondasi inti, bukan hanya membuat CRUD konfigurasi:

1. Sistem mendukung minimal dua metode scraping bisnis.
2. Scheduler dapat menjalankan job secara nyata, bukan hanya menyimpan cron expression.
3. Metode baru dapat ditambahkan melalui kontrak atau registry tanpa mengubah lifecycle job, scheduler, log, dan result.

Fitur yang tidak dibutuhkan untuk membuktikan tiga fondasi tersebut harus masuk backlog dan tidak dikerjakan dalam MVP.

## 3. Scope MVP

### 3.1 Fitur Wajib

MVP wajib mencakup:

- Login menggunakan JWT.
- Role minimal `admin` dan `operator`.
- Ownership konfigurasi, schedule, job, log, dan result.
- Manajemen metode scraping secara dinamis.
- Parameter dinamis berdasarkan metode scraping.
- Metode `target_url`.
- Metode `google_search` melalui API atau provider resmi.
- Target URL publik.
- Target URL dengan autentikasi yang aman.
- Minimal satu pola atau provider SSO yang benar-benar diprioritaskan berdasarkan target BPS yang nyata.
- Eksekusi job secara manual.
- Eksekusi job melalui scheduler.
- Validasi cron expression dan timezone.
- Pemulihan scheduler dari database setelah aplikasi restart.
- Pencegahan duplicate execution.
- Penyimpanan status, log, dan result.
- Timeout dan retry terbatas pada worker.
- Validasi URL dan perlindungan SSRF.
- Kontrak result worker yang konsisten.
- Registry atau adapter untuk penambahan metode baru.

### 3.2 Batas Implementasi Metode MVP

#### Metode `target_url`

Metode ini mengambil data dari URL yang telah ditentukan. MVP harus mendukung setidaknya:

- Halaman HTML publik.
- Endpoint API JSON resmi atau yang memiliki izin akses.
- Teknik ekstraksi CSS atau API JSON.
- Halaman dinamis melalui headless browser jika memang diperlukan oleh target yang diprioritaskan.
- Autentikasi berbasis API key atau bearer token jika dibutuhkan.
- Satu implementasi SSO atau browser session yang disepakati berdasarkan kebutuhan nyata.

Autentikasi target harus eksplisit melalui tipe autentikasi, misalnya:

```text
auth_type: none
auth_type: api_key
auth_type: bearer_token
auth_type: browser_session
auth_type: sso_<provider>
```

Jangan membuat login generik ke semua website. SSO harus diimplementasikan untuk provider atau pola yang jelas, disetujui, dan memiliki izin resmi.

#### Metode `google_search`

Metode ini mencari sumber data berdasarkan query. MVP harus menggunakan API atau provider resmi, bukan scraping langsung halaman hasil Google sebagai default.

Parameter minimum:

- Query pencarian.
- Domain filter, misalnya `bps.go.id`.
- Jumlah hasil maksimum.
- Bahasa atau wilayah jika provider mendukungnya.
- Rentang waktu jika provider mendukungnya.
- Field hasil yang disimpan.

API key provider harus disimpan melalui environment variable atau secret storage dan tidak boleh menjadi parameter biasa yang tampil pada response.

#### Metode `site_crawl`

`site_crawl` harus dipertimbangkan dalam desain registry agar dapat ditambahkan kemudian. Implementasi recursive crawling penuh bukan syarat MVP.

Fitur crawling berikut masuk fase lanjutan:

- Depth limit.
- Allowed domain.
- URL deduplication.
- Batas jumlah halaman.
- Rate limit per domain.
- Robots policy.
- Batas durasi eksekusi.

## 4. Istilah Domain

Bedakan metode bisnis dari teknik ekstraksi.

### Metode Bisnis

- `target_url`: mengambil data dari URL yang ditentukan.
- `google_search`: mencari sumber melalui provider pencarian resmi.
- `site_crawl`: menjelajahi halaman-halaman dalam domain yang diizinkan.

### Teknik Ekstraksi

- `css`: ekstraksi menggunakan CSS selector.
- `xpath`: ekstraksi menggunakan XPath.
- `regex`: ekstraksi menggunakan regular expression.
- `api`: ekstraksi response API JSON.
- `headless`: ekstraksi halaman dinamis menggunakan browser.

Contoh konfigurasi:

```text
Metode bisnis: target_url
Teknik: css
Autentikasi: none
Target: https://www.bps.go.id/...
Selector: table.data tbody tr
```

Pemisahan ini harus dipertahankan agar penambahan teknik ekstraksi tidak dianggap sebagai metode bisnis baru dan sebaliknya.

## 5. Alur Bisnis Utama

Alur utama sistem:

1. User membuka aplikasi dan melakukan login.
2. Sistem memvalidasi identitas dan role user.
3. User memilih metode scraping bisnis.
4. Sistem menampilkan parameter yang sesuai berdasarkan metode dan teknik yang dipilih.
5. User mengisi target, parameter ekstraksi, autentikasi, batas resource, dan output.
6. User memilih apakah konfigurasi dijalankan manual, terjadwal, atau keduanya.
7. Sistem memvalidasi konfigurasi dan menyimpannya secara atomic.
8. Eksekusi manual atau scheduler membuat job dengan status `pending`.
9. Executor mengambil job dan mengubah status menjadi `running`.
10. Executor menjalankan adapter atau worker metode yang sesuai.
11. Sistem menyimpan log dan result dengan kontrak yang konsisten.
12. Job diubah menjadi `success` atau `failed`.
13. User dapat melihat status, log, dan result sesuai ownership atau role.

Kegagalan satu job tidak boleh menghentikan server, scheduler, atau job lain.

## 6. Arsitektur Extensible

Penambahan metode scraping harus menggunakan registry, adapter, atau plugin contract. Lifecycle umum tidak boleh mengetahui detail internal setiap metode.

Setiap metode minimal memiliki metadata dan kemampuan berikut:

```text
ScrapingMethod
  - Code
  - Name
  - Description
  - Version
  - ParameterDefinitions
  - AuthenticationCapabilities
  - Validate(parameters)
  - Execute(context, parameters)
```

Metode baru idealnya hanya perlu:

1. Mendaftarkan metadata metode.
2. Mendefinisikan parameter dan validasinya.
3. Menentukan kemampuan autentikasinya.
4. Mengimplementasikan adapter atau worker.
5. Mengembalikan result contract standar.

Penambahan metode baru tidak boleh mengharuskan perubahan besar pada:

- Login dan ownership.
- Job lifecycle.
- Scheduler.
- Log.
- Result storage.
- Dashboard atau endpoint hasil.

Jangan membuat satu service besar dengan `if/else` khusus untuk setiap metode jika registry atau adapter dapat digunakan.

## 7. Kontrak Worker dan Result

Semua executor atau worker harus menerima konfigurasi yang tervalidasi dan mengembalikan JSON dengan bentuk konsisten.

Response sukses:

```json
{
  "status": "success",
  "method": "target_url",
  "results": [],
  "metadata": {
    "source": "https://example.com",
    "fetched_at": "2026-07-29T10:00:00Z",
    "item_count": 0
  },
  "error": null
}
```

Response gagal:

```json
{
  "status": "failed",
  "method": "google_search",
  "results": [],
  "metadata": {},
  "error": {
    "code": "TIMEOUT",
    "message": "Provider request timed out"
  }
}
```

Backend tidak boleh bergantung pada format khusus dari satu metode. Error harus dapat dibedakan setidaknya menjadi validation error, authentication error, timeout, rate limit, provider error, dan execution error.

## 8. Parameter dan Validasi

Parameter harus didefinisikan berdasarkan metode bisnis dan teknik ekstraksi. Parameter yang berlaku untuk satu metode tidak boleh otomatis dianggap berlaku untuk metode lain.

Parameter yang umum digunakan:

- `url`.
- `query`.
- `selector`.
- `xpath`.
- `regex`.
- `method`.
- `headers`.
- `query_params`.
- `body`.
- `json_path`.
- `auth_type`.
- `secret_reference`.
- `timeout`.
- `retry_count`.
- `max_results`.
- `output_format`.

Validasi minimal:

- Parameter wajib harus tersedia.
- Nama parameter harus terdaftar pada `ParameterDefinition`.
- Tidak boleh ada parameter duplikat.
- Tipe data harus benar.
- Nilai harus memenuhi aturan format, minimum, maksimum, dan panjang.
- Parameter autentikasi harus konsisten dengan `auth_type`.
- URL harus menggunakan scheme yang diizinkan dan lolos validasi SSRF.

`parameter_value` bertipe JSONB tidak otomatis aman untuk menyimpan secret. Bedakan parameter biasa, parameter sensitif, dan reference ke secret storage.

## 9. Autentikasi Target dan SSO

Tahapan dukungan autentikasi:

- MVP: website publik, API key, bearer token, dan satu pola SSO atau browser session yang diprioritaskan.
- Fase berikutnya: provider SSO tambahan berdasarkan kebutuhan nyata.
- Tidak didukung: login generik ke semua website, bypass CAPTCHA, bypass MFA, atau melewati access control.

Aturan keamanan:

- Scraping hanya boleh dilakukan terhadap sumber yang diizinkan organisasi dan user yang berwenang.
- Password, token, refresh token, cookie, dan session data tidak boleh ditulis di source code.
- Secret tidak boleh dikembalikan dalam API response atau log.
- Gunakan environment variable, secret manager, atau secret reference terenkripsi.
- Gunakan scope dan hak akses minimum.
- Gunakan integrasi resmi untuk SSO.
- Jangan menyimpan kredensial pribadi user jika service account atau integrasi resmi tersedia.
- Jangan memperpanjang masa hidup session tanpa kebutuhan yang jelas.

## 10. Scheduler dan Job Execution

Scheduler adalah fitur wajib MVP. CRUD schedule saja belum dianggap sebagai scheduler yang selesai.

Scheduler harus mampu:

- Menjalankan job manual.
- Menjalankan job berdasarkan cron expression.
- Memvalidasi cron expression.
- Memvalidasi dan menyimpan timezone.
- Mengaktifkan dan menonaktifkan schedule.
- Membaca ulang schedule aktif dari database saat aplikasi restart.
- Menghitung atau memperbarui `next_run`.
- Memastikan konfigurasi `inactive` tidak dieksekusi.
- Mencegah schedule yang sama membuat job duplikat.
- Mencegah eksekusi paralel yang tidak diizinkan.
- Mencatat error scheduler tanpa menghentikan schedule lain.
- Menggunakan service pembuatan job yang sama untuk eksekusi manual dan terjadwal.

Gunakan mekanisme locking atau aturan concurrency yang eksplisit. Jangan menganggap goroutine sederhana sebagai queue atau scheduler yang reliable.

## 11. Ownership dan Otorisasi

Operator hanya boleh mengakses konfigurasi, schedule, job, log, dan result miliknya sendiri. Admin dapat mengakses data lintas user sesuai kebutuhan operasional.

Aturan penting:

- Filter ownership diterapkan di service dan repository, bukan hanya di frontend.
- `GetAll`, `GetByID`, `Update`, dan `Delete` harus memvalidasi hak akses.
- Job harus memeriksa ownership konfigurasi terkait.
- Endpoint internal untuk update status job, log, dan result tidak boleh dapat dipanggil bebas oleh user biasa.
- Perubahan status oleh executor internal harus menggunakan jalur internal yang terautentikasi atau service internal.
- Jangan mempercayai `user_id` dari request body jika identitas tersedia dari JWT context.

## 12. Keamanan dan Reliability

Scraping harus dilaksanakan secara bertanggung jawab:

- Hormati `robots.txt`, rate limit, terms of service, dan kebijakan sumber data.
- Gunakan timeout, retry terbatas, dan backoff yang wajar.
- Batasi frekuensi job dan concurrency per target.
- Validasi URL sebelum request dibuat.
- Blokir localhost, loopback, private network, metadata endpoint, dan alamat internal yang tidak diizinkan untuk mencegah SSRF.
- Batasi ukuran response, jumlah halaman, jumlah hasil, dan durasi eksekusi.
- Simpan sumber data, waktu pengambilan, konfigurasi, dan identitas pembuat job.
- Hindari menyimpan data pribadi atau data sensitif yang tidak dibutuhkan.
- Redact secret dari exception, log, debugging, dan response.
- Worker harus memiliki timeout dan dapat dihentikan dengan aman.
- Error worker tidak boleh membuat proses HTTP utama berhenti.

Tidak boleh:

- Mengakses sistem tanpa otorisasi.
- Mengambil data dengan cara melewati access control.
- Menghindari CAPTCHA atau MFA.
- Menyimpan password atau token di repository.
- Menjalankan URL dari user tanpa validasi keamanan.
- Menggunakan data di luar kewenangan organisasi.

## 13. Arsitektur Proyek Saat Ini

Backend menggunakan Go dengan pola berlapis:

- `handler/`: HTTP controller dan parsing request.
- `service/`: business logic dan orkestrasi use case.
- `repository/`: akses database.
- `contract/`: interface antar-layer.
- `models/`: model domain dan relasi database.
- `dto/`: request, response, dan mapper.
- `routes/`: registrasi endpoint dan middleware.
- `middleware/`: autentikasi, otorisasi, dan CORS.
- `config/`: konfigurasi aplikasi dan environment.
- `internal/`: bootstrap server dan database.
- `workers/python/`: implementasi scraper dan entry point worker.
- `db/`: migration SQL Goose yang menjadi sumber resmi schema.

Komponen teknologi utama:

- Go.
- Gin.
- GORM.
- PostgreSQL.
- JWT.
- `robfig/cron`.
- Python.
- Requests, BeautifulSoup, lxml, Selenium, dan Playwright.

Implementasi saat ini memiliki worker Python yang dijalankan sebagai child process dari backend. Itu belum sama dengan distributed worker. Jika pekerjaan berjalan lama, tambahkan timeout, pembatas resource, lifecycle yang aman, dan mekanisme recovery sebelum memperkenalkan queue atau worker terpisah.

Metode worker Python yang sudah tersedia:

- `css_scraper.py`.
- `xpath_scraper.py`.
- `regex_scraper.py`.
- `api_scraper.py`.
- `headless_scraper.py`.

Worker dijalankan melalui:

```bash
python workers/python/worker.py <python_file> '<json_config_params>'
```

Worker yang sudah ada adalah teknik ekstraksi. Registry metode bisnis `target_url` dan `google_search` harus menjadi abstraksi yang menggunakannya, bukan menggandakan lifecycle job.

## 14. Entitas Domain dan Status

Entitas yang sudah tersedia:

- `User`: akun, email, password hash, dan role.
- `ScraperType`: metadata implementasi scraper.
- `ParameterDefinition`: parameter yang tersedia untuk scraper type.
- `ScrapingConfig`: konfigurasi scraping milik user.
- `ConfigParameter`: nilai parameter konfigurasi.
- `Schedule`: cron expression, timezone, status, dan waktu eksekusi berikutnya.
- `ScrapingJob`: satu eksekusi konfigurasi.
- `ScrapingLog`: catatan proses, warning, atau error.
- `ScrapingResult`: hasil data dari job.

Status job:

- `pending`: menunggu diproses.
- `running`: sedang diproses.
- `success`: selesai berhasil.
- `failed`: selesai gagal.

Status konfigurasi:

- `active`: dapat dieksekusi.
- `inactive`: tidak dapat dieksekusi.

Jika menambah state, dokumentasikan transisi yang valid dan tambahkan constraint atau validasi yang sesuai.

## 15. Endpoint dan Batas Internal

Kelompok endpoint aplikasi:

- `/auth`: register, login, dan user aktif.
- `/scraper-types`: metadata metode dan parameter.
- `/configs`: konfigurasi scraping.
- `/schedules`: konfigurasi jadwal.
- `/jobs`: status dan hasil job.
- `/dashboard`: ringkasan monitoring.
- `/profile`: profil user.
- `/users`: administrasi user untuk admin.

Aturan endpoint:

- Semua input harus divalidasi sebelum service dipanggil.
- Business logic kompleks tidak boleh berada di handler.
- Response harus menggunakan DTO dan format response yang konsisten.
- Field sensitif tidak boleh keluar dari API.
- Endpoint executor internal harus dipisahkan atau diamankan dari endpoint operator biasa.

## 16. Migration Database: Goose Wajib

Gunakan **Goose** sebagai satu-satunya migration tool proyek.

Aturan migration:

- File migration resmi berada di `db/`.
- Gunakan format Goose `-- +goose Up` dan `-- +goose Down`.
- Jangan menambahkan migration schema baru ke folder `sql/`.
- Jangan mengedit migration yang sudah berjalan di environment bersama.
- Setiap perubahan schema harus berupa file migration baru.
- Pastikan migration dapat dijalankan pada database kosong dan dapat di-rollback jika memungkinkan.
- Perhatikan urutan foreign key ketika membuat atau menghapus tabel.
- Tambahkan index dan constraint yang diperlukan untuk ownership, status, dan pencarian job.

Contoh perintah Goose:

```bash
goose -dir db postgres "$DB_URL" up
goose -dir db postgres "$DB_URL" status
goose -dir db postgres "$DB_URL" down
```

Jika proyek menggunakan executable Goose lokal, pastikan executable tersebut memakai folder `db/` yang sama. Jangan membuat dua sumber kebenaran migration.

## 17. Aturan Pengembangan

Saat mengubah proyek:

1. Periksa struktur dan pola kode sebelum mengedit.
2. Utamakan perubahan terkecil yang memenuhi use case.
3. Pertahankan pola handler-service-repository.
4. Tempatkan business logic di service.
5. Tempatkan query database di repository.
6. Perbarui interface di `contract/` jika menambah method.
7. Gunakan DTO untuk request dan response.
8. Validasi parameter berdasarkan definisi metode.
9. Gunakan transaction untuk operasi yang harus atomic, terutama konfigurasi dan parameter.
10. Gunakan konstanta status yang sudah tersedia.
11. Pertahankan kontrak JSON worker.
12. Jangan menaruh secret di source code, migration, test fixture publik, atau log.
13. Jangan memperkenalkan queue, distributed worker, atau abstraksi besar tanpa kebutuhan MVP yang jelas.
14. Buat test untuk business logic, validation, ownership, authorization, scheduler, dan worker parser ketika area tersebut berubah.
15. Jangan menghapus perubahan yang sudah ada di working tree milik user atau agent lain.
16. Hindari perubahan yang tidak terkait dengan task.

## 18. Feature Change Checklist

Setiap fitur baru harus menjelaskan:

- Use case yang diselesaikan.
- Role yang menggunakan fitur.
- Hubungan fitur dengan pengambilan, penjadwalan, monitoring, atau penyajian data BPS.
- Dampak terhadap model dan migration Goose.
- Endpoint yang diperlukan.
- Perubahan service, repository, contract, dan worker.
- Dampak terhadap registry metode.
- Risiko keamanan dan privasi.
- Test yang harus ditambahkan.
- Bagian yang sengaja tidak dikerjakan.

Jika fitur tidak membantu user mengambil, menjadwalkan, memantau, atau menyajikan data, masukkan ke backlog dan jangan langsung diimplementasikan.

## 19. Non-Goals MVP

Fitur berikut tidak termasuk implementasi penuh MVP:

- Recursive crawling tanpa batas.
- Crawling lintas domain tanpa allowlist.
- Scraping langsung halaman hasil Google sebagai pengganti API resmi.
- Dukungan semua provider SSO.
- Login otomatis generik ke semua website.
- Bypass CAPTCHA, MFA, atau access control.
- Distributed scraping cluster.
- RabbitMQ, Kafka, atau queue eksternal tanpa kebutuhan nyata.
- Real-time streaming.
- Pemrosesan big data atau data warehouse.
- AI summarization.
- Export PDF atau Excel.
- Notifikasi email, WhatsApp, atau channel eksternal.
- Multi-tenant lintas organisasi.
- Dashboard analitik kompleks.

`site_crawl` boleh disiapkan pada level kontrak dan registry, tetapi recursive crawling lengkap masuk fase setelah MVP.

## 20. Roadmap Terarah

### Fase 0: Fondasi

- Tetapkan model metode bisnis dan teknik ekstraksi.
- Tetapkan registry atau adapter contract.
- Tetapkan worker result contract.
- Tetapkan ownership dan internal executor boundary.
- Tetapkan Goose sebagai migration tool resmi.
- Tambahkan validasi parameter dan test dasar.

### Fase 1: MVP Target URL

- Implementasi metode `target_url`.
- Dukungan halaman publik dan API JSON.
- Teknik CSS dan API.
- Eksekusi manual.
- Penyimpanan result dan log.
- Timeout, batas output, dan retry terbatas.

### Fase 2: Scheduler MVP

- Cron runtime.
- Timezone.
- Reload schedule setelah restart.
- Pencegahan duplicate execution.
- Enable atau disable schedule.
- Jalur service yang sama untuk manual dan scheduled execution.

### Fase 3: Target URL dengan Authentication

- API key atau bearer token melalui secret reference.
- Browser session jika dibutuhkan.
- Satu integrasi SSO yang telah diprioritaskan dan memiliki izin resmi.
- Audit dan redaction secret.

### Fase 4: Google Search

- Pilih provider resmi.
- Simpan credential provider secara aman.
- Validasi query, domain, dan batas hasil.
- Normalisasi result.
- Terapkan rate limit dan penanganan quota.

### Fase 5: Site Crawl

- Depth limit.
- Allowed domain.
- URL deduplication.
- Robots policy.
- Rate limit per domain.
- Batas halaman, ukuran, dan durasi.

Fase tidak boleh dikerjakan paralel jika memiliki dependency. Fase berikutnya hanya dapat dimulai setelah gate fase sebelumnya diterima dan hasil verifikasinya dicatat.

## 21. Workflow Sesi Pengembangan Bergated

Pengembangan dilakukan dalam sesi-sesi terpisah. Satu sesi boleh menghasilkan beberapa perubahan teknis kecil hanya jika semuanya menyelesaikan satu scope yang sama. Jangan menggabungkan fitur dari fase berbeda dalam satu sesi.

Setiap sesi harus menghasilkan perubahan yang dapat diverifikasi. Sesi berikutnya tidak boleh dimulai hanya karena kode terlihat selesai secara lokal.

### 21.1 Status Sesi

Setiap sesi memiliki salah satu status berikut:

- `planned`: scope sudah ditentukan tetapi belum dikerjakan.
- `in_progress`: implementasi sedang berjalan.
- `verification`: implementasi selesai dan sedang diverifikasi.
- `accepted`: seluruh gate sesi lulus.
- `blocked`: dependency atau keputusan yang diperlukan belum tersedia.
- `rework`: verifikasi gagal dan sesi harus diperbaiki.

Hanya satu sesi yang boleh berstatus `in_progress` atau `verification` pada satu waktu untuk satu area kerja.

### 21.2 Langkah Wajib Setiap Sesi

Sebelum coding:

1. Tentukan nomor dan nama sesi.
2. Tulis tujuan bisnis yang spesifik.
3. Tentukan scope dan out of scope.
4. Tentukan dependency dari sesi sebelumnya.
5. Tentukan file, model, endpoint, worker, dan migration yang mungkin berubah.
6. Tentukan test dan acceptance gate.
7. Periksa perubahan worktree agar tidak menimpa pekerjaan user atau agent lain.

Saat coding:

1. Ubah hanya bagian yang dibutuhkan scope sesi.
2. Gunakan migration Goose jika schema berubah.
3. Pertahankan contract antar-layer dan worker.
4. Tambahkan atau perbarui test bersama implementasi.
5. Jangan mengerjakan fitur sesi berikutnya karena menemukan kebutuhan tambahan.
6. Masukkan kebutuhan tambahan ke backlog atau sesi baru.

Setelah coding:

1. Jalankan formatter dan static check yang tersedia.
2. Jalankan test unit terkait.
3. Jalankan test integration atau smoke test yang relevan.
4. Periksa migration dengan Goose jika ada perubahan schema.
5. Periksa ownership, secret, error handling, dan backward impact.
6. Catat command, hasil verifikasi, kegagalan, dan keputusan teknis.
7. Tandai sesi `accepted` hanya jika seluruh acceptance gate lulus.

Sesi berikutnya tidak boleh dimulai jika sesi saat ini masih `verification`, `blocked`, atau `rework`.

### 21.3 Template Sesi

Gunakan template berikut pada issue, pull request, atau catatan kerja:

```markdown
## Sesi <nomor>: <nama>

Status: planned
Fase: <fase roadmap>
Dependency: <sesi yang harus accepted>

### Tujuan
- <hasil bisnis yang ingin dicapai>

### Scope
- <perubahan yang boleh dikerjakan>

### Out of Scope
- <perubahan yang sengaja tidak dikerjakan>

### Perubahan yang Diperkirakan
- Model atau migration Goose:
- Contract atau DTO:
- Service atau repository:
- Handler atau route:
- Scheduler atau worker:
- Test:

### Acceptance Gate
- [ ] <kriteria yang dapat diverifikasi>
- [ ] <kriteria yang dapat diverifikasi>

### Verifikasi
- Command:
- Hasil:
- Catatan risiko:

### Keputusan Sesi
- Status akhir: accepted | rework | blocked
- Catatan:
```

### 21.4 Gate Antar-Sesi

- Baseline dan keputusan produk harus selesai sebelum fondasi teknis dimulai.
- Ownership tidak accepted jika test akses lintas user belum tersedia.
- Registry tidak accepted jika metode kedua belum dapat didaftarkan tanpa mengubah job lifecycle.
- Target URL tidak dilanjutkan ke scheduler sebelum eksekusi manual stabil.
- Authentication tidak dimulai sebelum secret handling dan target berizin ditetapkan.
- Google Search tidak dimulai sebelum provider resmi dan batas quota ditetapkan.
- Penyajian hasil tidak accepted jika ownership result belum aman.
- Release MVP tidak dilakukan sebelum semua gate MVP diterima.
- Fitur pasca-MVP tidak dimulai sebelum UAT MVP disetujui.

## 22. Urutan Sesi Implementasi Sampai Selesai

Urutan minimum berikut menjadi backlog resmi proyek:

1. **Sesi 0.1 - Baseline Repository dan Keputusan MVP**
   - Audit implementasi saat ini.
   - Tetapkan target uji BPS, provider Google, dan target authentication.
   - Output: baseline, gap list, dan acceptance scenario.
2. **Sesi 1.1 - Konsolidasi Goose dan Schema Baseline**
   - Tetapkan `db/` sebagai satu-satunya sumber migration.
   - Pastikan database kosong dapat dimigrasikan.
   - Output: schema baseline yang reproducible.
3. **Sesi 1.2 - Contract Job, Worker, dan Result**
   - Tetapkan status transition dan JSON result contract.
   - Output: contract test.
4. **Sesi 2.1 - Ownership dan Authorization**
   - Terapkan pembatasan admin/operator pada config, schedule, dan job.
   - Output: authorization test.
5. **Sesi 2.2 - Internal Executor Boundary**
   - Amankan update status, log, dan result dari user biasa.
   - Output: internal execution path.
6. **Sesi 3.1 - Registry Metode dan Parameter Dinamis**
   - Implementasikan registry, definisi parameter, dan validator.
   - Output: minimal dua metode terdaftar pada contract.
7. **Sesi 4.1 - Target URL HTML/CSS Manual**
   - Implementasikan Target URL untuk halaman HTML publik.
   - Output: job manual dengan result CSS.
8. **Sesi 4.2 - Target URL API JSON Manual**
   - Implementasikan API JSON dan normalisasi result.
   - Output: job manual dengan result API.
9. **Sesi 4.3 - Worker Reliability dan SSRF Protection**
   - Tambahkan timeout, output limit, retry, dan validasi URL.
   - Output: reliability dan security test.
10. **Sesi 5.1 - Scheduler Runtime Dasar**
    - Jalankan job dari schedule aktif.
    - Output: scheduled job.
11. **Sesi 5.2 - Scheduler Recovery dan Concurrency**
    - Tambahkan reload, `next_run`, lock, dan duplicate prevention.
    - Output: restart dan concurrency test.
12. **Sesi 6.1 - Secret Reference dan Target Authentication**
    - Tambahkan API key atau bearer token yang aman.
    - Output: authenticated target test.
13. **Sesi 6.2 - SSO Provider yang Diprioritaskan**
    - Implementasikan satu provider atau pola yang telah disetujui.
    - Output: SSO test dan security review.
14. **Sesi 7.1 - Google Search Provider**
    - Integrasikan provider resmi.
    - Output: manual Google Search result.
15. **Sesi 7.2 - Google Search Scheduler dan Quota Handling**
    - Gunakan scheduler umum dan tangani quota serta rate limit.
    - Output: scheduled search test.
16. **Sesi 8.1 - Result Presentation dan Dashboard MVP**
    - Tampilkan result, log, status, dan ringkasan.
    - Output: scenario penggunaan pegawai BPS.
17. **Sesi 9.1 - Integration, Security, dan Performance Hardening**
    - Jalankan test lintas komponen dan review keamanan.
    - Output: release candidate.
18. **Sesi 9.2 - UAT dan Perbaikan Release**
    - Jalankan acceptance scenario dengan pemilik kebutuhan.
    - Output: daftar issue release dan perbaikannya.
19. **Sesi 9.3 - Release MVP dan Handover**
    - Siapkan deployment, rollback, backup, monitoring, dan dokumentasi.
    - Output: MVP released dan runbook.
20. **Sesi 10.x - Fitur Pasca-MVP**
    - Mulai hanya berdasarkan backlog yang disetujui setelah MVP diterima.

Setiap sesi harus ditutup dengan status `accepted`, `rework`, atau `blocked`. Tidak boleh langsung mengerjakan nomor berikutnya hanya karena implementasi lokal terlihat berhasil.

## 23. Definition of Done MVP

MVP dianggap selesai jika semua kriteria berikut terpenuhi:

- User dapat login.
- Admin dan operator memiliki hak akses berbeda.
- Operator hanya dapat mengakses data miliknya.
- User dapat membuat konfigurasi `target_url`.
- User dapat membuat konfigurasi `google_search`.
- Parameter ditampilkan dan divalidasi secara dinamis.
- Target URL publik dapat dijalankan.
- Target URL dengan auth atau satu SSO yang disepakati dapat dijalankan secara aman.
- Google Search menggunakan API atau provider resmi.
- Job dapat dijalankan manual.
- Job dapat dijalankan melalui scheduler.
- Scheduler memulihkan schedule aktif setelah aplikasi restart.
- Duplicate execution dapat dicegah.
- Job berpindah secara valid dari `pending` ke `running`, lalu `success` atau `failed`.
- Log dan result dapat ditelusuri berdasarkan job.
- Worker memiliki timeout dan error handling.
- URL target tervalidasi dan SSRF protection diterapkan.
- Secret tidak muncul dalam response atau log.
- Penambahan metode baru tidak mengubah lifecycle scheduler, job, log, dan result.
- Migration berjalan melalui Goose.
- Test, formatting, migration check, dan build berhasil dijalankan.

## 24. Perintah Verifikasi

Siapkan environment lokal:

```bash
cp .env.example .env
```

Jalankan backend:

```bash
go run main.go
```

Jalankan test:

```bash
go test ./...
```

Format kode Go:

```bash
gofmt -w <file.go>
```

Periksa migration Goose:

```bash
goose -dir db postgres "$DB_URL" status
goose -dir db postgres "$DB_URL" up
```

Jalankan worker Python:

```bash
python workers/python/worker.py <python_file> '<json_config_params>'
```

## 25. Prinsip Keputusan Agent

Sebelum mengimplementasikan perubahan, agent harus:

- Membaca dokumentasi dan struktur kode terkait.
- Memastikan perubahan mendukung minimal satu use case MVP atau roadmap yang telah disetujui.
- Memilih desain paling sederhana yang tetap extensible.
- Tidak menganggap fitur yang belum ada sebagai fitur yang sudah selesai.
- Mempertimbangkan security, privacy, legalitas, rate limit, dan reliability.
- Menjaga kompatibilitas model, migration Goose, DTO, contract, service, repository, handler, route, scheduler, dan worker.
- Menjalankan verifikasi yang sesuai setelah perubahan.
- Melaporkan test atau verifikasi yang tidak dapat dijalankan beserta alasannya.
