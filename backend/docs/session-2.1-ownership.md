## Sesi 2.1: Ownership dan Authorization

Status: accepted
Fase: 2 - Authorization
Dependency: Sesi 1.2 (accepted)

### Tujuan

- Membatasi akses data sehingga user biasa (operator) hanya bisa melihat dan mengelola konfigurasi, schedule, job, log, dan result yang dimilikinya (dibuat olehnya).
- Memberikan akses lintas user kepada role `admin`.
- Menerapkan filter di repository dan memvalidasi akses di service (backend authorization), tidak sekadar menyembunyikan data di frontend.

### Scope

- Audit JWT Middleware untuk memastikan `userID` dan `role` masuk ke `gin.Context`.
- Perbarui antarmuka contract `ScrapingConfigRepository`, `ScheduleRepository`, dan `ScrapingJobRepository` untuk menerima `userID` dan `userRole`.
- Terapkan klausa filter `WHERE created_by = ?` pada repository tersebut apabila role bukan `admin`.
- Teruskan `userID` dan `role` dari controller handler ke service dan repository yang relevan.
- Tambahkan unit test untuk memastikan operator tidak bisa melihat resource operator lain, dan admin bisa melihat semuanya.

### Out of Scope

- Membatasi endpoint executor `/jobs/:id/status` dan `/jobs/:id/results` dari dipanggil secara publik. Hal ini adalah cakupan dari Sesi 2.2 (Internal Executor Boundary).

### Perubahan yang Dilakukan

- Model atau migration Goose:
  - (Tidak ada perubahan schema).
- Contract atau DTO:
  - `contract/repository.go` dan `contract/service.go`: Update method signature `GetAll`, `GetByID`, `Create`, `Update`, `Delete` untuk menerima args `userID` dan `userRole`.
- Service atau repository:
  - `repository/config_repository.go`: Ditambahkan check jika role bukan admin, tambahkan clause query `Where("created_by = ?", userID)`.
  - `repository/scheduler_repository.go`: Menggabungkan JOIN tabel `scraping_configs` dan apply `created_by` filter.
  - `repository/job_repository.go`: Menggabungkan JOIN tabel `scraping_configs` dan apply `created_by` filter.
  - `service/config_service.go`, `service/scheduler_service.go`, `service/job_service.go`: Melewati argumen context, mengupdate method-method. Pada `executeJobAsync`, saat worker internal memperbarui job lewat `UpdateStatus` / `AddResult`, bypass check dilakukan dengan memasukkan constant internal role `models.UserRoleAdmin`.
- Handler atau route:
  - `handler/config_controller.go`, `handler/scheduler_controller.go`, `handler/job_controller.go`: Ekstrak `userID` dan `userRole` dari `c.Get()` dan teruskan ke service.
- Test:
  - `service/config_service_test.go`: Tambahkan `TestOwnershipAuthorization` yang menguji Admin mendapat semua dan Operator hanya mendapat konfig miliknya sendiri.

### Acceptance Gate

- [x] Admin bisa melihat semua config (melalui unit test mock & code review).
- [x] Operator hanya bisa melihat, update, atau mendelete config miliknya (unit test mock).
- [x] Filter ownership diterapkan pada level repository SQL query, bukan sekadar service/handler (terimplementasi di repository menggunakan GORM `Where`).
- [x] Test `TestOwnershipAuthorization` pass.
- [x] Build dan tes lain (`TestJobStatusTransition`, dll) pass.

### Verifikasi

- Command: `go test ./service -v`
- Hasil: Semua test pass (termasuk `TestOwnershipAuthorization`).
- Command: `go build ./...`
- Hasil: Build pass tanpa error (semua interface yang diubah telah di-implement di struct terkait).

### Keputusan Sesi

- Status akhir: accepted
- Catatan: Ownership dasar telah terimplementasi dengan baik. Pada sesi berikutnya kita perlu membatasi API Internal Execution, agar user biasa tidak bisa mengubah status secara manual walau itu resource miliknya sendiri.
