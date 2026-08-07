# Sesi 0.1: Baseline Repository dan Keputusan MVP

Status: accepted
Fase: 0 - Fondasi
Dependency: Tidak ada

## Tujuan

- Menetapkan baseline alur backend dari input konfigurasi pengguna sampai eksekusi Python worker.
- Menetapkan acceptance scenario sementara untuk metode `target_url` HTML/CSS manual.
- Mengidentifikasi gap yang harus ditutup secara berurutan tanpa melompati fase roadmap.

## Scope

- Audit struktur handler, service, repository, model, DTO, route, dan worker Python yang telah ada.
- Catat acceptance scenario target publik sementara.
- Susun backlog backend untuk alur input pengguna dan dispatch worker.

## Out of Scope

- Mengubah kontrak, schema, atau implementasi runtime.
- Mengimplementasikan scheduler, target authentication, Google Search, atau site crawl.
- Menetapkan target BPS produksi, provider Google resmi, atau provider SSO.

## Keputusan Baseline

- Acceptance scenario sementara `target_url` HTML/CSS memakai `https://example.com` dengan selector CSS `h1`.
- Target tersebut hanya digunakan untuk menguji alur teknis. Target BPS resmi dan izin akses harus ditetapkan sebelum UAT atau penggunaan produksi.
- Dukungan authentication ditunda sampai Sesi 6.1. Password, token, API key, cookie, dan session data tidak boleh menjadi parameter konfigurasi biasa.
- Google Search belum dapat dimulai sebelum provider resmi, credential storage, batas quota, dan acceptance scenario ditetapkan.

## Kondisi Saat Ini

- `POST /configs` menerima nama, `scraper_type_id`, status, dan daftar parameter JSONB; `created_by` diambil dari JWT context.
- Config disimpan bersama parameter, lalu `POST /jobs` membuat job `pending` dan menjalankan goroutine yang memanggil `workers/python/worker.py` sebagai child process.
- Worker menerjemahkan `python_file` menjadi modul scraper melalui allowlist statis dan mencetak JSON pada stdout.
- Hasil stdout disimpan sebagai result; error subprocess dicatat sebagai job `failed` dan log error.
- Belum ada test Go atau Python yang ditemukan pada repository.

## Gap dan Backlog Backend

| Sesi | Fitur backend | Alasan dan acceptance minimum |
| --- | --- | --- |
| 1.1 | Konsolidasi migration Goose dan schema baseline | `db/` menjadi satu-satunya sumber schema; database kosong dapat dimigrasikan dan rollback yang relevan dapat dijalankan. |
| 1.2 | Kontrak job, worker, dan result | Definisikan transisi status valid dan kontrak output worker: `status`, `method`, `results`, `metadata`, dan `error`. Parser backend harus menolak output worker yang tidak valid. |
| 2.1 | Ownership dan authorization | Operator hanya melihat dan menjalankan config/job miliknya; admin dapat mengakses lintas user sesuai kebutuhan. Filter wajib berada di service dan repository. |
| 2.2 | Internal executor boundary | Endpoint pembaruan status, log, dan result tidak dapat dipanggil user biasa. Executor menggunakan service internal, bukan endpoint publik. |
| 3.1 | Registry metode dan parameter dinamis | Daftarkan metode bisnis `target_url` dan placeholder `google_search`; validasi parameter hanya terhadap definisi metode/teknik yang dipilih. Hindari dispatch dari `python_file` yang dapat diinput bebas pengguna. |
| 4.1 | Target URL HTML/CSS manual | Input `url` dan `selector` tervalidasi disimpan atomik, job manual dibuat melalui satu service, worker CSS menerima payload tervalidasi, dan result standar tersimpan. |
| 4.2 | Target URL API JSON manual | Tambahkan teknik API dengan `method`, `headers` non-secret, `query_params`, `body`, dan `json_path` yang tervalidasi serta result normal. |
| 4.3 | Reliability worker dan proteksi SSRF | Gunakan `exec.CommandContext`, timeout, retry/backoff terbatas, batas ukuran stdout/result, URL allowlist/scheme check, blokir loopback/private/internal/metadata endpoint, serta redaksi secret dalam error/log. |
| 5.1 | Scheduler runtime dasar | Schedule aktif yang tervalidasi membuat job melalui service yang sama dengan eksekusi manual. |
| 5.2 | Recovery dan concurrency scheduler | Reload schedule saat startup, perbarui `next_run`, terapkan lock/aturan concurrency, dan cegah duplicate execution. |
| 6.1 | Secret reference dan target authentication | Parameter sensitif memakai referensi secret, tidak dikembalikan API/log, dan hanya API key/bearer untuk target berizin yang disetujui. |
| 6.2 | SSO resmi terpilih | Satu provider/pola SSO resmi dan berizin, tanpa bypass CAPTCHA/MFA/access control. |
| 7.1 | Provider Google Search resmi | Credential dari environment/secret store, validasi query/domain/max result, quota/rate-limit handling, dan normalisasi result. |

