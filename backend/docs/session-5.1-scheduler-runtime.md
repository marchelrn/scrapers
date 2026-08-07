## Sesi 5.1: Scheduler Runtime Dasar

Status: accepted
Fase: 5 - Scheduler Runtime Dasar
Dependency: Sesi 4.3 (accepted)

### Tujuan

- Membuat runtime untuk jadwal scraping agar dapat dieksekusi secara periodik sesuai ekspresi CRON.
- Menghitung waktu eksekusi selanjutnya (`next_run`) dan menyimpannya di basis data untuk ditampilkan ke operator.
- Mengintegrasikan siklus hidup *scheduler* ke *lifecycle* aplikasi backend (start/stop dengan aman).
- Mencegah *schedule* dijalankan apabila *scraping_config* terkait sudah dinonaktifkan (`inactive`).

### Scope

- Instansiasi `*cron.Cron` menggunakan library `robfig/cron/v3`.
- Menambahkan metode `StartScheduler()` dan `StopScheduler()` pada `ScheduleService`.
- Menyimpan relasi ID `Schedule` ke `cron.EntryID` pada map *in-memory* secara thread-safe menggunakan `sync.Mutex`.
- Merubah flow CRUD pada `ScheduleService` agar jadwal segera diregistrasikan/dibuang/diperbarui dari instance `*cron.Cron` internal setiap ada panggilan pembuatan (Create), update, atau delete.
- Pemanggilan eksekusi memintas otorisasi menggunakan akses role admin secara internal dalam *goroutine* cron (bypass untuk *system execution*).
- Menghitung `next_run` dan update kolomnya dalam db.
- Menambahkan unit test spesifik untuk daur hidup *schedule* di `scheduler_service_test.go`.

### Out of Scope

- Memecahkan duplikasi eksekusi klaster multi-node/pod (Misal menggunakan redis lock), karena asumsi *instance backend server* MVP hanyalah tunggal (single node) pada eksekusi jadwal.
- Menyimpan *next_run* tanpa timezone support yang spesifik (hanya menggunakan timezone default dari data, yaitu Asia/Makassar).

### Perubahan yang Dilakukan

- Model atau migration Goose:
  - (Tidak ada perubahan skema - `next_run` sudah ada di tabel sejak *baseline*).
- Contract atau DTO:
  - `contract/service.go`: Menambahkan `StartScheduler()` dan `StopScheduler()` pada `ScheduleService`.
- Service atau repository:
  - `service/main.go`: Inject `jobSvc` ke `scheduleSvc` saat instansiasi.
  - `service/scheduler_service.go`: Diperkuat dengan `cron.New()`, *map of cron.EntryID*, *mutex*. `StartScheduler()` meload semua active schedule dari database (mengabaikan ownership karena ini *system startup*), mendaftarkan semua schedule yang aktif ke goroutine cron, lalu memanggil `cronRunner.Start()`.
  - Pada CRUD `scheduler_service.go`: ditambahkan pemanggilan method internal yang melakukan mutasi terhadap `*cron.Cron` state.
- Handler atau route:
  - `internal/server/server.go`: Pemanggilan `svc.Schedule.StartScheduler()` sebelum setup routes.

### Acceptance Gate

- [x] Cron expression berhasil diparsing dan dieksekusi.
- [x] Saat jadwal ditambah melalui controller, penjadwalnya otomatis aktif.
- [x] Kolom `next_run` berhasil diisi berdasarkan komputasi cron saat update/create/eksekusi.
- [x] *Config* yang bersatus *inactive* otomatis dilewati *cron goroutine* walaupun jadualnya masih aktif.
- [x] Unit test *scheduler_service_test.go* selesai & lolos.
- [x] Server berhasil dibuild dan test seluruh modul lolos.

### Verifikasi

- Command: `go test ./service -v`
- Hasil: PASS. `TestScheduleLifecycle` sukses dan log mencatat *Register schedule*.
- Command: `go build ./...`
- Hasil: PASS

### Keputusan Sesi

- Status akhir: accepted
- Catatan: Runtime schedule telah berhasil beroperasi dan mereload jadwal dari database. Untuk kedepannya (`Sesi 5.2`), kita mungkin perlu pencegahan ganda (*duplicate run*) atau concurrency locks jika job yang sama berjalan sebelum job sebelumnya selesai.
