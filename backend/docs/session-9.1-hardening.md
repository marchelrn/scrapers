## Sesi 9.1: Integration, Security, dan Performance Hardening

Status: accepted
Fase: 9 - Finalisasi MVP
Dependency: Sesi 8.1 (accepted)

### Tujuan

- Menjaga keandalan (reliability) dan stabilitas peladen (server) melalui penambahan fitur _Graceful Shutdown_.
- Memastikan proses latar belakang (seperti *scheduler* dan _worker Python_) tidak sekadar "terputus di tengah jalan" saat server dimatikan.
- Verifikasi keamanan secara keseluruhan (_redaction of secrets_, CORS, Limit) untuk memastikan _codebase_ memenuhi standar rilis minimum.

### Scope

- **Graceful Shutdown**: Modifikasi `internal/server/server.go` agar mendengarkan sinyal penghentian sistem (`SIGINT`, `SIGTERM`), dan menggunakan metode `Shutdown(ctx)` bawaan library `http` Go untuk menunda penutupan server hingga _request_ HTTP yang ada diselesaikan (hingga 5 detik).
- **Graceful Scheduler Stop**: Memanggil `defer svc.Schedule.StopScheduler()` pada proses utama server untuk memastikan cron *worker* dapat mencatat state sebelum _runtime_ Go benar-benar dihentikan.
- **Log Management**: Menambahkan format tanggal, waktu, dan *log output* standar ke *console* pada `server.go`.

### Out of Scope

- CI/CD (Continuous Integration/Continuous Deployment) pipeline setup. Hal ini masuk pada ranah devops.
- Log file rotation (memutar log error ke dalam file fisik), saat ini log standar bergantung pada Docker / *container stdout logging*.

### Perubahan yang Dilakukan

- Handler atau route:
  - `server.go`: Memindahkan pemanggilan `.Run()` Go gin ke dalam _goroutine_ non-blokir (`srv.ListenAndServe()`).
  - Menambahkan *channel* penangkap sistem operasi: `quit := make(chan os.Signal, 1)`.
  - Mengimplementasikan `srv.Shutdown(ctx)` untuk memastikan respons yang aman bila server mati (Graceful shutdown).

### Acceptance Gate

- [x] Kode mendukung tangkapan `SIGINT` (Ctrl+C di terminal).
- [x] Fungsi `StopScheduler()` berjalan secara tepat sebelum koneksi database tertutup.
- [x] Seluruh komponen sukses melalui *build test*.

### Verifikasi

- Command: `go test ./... -v`
- Hasil: 34 _Test case_ terlewati (100% Pass).
- Command: `go build ./...`
- Hasil: Pass (build succesful).

### Keputusan Sesi

- Status akhir: accepted
- Catatan: Sistem backend saat ini memiliki _availability_ dan ketahanan (_resilience_) yang kuat terhadap *restart* mendadak. Dengan ini, tahapan MVP dinyatakan siap untuk User Acceptance Testing (UAT).
