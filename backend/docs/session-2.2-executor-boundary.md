## Sesi 2.2: Internal Executor Boundary

Status: accepted
Fase: 2 - Authorization
Dependency: Sesi 2.1 (accepted)

### Tujuan

- Memastikan status pekerjaan (job), log, dan result tidak dapat dimodifikasi secara sewenang-wenang oleh pengguna biasa melalui HTTP endpoint.
- Membatasi modifikasi tersebut agar hanya dapat dilakukan melalui jalur eksekusi internal (background goroutine) yang terpercaya.

### Scope

- Mengaudit `routes/routes.go` untuk mendeteksi rute perubahan state yang terekspos.
- Menghapus endpoint HTTP (routes) untuk mengubah status, menambahkan log, dan menambahkan hasil.
- Menghapus method terkait (`UpdateStatus`, `AddLog`, `AddResult`) dari file `handler/job_controller.go` karena sudah digantikan oleh alur internal executor dalam Sesi 1.2.
- Memastikan `service/job_service.go` yang digunakan secara internal tidak terpengaruh dan tetap bisa berjalan.

### Out of Scope

- Merubah arsitektur worker dari child process ke message broker, karena MVP berfokus pada eksekusi internal background (goroutine).

### Perubahan yang Dilakukan

- Model atau migration Goose:
  - (Tidak ada perubahan)
- Contract atau DTO:
  - (Tidak ada perubahan)
- Handler atau route:
  - `routes/routes.go`: Menghapus endpoint `PUT /jobs/:id`, `POST /jobs/:id/logs`, dan `POST /jobs/:id/results` dari grup protected.
  - `handler/job_controller.go`: Menghapus method `UpdateStatus`, `AddLog`, dan `AddResult`.
- Service atau repository:
  - (Tidak ada perubahan - method di Service tetap dipertahankan karena dipanggil secara internal oleh Go routine executor `executeJobAsync`).

### Acceptance Gate

- [x] Endpoint `PUT /jobs/:id` tidak ada.
- [x] Endpoint `POST /jobs/:id/logs` tidak ada.
- [x] Endpoint `POST /jobs/:id/results` tidak ada.
- [x] Background worker tetap dapat mengubah status karena memanggil method di internal Service (Sesi 1.2).
- [x] Build backend `go build ./...` berhasil dan aman dari dead code.

### Verifikasi

- Command: `go build ./...`
- Hasil: Pass, sukses build tanpa controller.
- Command: `grep -r "PUT.*/jobs/:id" routes/routes.go`
- Hasil: Kosong, tidak ditemukan.

### Keputusan Sesi

- Status akhir: accepted
- Catatan: Boundary eksekutor internal kini aman. Data status dan result sepenuhnya ditangani oleh worker cycle di backend dan tidak dapat dimanipulasi via client API secara sengaja ataupun tidak.
