## Sesi 6.1: Secret Reference dan Target Authentication

Status: accepted
Fase: 6 - Authentication
Dependency: Sesi 5.2 (accepted)

### Tujuan

- Mengamankan proses scraping untuk target endpoint yang membutuhkan otentikasi (seperti API berbayar, atau halaman internal yang butuh login).
- Menghindari penyimpanan `API Key`, `Bearer Token`, `Basic Auth`, atau `Cookie` secara plain text di parameter konfigurasi yang mana berpotensi diekspos melalui API logs atau UI Frontend.
- Menerapkan mekanisme `Secret Reference`, di mana parameter konfigurasi hanya memuat ID Secret, dan backend akan me-resolve nilainya saat eksekusi worker.

### Scope

- Membuat tabel database `secrets` dan model untuk menyimpan *credential* dengan aman.
- Mendaftarkan entitas `Secret` ke dalam Go Layer (DTO, Repository, Service, dan Handler `POST /secrets`).
- Memperbarui `TargetURLMethod` agar mengenali parameter `auth_type` dan me-wajibkan parameter `secret_reference` apabila tipenya bukan `none`.
- Memperbarui `ScrapingJobService.executeJobAsync` untuk me-resolve rahasia dari `secretRepo` (bila parameter `secret_reference` ada) dan menyisipkan `_resolved_secret_value` ke parameter payload milik Python.
- Memperbarui Python Worker `api_scraper.py` untuk menerima Header Authorization via `_resolved_secret_value`.
- Memperbarui Python Worker `headless_scraper.py` (Playwright) untuk menerima *Cookie* via `_resolved_secret_value`.
- Meredact (menyensor) output exception log di `worker.py` agar token rahasia tidak bocor ke log seandainya terjadi error pada eksekusi.

### Out of Scope

- Enkripsi Secret-value saat *at rest* di dalam PostgreSQL (belum diperlukan untuk MVP, namun bisa menggunakan KMS / Env encryption key pada fase produksi).
- Single Sign-On (SSO) otomatis ke halaman portal BPS (dibahas di Sesi 6.2).

### Perubahan yang Dilakukan

- Model atau migration Goose:
  - `db/20260731000001_secrets.sql`: Membuat tabel `secrets` dengan FK `created_by` ke users.
  - `models/secret.go`: GORM model yang merujuk ke tabel `secrets`.
- Contract atau DTO:
  - `dto/secret_dto.go`: Struct untuk Request Create, Update, dan Response.
  - Memperbarui `contract/repository.go` dan `contract/service.go` dengan entitas `Secret`.
- Handler atau route:
  - `handler/secret_controller.go`: API REST endpoint CRUD untuk entitas Secret (dibatasi *ownership*-nya pada *service layer*).
  - `routes/routes.go`: Menambahkan endpoint protected grup `/secrets`.
- Service atau repository:
  - `service/secret_service.go` & `repository/secret_repository.go`: Implementasi standard business logic dengan filter Ownership (Admin bisa semua, Operator hanya miliknya).
  - `service/job_service.go`: Me-resolve nilai asli secret dan menginjeksinya ke dictionary parameter eksekusi.
- Python Worker:
  - `api_scraper.py`: Support `auth_type` berupa `api_key` (via header `x-api-key`) dan `bearer_token` (via header `Authorization: Bearer`).
  - `headless_scraper.py`: Support array Cookie Playwright apabila `auth_type` = `cookie`.
  - `worker.py`: Redact fungsi *error catch* agar teks *secret* diubah menjadi `***REDACTED***` di dalam hasil metadata.

### Acceptance Gate

- [x] Tabel `secrets` dibuat via Goose migration.
- [x] Endpoint `POST /secrets` dan endpoint terkait tersedia dan terlindungi oleh filter `ownership`.
- [x] `TargetURLMethod.Validate()` menolak parameter konfigurasi yang memiliki `auth_type != none` namun tidak menyertakan `secret_reference`.
- [x] Eksekusi worker tidak membocorkan credential (terverifikasi dari filter string `replace` di `worker.py`).
- [x] Tes integrasi modul Go (*TestTargetURLMethod_Validate/auth_valid_secret*) hijau (lulus).

### Verifikasi

- Command: `go test ./... -v`
- Hasil: Semua test pass (termasuk validasi auth secret).
- Command: `go build ./...`
- Hasil: Pass (build succesful).

### Keputusan Sesi

- Status akhir: accepted
- Catatan: Sistem sekarang dapat dengan aman merangkak atau memanggil API yang dilindungi. Target URL Autentikasi telah matang. Pada tahap berikutnya (Sesi 7.1), kita dapat membangun arsitektur Provider Khusus seperti Google Custom Search API.
