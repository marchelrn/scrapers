## Sesi 5.2: Scheduler Recovery dan Concurrency

Status: accepted
Fase: 5 - Scheduler Recovery dan Concurrency
Dependency: Sesi 5.1 (accepted)

### Tujuan

- Memastikan proses scheduler tangguh (resilient) jika sewaktu-waktu backend Golang terhenti (restart/crash).
- Mencegah eksekusi ganda (duplicate execution) jika proses scraping memakan waktu lebih lama dari frekuensi cron yang dijadwalkan (contoh: jadwal berjalan tiap menit, namun proses scraping memakan waktu 3 menit).

### Scope

- Pemulihan Job (Recovery): Mencari job dengan status `running` atau `pending` saat server _boot up_ lalu mengubahnya menjadi `failed` secara otomatis, agar tidak menjadi "zombie jobs" selamanya.
- Concurrency Lock: Sebelum cron `jobFunc` memanggil worker, service akan memeriksa `scraping_jobs` di DB untuk config yang sama. Jika ada job yang masih `pending` atau `running`, jadwal akan di-skip.
- Uji coba (Unit test) untuk verifikasi _Concurrency Lock_ di `scheduler_service_test.go`.

### Out of Scope

- Distributed Locking via Redis/Zookeeper. Karena MVP ini mengasumsikan satu buah instans backend Golang yang berjalan (single node), lock tingkat DB/memori sudah mencukupi.

### Perubahan yang Dilakukan

- Model atau migration Goose:
  - (Tidak ada perubahan schema).
- Contract atau DTO:
  - `contract/service.go`: Menambahkan `RecoverStuckJobs() error` ke interface `ScrapingJobService`.
- Handler atau route:
  - `internal/server/server.go`: Memanggil `svc.ScrapingJob.RecoverStuckJobs()` sebelum `StartScheduler()` pada fase inisialisasi server.
- Service atau repository:
  - `service/job_service.go`: Implementasi `RecoverStuckJobs()` yang mencari job berstatus `pending/running` lalu mengubah statusnya menjadi `failed` dengan menyisipkan log "Job execution interrupted and marked as failed due to server restart/crash."
  - `service/scheduler_service.go`: Pada `registerJobInternal`, menambahkan pengecekan menggunakan `jobSvc.GetAll()`. Jika ditemukan job yang masih aktif untuk konfigurasi yang sama, cron akan mencetak log `skipped` dan tidak men-dispatch eksekutor baru.
- Test:
  - `service/scheduler_service_test.go`: Menambahkan `TestScheduleConcurrencyLock`. Pengujian memasukkan *dummy job* berstatus `running`, lalu secara manual memanggil eksekusi cron dan memverifikasi bahwa tidak ada job baru yang ditambahkan hingga job sebelumnya berstatus `success`.

### Acceptance Gate

- [x] Concurrency Lock berfungsi: jadwal tidak menciptakan tumpang tindih job.
- [x] Recovery berfungsi: job yang terjebak pada saat restart ditandai sebagai `failed`.
- [x] Tes `TestScheduleConcurrencyLock` lulus (`go test ./service -v`).

### Verifikasi

- Command: `go test ./... -v`
- Hasil: Semua lulus.
- Command: `go build ./...`
- Hasil: Semua lulus tanpa _dead code_.

### Keputusan Sesi

- Status akhir: accepted
- Catatan: Siklus penjadwal kini aman untuk dijalankan dalam mode production/MVP. Selanjutnya di Sesi 6.1, kita akan menambahkan dukungan autentikasi ke Target URL (mis. via headers `API-Key` atau Cookie Login).
