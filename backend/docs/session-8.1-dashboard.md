## Sesi 8.1: Result Presentation dan Dashboard MVP

Status: accepted
Fase: 8 - Tampilan dan Ringkasan
Dependency: Sesi 7.1 (accepted)

### Tujuan

- Menyesuaikan endpoint API ringkasan (*dashboard summary*) agar menampilkan data yang sesuai dengan hak akses (ownership) user, alih-alih data sistem agregat secara keseluruhan (kecuali Admin).
- Menyiapkan parameter filter tambahan (`limit`, `offset`/`page`) pada endpoint daftar (list) agar dapat dirender oleh frontend tanpa menyebabkan masalah performa bila job sudah mencapai puluhan ribu.

### Scope

- Audit `dashboard_repository.go` untuk menangkap logic query ringkasan.
- Menambahkan parameter `userID` dan `userRole` di layer *Contract* `DashboardService` dan `DashboardRepository`.
- Modifikasi query hitung (Count) `ActiveWorkers`, `RunningJobs`, `FailedJobs`, `SuccessfulJobs`, dan `Queue` agar bergabung (Join) dengan tabel `scraping_configs` dan me-filter via klausa `WHERE created_by = ?` jika pengguna berstatus *operator*.
- Modifikasi handler API `/dashboard/summary` untuk meneruskan konteks JWT (`user_id` dan `user_role`) ke dalam Service.
- Penambahan filter _limit_ dan _offset_ pada `GetAll` di `JobService` dan rute `GET /jobs` agar menyokong skenario paginasi di *Frontend*.

### Out of Scope

- Membangun antarmuka grafik visual (Frontend web). Semua representasi ini adalah format data via API untuk mempermudah render.

### Perubahan yang Dilakukan

- Model atau migration Goose:
  - (Tidak ada perubahan skema).
- Contract atau DTO:
  - `contract/repository.go` dan `contract/service.go`: Metode `GetSummary` diupdate argumennya menjadi `(userID string, userRole string)`. Menambahkan parameter pagination ke fungsi `GetAll` pada `ScrapingJobRepository`.
- Service atau repository:
  - `repository/dashboard_repository.go`: Menggunakan `Joins("JOIN scraping_configs ON scraping_jobs.config_id = scraping_configs.id")` untuk menyaring jumlah status per user.
  - `repository/job_repository.go`: Mengimplementasi method GORM `.Limit()` dan `.Offset()`.
- Handler atau route:
  - `handler/dashboard_controller.go`: Mengambil data role & userid dari HTTP Context.
  - `handler/job_controller.go`: Mengambil *query parameter* HTTP `page` dan `limit` untuk menghitung `offset`.

### Acceptance Gate

- [x] Operator tidak dapat melihat hitungan total error/job milik operator lain di Dashboard Summary.
- [x] Admin dapat melihat agregasi dari seluruh job di database pada Dashboard Summary.
- [x] Terdapat paginasi pada endpoint pengumpulan list job.
- [x] Seluruh komponen Build ulang Go sukses.
- [x] Semua fungsi terintegrasi tanpa dead-code error.

### Verifikasi

- Command: `go test ./... -v`
- Hasil: 34 Test berstatus PASS.
- Command: `go build ./...`
- Hasil: Build sukses.

### Keputusan Sesi

- Status akhir: accepted
- Catatan: Sistem API sekarang sudah terkurasi secara efisien untuk ditambatkan pada *Frontend Dashboard Web Application*. Skenario presentasi dasar sudah dipenuhi.