## Risiko Saat Ini

- Parameter config tidak tervalidasi terhadap `ParameterDefinition`; nama tidak terdaftar, parameter duplikat, nilai JSON invalid secara semantik, dan parameter wajib yang kosong masih dapat tersimpan.
- Pembuatan config dan parameter belum atomic; kegagalan saat menyimpan parameter dapat meninggalkan config parsial.
- `ScraperType.PythonFile` dapat ditulis lewat API, meskipun worker memiliki allowlist. Registry metode tetap diperlukan agar lifecycle tidak bergantung pada detail file worker.
- Worker dijalankan melalui goroutine dan `exec.Command` tanpa context deadline, cancellation, resource limit, retry policy, atau batas output.
- Backend menyimpan stdout tanpa memvalidasi kontrak JSON; output sukses worker saat ini juga belum mencantumkan `method`, `metadata`, atau struktur error standar.
- Endpoint `PUT /jobs/:id`, `POST /jobs/:id/logs`, dan `POST /jobs/:id/results` berada di route pengguna terautentikasi; ini belum memenuhi internal executor boundary.
- Config dan job belum menerapkan ownership filter di service/repository; user yang mengetahui ID dapat mengakses atau mengeksekusi data user lain.
- Worker CSS/API menerima URL dari pengguna tanpa validasi SSRF; scraper Python juga memiliki timeout tetap tetapi tidak memiliki policy keamanan URL.

## Acceptance Gate

- [x] Baseline alur config, job, dan worker dicatat.
- [x] Acceptance scenario publik sementara dicatat tanpa mengklaim sebagai target BPS produksi.
- [x] Authentication ditetapkan sebagai out of scope sebelum Sesi 6.1.
- [x] Backlog integrasi backend diurutkan sesuai dependency roadmap.
- [x] `go test ./...` berhasil pada baseline.

## Verifikasi

- Command: audit source pada `handler/`, `service/`, `repository/`, `contract/`, `dto/`, `models/`, `routes/`, `db/`, dan `workers/python/`.
- Hasil: alur dispatch dasar telah ada, tetapi belum memenuhi kontrak worker, validasi dinamis, ownership, executor boundary, dan reliability/security MVP.
- Command: `PATH="/tmp/opencode/go/bin:$PATH" go test ./...`.
- Hasil: berhasil untuk seluruh package; repository belum memiliki test otomatis (`[no test files]`).
- Command: `PATH="/tmp/opencode/go/bin:$PATH" go vet ./...`.
- Hasil: berhasil tanpa temuan.
- Command: `PATH="/tmp/opencode/go/bin:$PATH" gofmt -w dto/config_dto.go`.
- Hasil: memperbaiki alignment field pada file DTO yang telah berubah di worktree.
- Command: `python3 -m compileall -q workers/python`.
- Hasil: berhasil.
- Command: `"/tmp/opencode/scrapers-worker-venv/bin/python" workers/python/worker.py css_scraper.py '{"url":"https://example.com","selector":"h1"}'`.
- Hasil: berhasil dengan output `{"status":"success","results":["Example Domain"]}`.
- Command: `"/tmp/opencode/scrapers-worker-venv/bin/python" workers/python/worker.py css_scraper.py '{invalid-json}'`.
- Hasil: worker mengembalikan JSON error untuk input yang bukan JSON valid.
- Command: `git diff --check`.
- Hasil: berhasil tanpa error whitespace.
- Catatan: dependency Python tersedia melalui `workers/python/requirements.txt`, tetapi environment awal tidak memiliki `pip` atau paket worker. Acceptance scenario dijalankan melalui virtual environment sementara di `/tmp/opencode/scrapers-worker-venv`.
- Catatan: `go run goose.go --help` tidak valid karena `goose.go` bukan executable Goose. Verifikasi migration pada database kosong tetap menjadi scope Sesi 1.1 dan membutuhkan binary Goose atau `go run github.com/pressly/goose/v3/cmd/goose` beserta PostgreSQL.
- Catatan risiko: worktree telah berisi perubahan lintas layer yang tidak dibuat pada sesi ini dan tidak diubah oleh sesi ini.

## Keputusan Sesi

- Status akhir: accepted
- Catatan: Temuan schema `pgcrypto`, ketidaksesuaian nama parameter worker, dan kontrak error worker tidak menghalangi acceptance audit baseline. Ketiganya wajib ditangani pada Sesi 1.1, 3.1/4.1, dan 1.2 sesuai dependency roadmap. Sesi 1.1 dapat dimulai; Sesi 1.2 sampai 4.3 tidak boleh dimulai sebelum dependency sebelumnya accepted.
