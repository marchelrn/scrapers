## Sesi 3.1: Registry Metode dan Parameter Dinamis

Status: accepted
Fase: 3 - Arsitektur Extensible (Fase 1: MVP Target URL)
Dependency: Sesi 2.2 (accepted)

### Tujuan

- Memisahkan "Metode Bisnis" (seperti `target_url`, `google_search`) dari "Teknik Ekstraksi" (seperti `css`, `xpath`, `api`).
- Menggantikan tabel database statis `scraper_types` dan `parameter_definitions` dengan implementasi registry `in-memory` di backend.
- Mendelegasikan eksekusi worker (sebelumnya di-hardcode di `job_service.go`) ke method-method ini.

### Scope

- Buat `pkg/registry` untuk `ScrapingMethod` dan `Registry`.
- Implementasi metode bisnis `target_url` di `pkg/registry/methods/target_url.go`.
- Buat file migration Goose untuk mengubah kolom `scraper_type_id` pada `scraping_configs` menjadi `method_code` (`VARCHAR(100)`).
- Menghapus ketergantungan pada model `ScraperType` dan `ParameterDefinition` di repositori, layanan, dan handler.
- Menambahkan handler baru `/methods` (untuk Frontend merender UI parameter secara dinamis).
- Memindahkan logic `exec.CommandContext` dari `job_service.go` ke `TargetURLMethod.Execute()`.

### Out of Scope

- Menambah metode Google Search atau Site Crawl (dikerjakan pada sesi berikutnya sesuai roadmap).

### Perubahan yang Dilakukan

- Model atau migration Goose:
  - Migration `db/20260730000002_add_method_code.sql` dibuat untuk menambahkan `method_code` dan me-nullable `scraper_type_id`.
  - Model `ScrapingConfig` dimodifikasi: menghapus `ScraperTypeID` dan menambahkan `MethodCode`.
  - Tabel dan Model `scraper_types` serta `parameter_definitions` telah di-deprecate dan dihapus dari GORM registry.
- Contract atau DTO:
  - DTO `CreateScrapingConfigRequest` diubah dengan mengganti `scraper_type_id` ke `method_code`.
  - DTO Mapper `scraper_type_dto.go` dan `parameter_definition_dto.go` dihapus.
- Service atau repository:
  - `job_service.go`: Menarik metode dari registry dengan `registry.Get().GetMethod()`, dan memanggil `method.Execute()`.
  - `config_service.go`: Saat membuat atau merubah config, parameter divalidasi menggunakan `method.Validate(paramMap)`.
- Handler atau route:
  - Menghapus endpoint `/scraper-types` dan menambahkan endpoint `/methods` melalui `handler/method_controller.go`.

### Acceptance Gate

- [x] Metode kedua bisa ditambahkan tanpa mengubah lifecycle job (`pkg/registry` pattern terimplementasi, job_service tidak lagi men-switch Python file secara hardcoded, melainkan memanggil `.Execute()`).
- [x] Endpoint `GET /methods` menampilkan daftar parameter per-metode.
- [x] Parameter divalidasi berdasarkan `method.Validate()` (misal, teknik `css` wajib ada `selector`).
- [x] Semua file Go build sukses (`go build ./...`).
- [x] Tes validasi Target URL lulus.

### Verifikasi

- Command: `go test ./...`
- Hasil: 3 paket yang dites PASS semua (`methods` test untuk validation logic, dan `service` test).
- Command: `go build ./...`
- Hasil: PASS.

### Keputusan Sesi

- Status akhir: accepted
- Catatan: Pola registry sudah mantap. `job_service` sudah tidak berurusan lagi dengan mendeteksi Python script mana yang harus berjalan.
