## Sesi 4.3: Worker Reliability dan SSRF Protection

Status: accepted
Fase: 4 - Target URL
Dependency: Sesi 3.1 (accepted)

### Tujuan

- Menambahkan validasi URL dan perlindungan SSRF pada sisi Go dan Python.
- Menambahkan output size limit pada worker result.
- Menambahkan retry terbatas pada worker execution.
- Menerapkan atomic transaction untuk pembuatan config + parameter.

### Scope

- Implementasi SSRF protection di Go (`pkg/urlvalidator`) dan Python (`workers/python/url_validator.py`).
- Integrasi SSRF validation di `TargetURLMethod.Validate()` dan `worker.py`.
- Output size limit 5MB di `TargetURLMethod.Execute()`.
- Retry hingga 2 kali (total 3 attempt) dengan backoff di `TargetURLMethod.Execute()`.
- Atomic transaction `CreateWithParams` di `ConfigRepository`.
- Unit test untuk SSRF validator (Go dan integrasi ke TargetURL).

### Out of Scope

- DNS rebinding protection (memerlukan custom HTTP transport).
- Rate limiting per domain (akan dikerjakan di Sesi 5.x atau setelahnya).

### Perubahan yang Dilakukan

- Contract:
  - `contract/repository.go`: Tambah method `CreateWithParams` pada `ScrapingConfigRepository`.
- Repository:
  - `repository/config_repository.go`: Implementasi `CreateWithParams` menggunakan `db.Transaction()` GORM.
- Service:
  - `service/config_service.go`: Gunakan `CreateWithParams` untuk atomic config + params creation.
- Registry Method:
  - `pkg/registry/methods/target_url.go`: Tambah SSRF check via `urlvalidator.Validate()` di `Validate()`. Tambah retry loop (max 2 retry) dan output size limit (5MB) di `Execute()`.
- SSRF Validator (Go):
  - `pkg/urlvalidator/urlvalidator.go`: Validasi scheme (http/https only), blokir localhost/loopback/private IP/link-local/metadata endpoints.
  - `pkg/urlvalidator/urlvalidator_test.go`: 14 test cases.
- SSRF Validator (Python):
  - `workers/python/url_validator.py`: Validasi serupa di sisi Python (scheme, blocked hosts, private IP, DNS resolution check).
  - `workers/python/worker.py`: Panggil `validate_url()` sebelum menjalankan scraper module.
- Test:
  - `pkg/registry/methods/target_url_test.go`: 4 SSRF test cases ditambahkan (localhost, loopback, private 10.x, metadata).

### Acceptance Gate

- [x] URL localhost/127.0.0.1/10.x/192.168.x/169.254.x ditolak oleh Go validator.
- [x] URL tanpa scheme http/https ditolak.
- [x] Output > 5MB menghasilkan error `OUTPUT_LIMIT_EXCEEDED`.
- [x] Worker di-retry hingga 2 kali sebelum dinyatakan gagal.
- [x] Config + parameter dibuat dalam satu transaksi database.
- [x] Semua test lulus (28 test across 4 packages).

### Verifikasi

- Command: `go test ./... -v`
- Hasil: 28 tests PASS di 4 packages.
- Command: `go build ./...`
- Hasil: Build sukses.

### Keputusan Sesi

- Status akhir: accepted
- Catatan: Fondasi reliability dan security sudah terpasang. Sesi berikutnya: Scheduler Runtime (Sesi 5.1).
