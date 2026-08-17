## Sesi 1.1: Konsolidasi Goose dan Schema Baseline

Status: accepted
Fase: 1 - Fondasi
Dependency: Sesi 0.1 (accepted)

### Tujuan

- Menetapkan `db/` sebagai satu-satunya sumber migration (Goose).
- Menghapus sistem migration legacy `sql/` yang tidak digunakan.
- Memastikan schema database cocok dengan model GORM.
- Membersihkan file dan dependency yang tidak diperlukan.

### Scope

- Audit seluruh migrasi Goose di `db/` terhadap model GORM.
- Tambah kolom `updated_at` pada tabel `users` via migration baru.
- Hapus statement dummy `SELECT 'up SQL query'` dari semua migration.
- Hapus folder `sql/` (dead code, bukan Goose, mengandung bug syntax).
- Hapus `goose.go` (tidak dipanggil, menggunakan `pressly/goose` v2 deprecated).
- Bersihkan dependency tidak terpakai via `go mod tidy`.
- Format seluruh kode Go dengan `gofmt`.

### Out of Scope

- Mengubah model, service, handler, atau contract.
- Menambah test (ditangani Sesi 1.2).
- Mengubah schema selain menambah `updated_at` pada `users`.

### Perubahan yang Dilakukan

- Model atau migration Goose:
  - `db/20260730000001_add_updated_at_to_users.sql`: migration baru, menambah kolom `updated_at` pada tabel `users`.
  - Semua 9 migration lama: dihapus statement `SELECT 'up SQL query'` dan `SELECT 'down SQL query'`.
- File dihapus:
  - `sql/` (seluruh folder): `001_users.sql` s/d `009_scraping_results.sql` dan `migrations.go`.
  - `goose.go`: standalone Goose runner yang tidak pernah dipanggil.
- Dependency:
  - `pressly/goose`, `go-sql-driver/mysql`, `ziutek/mymysql` dihapus dari `go.mod` via `go mod tidy`.
- Format:
  - 12 file Go diformat ulang dengan `gofmt`.

### Gap yang Ditemukan (Sesi ini)

| Tabel | Kolom Migration | Model GORM | Status |
|---|---|---|---|
| `users` | Tidak ada `updated_at` | `UpdatedAt time.Time` | Fixed via migration baru |
| `scraping_configs` | Tidak ada `updated_at` | Tidak ada field `UpdatedAt` | Konsisten (tidak perlu fix) |
| `schedules` | Tidak ada `created_at`/`updated_at` | Tidak ada field tersebut | Konsisten |
| `scraping_jobs` | Tidak ada `created_at` | Tidak ada field `CreatedAt` | Konsisten |

### Acceptance Gate

- [x] Folder `sql/` dihapus, tidak ada sumber migration ganda.
- [x] `goose.go` dihapus, tidak ada dead code Goose runner.
- [x] Dependency `pressly/goose` dihapus dari `go.mod`.
- [x] Migration baru `20260730000001_add_updated_at_to_users.sql` menambah `updated_at` pada `users`.
- [x] Semua migration bersih dari statement dummy.
- [x] Urutan rollback (down) konsisten dengan foreign key dependency.
- [x] `go build ./...` berhasil tanpa error.
- [x] `gofmt -l .` tidak mengembalikan file yang belum terformat.

### Verifikasi

- Command: `go build ./...` -- sukses, tidak ada error.
- Command: `gofmt -l .` -- tidak ada output (semua terformat).
- Command: `go mod tidy` -- dependency tidak terpakai dihapus.
- Catatan: Migration `goose up` pada database kosong belum diverifikasi karena memerlukan koneksi PostgreSQL aktif. Verifikasi ini harus dilakukan oleh developer saat menjalankan environment lokal menggunakan `goose -dir db postgres "$DB_URL" up`.

### Keputusan Sesi

- Status akhir: accepted
- Catatan: `db/` adalah satu-satunya sumber kebenaran migration. Semua perubahan schema selanjutnya harus menggunakan file migration Goose baru di folder `db/`.
