## Sesi 1.2: Contract Job, Worker, dan Result

Status: accepted
Fase: 1 - Fondasi
Dependency: Sesi 1.1 (accepted)

### Tujuan

- Menetapkan transisi status job yang valid untuk mencegah eksekusi dan pencatatan yang inkonsisten.
- Menetapkan kontrak JSON standar untuk output dari setiap Python worker.
- Memastikan Go service dapat melakukan parsing, validasi, dan penanganan timeout terhadap output worker.

### Scope

- Validasi status transition (`pending` -> `running` -> `success/failed`).
- Pembuatan struktur `WorkerResult` DTO pada backend.
- Modifikasi service worker invocation agar menggunakan `exec.CommandContext` dengan timeout (2 menit).
- Modifikasi Python `worker.py` untuk mengembalikan kontrak JSON yang didefinisikan dalam `agent.md`.
- Penambahan test unit untuk status transition dan worker result parsing di Go.

### Out of Scope

- Memisahkan logic ke distributed task queue (misalnya RabbitMQ) - tetap menggunakan child process sesuai baseline.
- Menambah SSRF protection (akan dikerjakan di sesi selanjutnya terkait target url manual).
- Implementasi otentikasi worker (internal boundaries).

### Perubahan yang Dilakukan

- Model atau migration Goose:
  - (Tidak ada perubahan schema).
- Contract atau DTO:
  - `dto/worker_dto.go`: Dibuat struktur baru (`WorkerResult`, `WorkerMetadata`, `WorkerError`) untuk parsing.
- Service atau repository:
  - `service/job_service.go`: Update `UpdateStatus` dengan validasi transisi status yang valid. Update `executeJobAsync` untuk memakai `exec.CommandContext` dengan 2-minute timeout, parsing hasil dengan `dto.WorkerResult`, dan logic error handling yang mencatat error log jika result fail/invalid.
- Scheduler atau worker:
  - `workers/python/worker.py`: Diubah format output JSON-nya agar memiliki `method`, `metadata` (`source`, `fetched_at`, `item_count`), dan `error`, tidak hanya `status` dan `results`.
- Test:
  - `service/job_service_test.go`: Dibuat dengan 2 unit test: `TestJobStatusTransition` dan `TestWorkerResultContractParsing`.

### Acceptance Gate

- [x] Status tidak valid (seperti `success` -> `running`) akan ditolak.
- [x] Worker Python mereturn JSON object dengan keys `status`, `method`, `results`, `metadata`, `error`.
- [x] Backend Go bisa parse output kontrak worker, dan mark job failed jika parse gagal atau return worker failed.
- [x] Backend menjalankan worker dengan timeout (context).
- [x] Semua test hijau (`go test ./service -v`).

### Verifikasi

- Command: `go test ./service -v`
- Hasil: PASS (2 tests pass dengan semua substeps).
- Command: `python workers/python/worker.py css_scraper.py '{"url":"http://example.com","selector":"h1"}'` (Manual Test)
- Hasil: Sukses mengembalikan JSON berformat kontrak.
- Catatan risiko: Karena menggunakan `exec.CommandContext`, job yang memakan waktu lebih dari 2 menit akan dibunuh (SIGKILL) oleh OS secara otomatis, yang mana akan mencegah resource leak.

### Keputusan Sesi

- Status akhir: accepted
- Catatan: Kontrak worker sudah robust. Langkah selanjutnya masuk ke Sesi 2.1 untuk menerapkan ownership dan authorization.
