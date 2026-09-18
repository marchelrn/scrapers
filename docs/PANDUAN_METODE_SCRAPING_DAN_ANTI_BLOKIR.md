# Metode Scraping untuk Pengguna Non-Teknis & Penanganan Pemblokiran IP

**Tanggal:** 1 September 2026
**Konteks:** BPS Scraper Hub, branch `testing`, setelah sistem dibatasi pada dua metode scraping: `target_url` dan `google_news` (Google News RSS).
**Tujuan platform:** mengamati **fenomena** — konteks kualitatif yang dipakai setiap divisi BPS untuk menjelaskan pergerakan angka. Platform ini mengoordinasikan scraper yang dibangun IPDS agar dapat dipakai divisi lain tanpa pengetahuan kode atau IT. Ia **bukan** alat untuk mengambil data statistik dari sumber seperti BPS WebAPI.

---

## Pertanyaan

> Saya ingin tahu bagaimana cara melakukan scraping web, di mana scraping web ini user (pegawai BPS) bisa dengan mudah tanpa perlu mengetahui cara-cara IT — jadi kalau bisa pengguna tidak perlu tahu cara pengkodean. Dengan konteks tersebut, metode scraping apa yang Anda sarankan?
>
> Juga saya mengalami kendala: pada saat melakukan CSS selector maupun `target_url` scraping, sering website itu menolak atau memblokir IP dari pengguna platform ini. Untuk level industri, bagaimana mengatasi hal tersebut?

---

## Ringkasan Jawaban

**Pertanyaan 1 — metode untuk pengguna non-teknis.**
Tidak ada "metode scraping yang mudah". Yang bisa dipindahkan adalah **bebannya**, bukan kesulitannya. Kesulitan teknis scraping (memilih elemen, menangani JavaScript, memperbaiki selector yang rusak) tidak hilang — ia hanya bisa dipindahkan dari operator ke IPDS, **satu kali per situs target**, lalu dipakai berulang oleh banyak operator lewat form. Ini persis model yang sudah Anda rancang di `docs/SCRAPER_MANAGEMENT_PIVOT.md`, dan arahnya sudah benar. Yang saya sarankan: **berhenti menawarkan CSS Selector ke operator**, dan perbanyak metode terparameter seperti `google_news`. Karena yang dicari adalah fenomena dan bukan angka, prioritas pertama bukan API data melainkan **kanal yang memang diterbitkan untuk dibaca mesin** — RSS/feed berita dan portal pemda (lihat 1.3).

**Pertanyaan 2 — pemblokiran IP.**
Pemblokiran yang Anda alami kemungkinan besar **bukan** karena IP-nya "jelek", melainkan karena pola trafik platform ini mudah dikenali: satu User-Agent yang sama untuk semua request, tanpa jeda antar-request, tanpa penanganan `429`/`Retry-After`, dan retry yang justru menembak ulang dengan IP dan identitas yang sama. Urutan penyelesaian di level industri: **legitimasi akses → sopan santun HTTP → penanganan 429/403 yang benar → realisme sesi → diversifikasi IP → layanan unblocking terkelola**. Proxy adalah langkah kelima, bukan pertama. Kalau Anda beli proxy sekarang tanpa membenahi empat lapis di atasnya, Anda hanya akan memblokir IP baru dengan lebih cepat.

---

## Bagian 1 — Metode Scraping untuk Pengguna Non-Teknis

### 1.1 Framing yang benar

Pertanyaan "metode apa yang paling mudah untuk operator?" akan selalu menghasilkan jawaban yang mengecewakan, karena semua metode scraping menuntut pemahaman struktur halaman. Pertanyaan yang lebih produktif adalah:

> **Apa yang harus diisi operator, dan siapa yang sudah menyiapkan sisanya?**

Dengan framing itu, jawabannya jelas: metode terbaik untuk operator adalah metode di mana operator **hanya mengisi parameter bisnis** (kata kunci, wilayah, periode, jumlah data) — bukan parameter teknis (URL, selector, XPath, regex).

`google_news` adalah contoh yang sudah benar di sistem Anda: operator hanya mengisi *Search Query*, *Domain Filter*, *Max Results*. Tidak ada satu pun konsep IT di form itu. `target_url` + `css` adalah contoh sebaliknya: operator diminta memahami DOM.

### 1.2 Tangga beban teknis metode yang ada sekarang

| Beban operator | Metode / teknik | Yang diisi operator | Cocok untuk | Disiapkan oleh |
| :--- | :--- | :--- | :--- | :--- |
| **Nol** | `google_news` | kata kunci, filter domain, jumlah hasil | pemantauan berita & isu daerah | sudah tersedia |
| **Nol** | `rss_feed` terparameter *(usulan baru, lihat 1.3)* | dropdown sumber terkurasi + kata kunci | pemantauan fenomena dari feed resmi | IPDS, sekali per sumber |
| **Rendah** | `target_url` + `keyword_find` | URL + kata kunci | ambil paragraf/tabel yang memuat kata kunci dari satu halaman | operator, dengan pendampingan |
| **Menengah** | `target_url` + `css` (Visual Selector) | URL + klik elemen di halaman | halaman yang strukturnya stabil | operator + validasi IPDS |
| **Tinggi** | `xpath`, `regex`, `api` generik, `headless` | ekspresi teknis | debugging & kasus khusus | **IPDS saja** |

Kesimpulan praktisnya: **dua baris teratas adalah target Anda**, baris ketiga adalah kompromi yang bisa diterima, dan dua baris terakhir sebaiknya tidak pernah terlihat oleh operator.

### 1.3 Rekomendasi utama untuk konteks BPS: fenomena bukan data, dan jalur resmi tetap ada

Satu koreksi penting atas kerangka berpikir dokumen ini, karena ia mengubah rekomendasi di bawahnya.

Platform ini **bukan** alat untuk mengambil data statistik. Tujuannya adalah **mengamati fenomena** — konteks kualitatif di lapangan: berita panen gagal, protes harga, pembukaan pabrik, keluhan nelayan, kebijakan pemda yang baru turun. Fenomena inilah yang dipakai setiap divisi BPS untuk menjelaskan *mengapa* angka bergerak, dan itu tidak tersedia di API mana pun. BPS WebAPI berisi angka yang sudah dihitung BPS sendiri; ia tidak berisi alasan di balik angka itu.

Karena itu rekomendasi "API dulu, scraping kemudian" **tidak berlaku** di sini, dan usulan metode `bps_webapi` tidak menjawab kebutuhan platform ini. Mengambil data dari API BPS berarti mengambil data yang sudah dimiliki BPS.

Yang tetap berlaku adalah prinsip yang lebih mendasar di baliknya: **utamakan kanal yang memang diterbitkan untuk dibaca mesin.** Untuk pengamatan fenomena, kanal itu ada dan berlimpah:

- **RSS/Atom feed situs berita dan portal pemda.** Hampir semua portal berita Indonesia masih menerbitkan RSS, dan feed itu adalah kontrak: penerbit *ingin* isinya dibaca mesin. Ini yang sudah dipakai `google_news`, dan ini pula alasan metode itu jauh lebih jarang diblokir daripada `target_url`.
- **Feed per kategori atau per daerah.** Banyak portal menyediakan RSS terpisah untuk rubrik ekonomi, pertanian, atau daerah tertentu — lebih relevan dan jauh lebih ringan daripada menyapu halaman indeks.
- **Siaran pers dan halaman pengumuman resmi pemda.** Terbit terjadwal, strukturnya stabil bertahun-tahun, dan jarang berpelindung WAF.

Untuk sumber bernilai tinggi yang tidak punya feed, langkah yang benar bukan mengakali pelindungnya, melainkan **meminta akses sebagai lembaga**. BPS punya posisi untuk itu: satu surat atau satu nota kesepahaman dengan penerbit atau Diskominfo daerah dapat menghasilkan whitelist IP, kunci API, atau kiriman berkala — dan itu bertahan jauh lebih lama daripada selector apa pun. Yang perlu dicatat: pendekatan ini menyelesaikan masalah pemblokiran secara permanen, sementara proxy hanya menundanya.

Jadi urutan baku di katalog menjadi: **RSS/feed resmi → akses yang dinegosiasikan → scraping halaman.** Scraping halaman tetap sah dan tetap diperlukan, tetapi ia adalah pilihan ketiga, bukan pilihan pertama.

Secara konkret untuk platform ini, metode berikutnya yang paling layak dibangun IPDS adalah **`rss_feed` terparameter** — operator memilih sumber dari dropdown yang dikurasi IPDS (misalnya "Antara Sulteng — Ekonomi", "Diskominfo Palu — Pengumuman") lalu mengisi kata kunci. Beban operator nol, dan risiko pemblokirannya mendekati nol karena yang diakses adalah feed, bukan halaman.

### 1.4 Perbaikan konkret pada kode saat ini

Empat hal di bawah ini adalah celah nyata antara model katalog yang Anda rancang dan kode yang ada sekarang. Semuanya kecil, dan semuanya langsung terasa oleh operator.

**a. `technique` masih berupa input teks bebas.**
Di `backend/pkg/registry/methods/target_url.go:48-54`, parameter `technique` bertipe `"text"` dengan komentar yang bahkan sudah mengakui masalahnya. Artinya di form dinamis Katalog, operator melihat kotak teks kosong dan harus **mengetik** `css`, `xpath`, `regex`, `api`, `headless`, atau `keyword_find` dengan ejaan yang tepat. Ini kebalikan dari "tidak perlu tahu cara IT". Ubah menjadi tipe `select` berisi opsi yang berlabel manusiawi.

**b. Registry belum bisa mengekspresikan pilihan (`Options`).**
Ini prasyarat poin (a). Frontend sudah siap — `MethodParam` di `frontend/src/types/index.ts:152-169` punya `Options?: ParameterOption[]`, dan `DynamicScraperForm.tsx:192` sudah merender `<select>` bila `type === 'select'` atau `options.length > 0`. Tetapi struct `registry.ParameterDefinition` di `backend/pkg/registry/registry.go:27-35` **tidak punya field `Options`**, jadi backend tidak pernah bisa mengirimkannya. Tambahkan:

```go
type ParameterOption struct {
    Label string `json:"label"`
    Value string `json:"value"`
}

type ParameterDefinition struct {
    // ...field yang sudah ada...
    Options []ParameterOption `json:"options,omitempty"`
}
```

Setelah itu semua parameter pilihan (wilayah, indikator, tahun, teknik) bisa menjadi dropdown tanpa perubahan frontend sama sekali. Ini satu perubahan dengan dampak paling besar untuk keramahan pengguna.

**c. Katalog belum menerima `category`, `author`, dan `icon`.**
`Method` di frontend sudah mengharapkan `category`, `author`, `icon`, `tags` (`frontend/src/types/index.ts:170-181`), dan `CatalogPage.tsx` mengelompokkan kartu berdasarkan kategori. Tetapi `MethodController.GetAll` (`backend/handler/method_controller.go:22-31`) hanya mengirim `code`, `name`, `description`, `version`, `parameters` — karena interface `ScrapingMethod` tidak mendefinisikan `Category()`/`Author()`. Akibatnya seluruh scraper jatuh ke grup "Umum" dan katalog kehilangan fungsi utamanya sebagai tempat menjelajah. Tambahkan kedua method ke interface (dengan nilai default agar metode lama tetap kompilasi), lalu emit di controller.

**d. Pisahkan katalog berdasarkan peran, bukan sembunyikan sebagian.**
Anda sudah punya RBAC `admin` / `operator`. Manfaatkan: tandai setiap metode dengan tingkat audiens, lalu tampilkan operator hanya metode "Siap Pakai", sementara teknik mentah (`xpath`, `regex`, `headless`, `css` manual) hanya muncul untuk `admin`/IPDS. Operator tidak akan pernah salah pilih alat, dan IPDS tetap punya akses penuh untuk membangun serta men-debug.

---

## Bagian 2 — Mengatasi Penolakan & Pemblokiran oleh Situs Target

### 2.1 Diagnosa dulu: "IP diblokir" sering kali bukan pemblokiran IP

Sebelum membeli proxy, pastikan Anda tahu yang mana yang sedang terjadi. Empat gejala berikut sering disamakan padahal penanganannya berbeda total:

| Gejala | Arti sebenarnya | Penanganan |
| :--- | :--- | :--- |
| `429 Too Many Requests` | Anda terlalu cepat. IP belum diblokir. | Turunkan laju, patuhi header `Retry-After`. **Ganti IP di sini adalah kesalahan** — ia mengubah masalah sopan santun menjadi masalah reputasi. |
| `403 Forbidden` langsung di request pertama | Fingerprint/identitas klien ditolak (UA otomatis, TLS fingerprint Python, header tidak konsisten) | Perbaiki realisme sesi (Lapis 3). Proxy tidak akan menolong. |
| `403`/`503` setelah beberapa waktu berjalan normal | Reputasi IP sudah tercemar | Diversifikasi IP (Lapis 4) **plus** perbaiki laju, kalau tidak IP baru ikut tercemar. |
| HTTP `200` tapi hasil kosong / halaman "Just a moment…" | Interstitial JS challenge, atau selector salah, atau konten dirender belakangan | Harus dibedakan dulu — lihat 2.2 poin (e). |

### 2.2 Temuan pada kode saat ini

Berikut kondisi nyata platform ini, karena inilah yang menjelaskan mengapa Anda sering kena blokir:

**a. Satu User-Agent yang sama, dipakai di mana-mana.** String `Chrome/120.0.0.0` yang identik di-hardcode di `css_scraper.py:83`, `keyword_scraper.py:26`, `headless_scraper.py:51`, dan `google_news_scraper.py:101, 267` — dengan `Chrome/122.0.0.0` di `google_news_scraper.py:306`. Menarik: `fake-useragent==2.2.0` sudah ada di `requirements.txt:11` tapi tidak pernah diimpor satu file pun.

**b. Tidak ada jeda maupun batas laju per domain.** `google_news_scraper.py:433` menembak 5 request bersamaan lewat `ThreadPoolExecutor(max_workers=5)` tanpa jitter atau jeda. Untuk portal pemda kecil, lima koneksi paralel dari satu IP sudah cukup untuk memicu rate limiter.

**c. Retry justru memperburuk.** `target_url.go:176-179, 209-242` mengulang seluruh proses Python hingga 2 kali dengan jeda 1 dan 2 detik — **dengan IP dan User-Agent yang sama**. Lebih buruk lagi, retry hanya dipicu bila proses Python keluar dengan status non-zero; `403` dan `429` justru dianggap "berhasil" karena scraper mengembalikan array kosong dengan exit code 0. Jadi retry aktif di saat yang salah dan pasif di saat yang benar.

**d. Proxy hanya satu, global, dan ditangani tidak konsisten.** Tidak ada pool. Hanya `HTTP_PROXY`/`HTTPS_PROXY` tunggal, lalu setiap scraper menafsirkannya sendiri: `css_scraper.py:61-76` dan `headless_scraper.py:22-37` mem-parse kredensial dengan benar; `keyword_scraper.py:13-16` menyuapkan URL mentah sebagai `{"server": http_proxy}` sehingga **rusak bila proxy memakai username/password** dan mengabaikan `HTTPS_PROXY`; `google_news_scraper.py` tidak pernah menyebut proxy sama sekali dan hanya kebetulan berfungsi karena `requests` membaca variabel lingkungan secara implisit.

**e. Kegagalan tidak terlihat oleh pengguna.** `css_scraper.py:130-131` menelan **semua** exception (`except Exception as e: pass`) dan mengembalikan array kosong. Akibatnya diblokir, selector salah, situs down, dan halaman challenge Cloudflare tampak **persis sama** bagi operator: "hasil 0 baris". Operator lalu menyalahkan dirinya sendiri dan mengubah-ubah selector yang sebenarnya sudah benar. Ini bug UX terpenting yang harus diperbaiki lebih dulu daripada urusan proxy — Anda tidak bisa memperbaiki apa yang tidak bisa Anda lihat.

**f. Stealth diterapkan setengah jalan.** `--disable-blink-features=AutomationControlled` hanya dipasang di `css_scraper.py:51-60`, tidak di `keyword_scraper.py` maupun `headless_scraper.py`. Tidak ada penanganan `navigator.webdriver` atau properti otomasi lain.

**g. Ekstraktor utama kemungkinan mati di produksi.** `google_news_scraper.py` mengimpor `newspaper` di balik penjaga `NEWSPAPER_AVAILABLE` (baris 18-20), padahal `newspaper` **tidak ada di `requirements.txt`**. Jadi jalur ekstraksi utama sangat mungkin selalu gagal dan jatuh ke fallback `soup.find_all('p')` yang kualitasnya jauh lebih rendah. Perlu diputuskan: pasang dependensinya, atau hapus jalur mati itu.

**h. Tidak ada robots.txt, tidak ada cache, tidak ada request kondisional.** Setiap eksekusi mengunduh ulang halaman penuh meski isinya tidak berubah sejak kemarin.

### 2.3 Enam lapis penanganan, dari yang termurah ke termahal

Ini urutan yang dipakai tim data engineering yang serius. Kerjakan dari atas. Setiap lapis yang dilewati membuat lapis di bawahnya lebih mahal dan lebih rapuh.

---

#### Lapis 0 — Pakai kanal yang memang diterbitkan untuk mesin, dan negosiasikan sisanya

Sudah dibahas di 1.3, tapi perlu diulang di sini karena ini juga solusi anti-blokir terbaik: **feed RSS/Atom praktis tidak pernah memblokir Anda**, karena memang diterbitkan untuk dikonsumsi mesin. Setiap sumber yang Anda pindahkan dari scraping halaman ke feed resminya adalah satu masalah pemblokiran yang hilang permanen, bukan ditunda. Untuk pengamatan fenomena ini bukan kompromi: feed berita justru memuat tepat apa yang dicari — judul, tanggal, dan tautan artikel baru.

Untuk situs pemerintah, pemda, dan penerbit berita, ada jalur yang sering dilupakan: **hubungi pengelola situsnya.** Sebagai BPS, Anda punya posisi untuk meminta whitelist IP, kunci API, atau kiriman berkala. Satu surat ke Diskominfo daerah atau ke redaksi bisa menyelesaikan apa yang tidak akan pernah selesai dengan proxy senilai puluhan juta rupiah per tahun. Di banyak organisasi, langkah inilah yang membedakan tim data yang matang dari tim yang terus bermain kucing-kucingan.

---

#### Lapis 1 — Jadi klien yang sopan (ROI tertinggi, biaya nol)

Di skala platform ini — puluhan konfigurasi, bukan puluhan juta halaman — **mayoritas pemblokiran dipicu oleh keburu-buruan, bukan oleh identitas.** Lapis ini yang paling sering menyelesaikan masalah Anda, dan tidak butuh anggaran sama sekali:

1. **Batas laju per domain, bukan per job.** Kunci antriannya ke *hostname*. Mulai dari 1 request per 2–5 detik per domain untuk portal pemda, dan maksimum 1–2 koneksi bersamaan per domain. Turunkan `max_workers=5` di `google_news_scraper.py:433` menjadi per-domain, bukan global.
2. **Jitter, bukan jeda tetap.** Jeda acak (misal 2–6 detik) jauh lebih sulit dikenali sebagai bot ketimbang jeda persis 3 detik.
3. **Patuhi `robots.txt` dan `Crawl-delay`.** Selain benar secara etika, ini juga membuat posisi Anda dapat dipertahankan bila situs target mengeluh — hal yang penting untuk lembaga pemerintah.
4. **Request kondisional dan caching.** Simpan `ETag`/`Last-Modified` per URL, lalu kirim `If-None-Match`/`If-Modified-Since`. Balasan `304 Not Modified` nyaris tidak berbiaya bagi situs target dan menghapus sebagian besar trafik berulang dari jadwal harian Anda.
5. **Jadwalkan di luar jam sibuk.** Jadwal Anda sudah mendukung cron (`SchedulesPage`); geser ke dini hari waktu setempat dan sebarkan jadwal antar-konfigurasi supaya tidak semuanya menembak pukul 00:00.
6. **User-Agent yang jujur dan dapat dihubungi.** Ini kontra-intuitif tapi penting untuk BPS:

   ```
   BPS-ScraperHub/1.0 (+https://bps.go.id; ipds@bps.go.id)
   ```

   Menyamar sebagai Chrome membuat trafik Anda masuk kategori "bot yang menyembunyikan diri" — yang justru diblokir lebih agresif oleh WAF modern. UA yang jujur memberi admin situs pilihan untuk **mem-whitelist** Anda alih-alih memblokir, dan melindungi BPS secara reputasional bila trafiknya dipertanyakan. Untuk lembaga statistik nasional yang mengambil data publik, ini pilihan default yang benar. Simpan penyamaran browser hanya untuk situs yang jelas-jelas menolak semua bot terdaftar.

---

#### Lapis 2 — Perilaku HTTP yang benar saat ditolak

Lapis ini memperbaiki temuan 2.2(c) dan 2.2(e). Yang harus ada:

1. **Kenali status code, jangan telan.** `429` dan `503 + Retry-After` berarti "tunggu", bukan "gagal". `403` berarti "identitas ditolak". `404` berarti "URL salah". Ketiganya butuh reaksi berbeda dan pesan berbeda ke operator.
2. **Backoff eksponensial dengan jitter, dan hormati `Retry-After`.** Ganti retry 1 detik / 2 detik di `target_url.go:209-242` dengan pola 5s → 15s → 60s berjitter, dan **jangan** retry `403` dengan identitas yang sama — retry seperti itu hanya mempercepat pencemaran IP.
3. **Circuit breaker per domain.** Setelah N kegagalan berturut-turut pada satu domain, hentikan semua job ke domain itu selama periode cooldown (misal 30–60 menit) dan tandai domainnya. Ini melindungi IP Anda **dan** situs target. Tanpa ini, satu jadwal harian yang gagal akan terus menghantam situs yang sudah memblokir Anda, sampai blokirnya jadi permanen.
4. **Deteksi halaman challenge, jangan simpan sebagai data.** Cloudflare/WAF sering membalas `HTTP 200` berisi halaman "Just a moment…" atau "Checking your browser". Saat ini halaman itu akan tersimpan sebagai hasil scraping yang "berhasil". Deteksi penandanya (judul halaman, `cf-mitigated`, panjang konten mencurigakan) dan tandai sebagai `CHALLENGE_DETECTED`.
5. **Hentikan `except Exception: pass`.** Ini prasyarat semua poin di atas. Setiap scraper harus melaporkan **mengapa** ia gagal.

---

#### Lapis 3 — Realisme sesi & fingerprint

Baru di lapis ini identitas klien menjadi relevan. Prinsipnya: **konsistensi, bukan keacakan.**

Kesalahan yang paling umum adalah mengganti-ganti User-Agent secara acak di dalam satu sesi. Itu bukan penyamaran — itu sinyal deteksi, karena tidak ada browser sungguhan yang berubah identitas di tengah sesi. Yang benar:

1. **Satu profil konsisten per sesi per domain.** User-Agent, `Accept-Language`, `Sec-CH-UA`, urutan header, dan versi TLS harus saling cocok. `google_news_scraper.py:306-310` sudah bergerak ke arah benar dengan mengirim `Accept` dan `Accept-Language`; yang lain belum.
2. **Cookie jar yang persisten per domain.** Sesi yang sudah pernah lolos challenge biasanya diberi cookie clearance yang berlaku beberapa jam. Saat ini setiap job memulai konteks browser baru dari nol, jadi Anda menghadapi challenge berulang-ulang tanpa perlu.
3. **Sadari batas penyamaran header.** UA Chrome yang dikirim oleh `requests` Python tetap punya **TLS/JA3 fingerprint Python** — WAF modern melihat ketidakcocokan itu dalam satu langkah. Kalau memang perlu tampil seperti browser, gunakan klien yang meniru sampai lapis TLS (kategori `curl_impersonate` / `tls-client` untuk HTTP, atau Playwright dengan profil stealth untuk browser) — bukan sekadar menukar string UA. Ini menjelaskan mengapa mengganti UA saja sering tidak memperbaiki apa pun.
4. **Untuk Playwright, seragamkan opsi peluncuran.** Saat ini hanya `css_scraper.py` yang memakai `--disable-blink-features=AutomationControlled`. Seragamkan (lihat 2.4), dan tetapkan `locale`, `timezone_id`, dan `viewport` yang wajar untuk Indonesia.

Catatan penting: lapis ini punya batas etis dan hukum. Untuk data publik di situs yang tidak melarang pengambilan otomatis, membuat klien terlihat wajar adalah rekayasa biasa. Tetapi bila sebuah situs secara eksplisit dan berulang menolak Anda, jawabannya adalah Lapis 0 (minta akses), bukan penyamaran yang makin dalam. Untuk lembaga negara, batas ini bukan formalitas.

---

#### Lapis 4 — Diversifikasi IP (proxy)

Baru di sini proxy masuk. Perlu dipahami tingkatannya, karena harga dan daya tahannya berbeda jauh:

| Tipe | Biaya relatif | Daya tahan | Catatan |
| :--- | :--- | :--- | :--- |
| **Datacenter** | termurah | rendah | Seluruh rentang ASN-nya sering sudah masuk daftar blokir. Berguna untuk situs yang tidak memakai WAF. |
| **ISP / static residential** | menengah | menengah–tinggi | IP residensial yang stabil. Titik seimbang terbaik untuk kebutuhan seperti BPS. |
| **Rotating residential** | mahal | tinggi | Dihitung per GB. Perlu kehati-hatian etis: sebagian penyedia memperoleh IP dari SDK pada perangkat pengguna tanpa persetujuan yang jelas. Untuk lembaga pemerintah, uji tuntas penyedia itu wajib. |
| **Mobile / 4G** | termahal | tertinggi | Berlebihan untuk kasus ini. |

Yang harus dibenahi di kode sebelum proxy apa pun dibeli:

1. **Ganti env var tunggal dengan abstraksi pool.** Satu tabel `proxies` (endpoint, tipe, region, status kesehatan, tingkat keberhasilan per domain) dan satu fungsi pemilih. Ini sekaligus memperbaiki temuan 2.2(d): implementasi proxy yang berbeda-beda di empat file akan hilang karena semuanya memanggil satu lapisan.
2. **Sticky session per domain, bukan rotasi per request.** Rotasi IP di tengah sesi akan membatalkan cookie clearance dan justru memicu challenge baru. Pertahankan satu IP untuk satu domain selama satu job.
3. **Health check dan pelacakan per domain.** Catat IP mana yang gagal di domain mana, lalu jangan pakai lagi kombinasi itu selama masa cooldown. Tanpa ini, pool Anda akan terbakar habis dalam hitungan minggu.
4. **Jangan lewati validasi SSRF.** `backend/pkg/urlvalidator` memblokir IP privat dan alamat metadata cloud. Rute proxy tidak boleh menjadi jalan memutar untuk itu, dan escape hatch `ALLOW_PRIVATE_IP_RESOLUTION` (lihat `urlvalidator`) jangan sampai aktif di produksi.
5. **Perhitungkan pengadaan.** Untuk BPS ini bukan detail sepele: proxy adalah langganan pihak ketiga yang perlu masuk mekanisme pengadaan, dan trafik Anda akan melewati infrastruktur pihak lain. Pertimbangkan sejak awal, bukan setelah teknisnya jadi.

---

#### Lapis 5 — Layanan unblocking terkelola

Ada kategori layanan yang menjual "berikan URL, terima HTML" dan menangani proxy, fingerprint, serta challenge sekaligus — Zyte API, Bright Data Web Unlocker, ScraperAPI, Oxylabs, Scrapfly. Secara teknis ini jalan tercepat dan sering paling murah bila dihitung dari total biaya rekayasa.

Tapi untuk BPS ada dua konsekuensi yang harus disadari dan diputuskan secara sadar, bukan diam-diam:

- **Tata kelola data.** Setiap URL yang Anda minta dikirim ke server pihak ketiga di luar negeri, beserta HTML balasannya. Untuk data publik ini biasanya dapat diterima; untuk apa pun yang menyentuh data pribadi atau sumber internal, tidak.
- **Ketergantungan dan pengadaan.** Berbasis langganan, ditagih per request, dan menciptakan ketergantungan vendor pada proses inti.

Rekomendasi saya: **jangan mulai dari sini**, tapi masukkan sebagai opsi sadar untuk segelintir domain bernilai tinggi yang tetap gagal setelah Lapis 1–4 dibenahi. Bila arsitektur fetcher di 2.4 sudah rapi, menambahkan penyedia semacam ini nantinya hanya berarti satu implementasi fetcher baru.

---

#### Lapis 6 — CAPTCHA

Jawaban jujurnya: **jangan.** Bila sebuah situs menampilkan CAPTCHA interaktif, itu pernyataan eksplisit bahwa akses otomatis tidak dikehendaki. Perlakukan sebagai kondisi terminal: tandai konfigurasi sebagai `CHALLENGE_DETECTED`, hentikan penjadwalannya, dan naikkan ke IPDS untuk ditempuh lewat Lapis 0 (permintaan akses resmi, kunci API, atau whitelist).

Saya tidak menyarankan layanan pemecah CAPTCHA untuk platform pemerintah. Selain melanggar ketentuan layanan hampir semua situs, risiko reputasionalnya bagi BPS tidak sebanding dengan nilai data yang diperoleh. Sumber data yang butuh pemecah CAPTCHA adalah sumber data yang tidak layak dipakai untuk statistik resmi.

---

### 2.4 Perubahan arsitektur: satu lapisan `fetcher` bersama

Ini refactor dengan nilai tertinggi di seluruh dokumen ini, dan sebaiknya dikerjakan sebelum lapis mana pun di atas diimplementasikan.

Saat ini logika anti-blokir **disalin dan berbeda-beda** di enam file: masing-masing scraper punya penanganan proxy sendiri, string User-Agent sendiri, dan timeout sendiri (lihat temuan 2.2a dan 2.2d). Akibatnya setiap perbaikan harus dikerjakan enam kali, dan dalam praktiknya tidak pernah dikerjakan enam kali — itulah sebabnya `keyword_scraper.py` masih rusak untuk proxy berkredensial sementara `css_scraper.py` sudah benar.

Yang perlu dibuat: satu modul `backend/workers/python/fetcher.py` sebagai **satu-satunya** pintu keluar jaringan, dengan dua fungsi — `fetch_http(url, **opts)` dan `fetch_browser(url, **opts)` — yang di dalamnya menangani:

- pemilihan proxy dari pool + sticky per domain
- profil header/UA yang konsisten per sesi
- batas laju dan jitter per domain
- backoff, `Retry-After`, dan circuit breaker
- cookie jar persisten per domain
- cache dan request kondisional (`ETag`/`If-Modified-Since`)
- deteksi halaman challenge
- pemetaan kegagalan ke kode error yang baku

Setelah itu keenam scraper teknik tinggal berisi **logika ekstraksi** saja, dan seluruh urusan anti-blokir dikelola di satu tempat. Ini juga membuat pengujian jauh lebih mudah, karena Anda bisa menguji perilaku anti-blokir tanpa menyentuh parsing.

Pendampingnya di sisi Go: satu tabel **kebijakan per domain** (`domains`) berisi laju maksimum, tingkat proxy yang dipakai, jam yang diizinkan, status blokir terakhir, dan catatan apakah sudah ada whitelist/izin resmi. Dengan itu IPDS bisa menyetel perilaku per situs tanpa menyentuh kode, dan Anda punya jawaban terdokumentasi bila ada pertanyaan tentang trafik BPS ke situs tertentu.

### 2.5 Buat kegagalan terlihat: taksonomi error

Frontend Anda **sudah** punya kerangkanya di `frontend/src/types/index.ts:193` — `ErrorType` mencakup `NETWORK`, `PARSE`, `TIMEOUT`, `AUTH`, `RATE_LIMIT`, `VALIDATION`. Yang belum ada adalah sisi worker yang mengisinya. Saat ini `dto.WorkerError` hanya pernah menerima `TIMEOUT`, `OUTPUT_LIMIT_EXCEEDED`, `EXECUTION_ERROR`, dan `VALIDATION_ERROR` — tidak satu pun yang bisa membedakan pemblokiran dari selector yang salah.

Kode minimum yang perlu ditambahkan, beserta pesan yang dilihat operator (bukan pesan teknis):

| Kode | Pemicu | Pesan untuk operator |
| :--- | :--- | :--- |
| `BLOCKED_403` | `403` dari situs target | "Situs menolak akses platform. Sudah dilaporkan ke IPDS." |
| `RATE_LIMITED_429` | `429`, atau `503` + `Retry-After` | "Situs meminta kami menunggu. Job akan dicoba ulang otomatis." |
| `CHALLENGE_DETECTED` | halaman Cloudflare / WAF | "Situs meminta verifikasi manusia. Perlu penanganan IPDS." |
| `SELECTOR_NOT_FOUND` | halaman termuat, elemen tidak ada | "Halaman berhasil dibuka, tapi elemen yang dipilih tidak ditemukan — kemungkinan tampilan situs berubah." |
| `EMPTY_RESULT` | selector cocok, teksnya kosong | "Elemen ditemukan tapi tidak berisi teks." |

Perbedaan antara `BLOCKED_403` dan `SELECTOR_NOT_FOUND` adalah pembeda antara operator yang tahu harus lapor ke IPDS dan operator yang menghabiskan satu jam mengubah selector yang sebenarnya sudah benar. Untuk platform yang menyasar pengguna non-teknis, ini bukan penyempurnaan — ini fitur inti, dan menjawab langsung dua pertanyaan Anda sekaligus.

### 2.6 Tata kelola & kepatuhan

Karena ini platform lembaga pemerintah, beberapa hal ini bukan opsional:

- **Hanya data publik.** Jangan pernah melewati login, paywall, atau kontrol akses. Jika butuh kredensial, itu tanda perlu perjanjian resmi, bukan scraping.
- **UU 27/2022 (PDP).** Bila halaman yang diambil memuat data pribadi (nama, NIK, alamat, kontak), Anda memproses data pribadi dengan segala kewajiban yang menyertainya. Rancang scraper agar **tidak mengambil** field semacam itu kecuali ada dasar hukum yang jelas.
- **Hormati ketentuan layanan dan `robots.txt`,** dan dokumentasikan keputusannya bila ada yang sengaja dikecualikan beserta alasannya.
- **Jejak audit.** Simpan siapa menjalankan apa, terhadap domain mana, dan kapan. Jadwal serta log job Anda sudah setengah jalan ke sana.
- **Atribusi sumber.** Setiap hasil ekspor sebaiknya memuat URL sumber dan waktu pengambilan — praktik baik statistik, sekaligus perlindungan bila angkanya nanti dipertanyakan.

---

## Peta Jalan Implementasi

Diurutkan berdasarkan rasio manfaat terhadap biaya. Tahap 1 sengaja diletakkan paling depan karena tanpa visibilitas, semua tahap berikutnya hanya menebak-nebak.

| Tahap | Isi | Perkiraan usaha | Biaya | Menjawab |
| :--- | :--- | :--- | :--- | :--- |
| **1** | Buat kegagalan terlihat: hapus `except Exception: pass`, terapkan taksonomi error (2.5), bedakan blokir dari selector salah | 1–2 hari | nol | Q2 |
| **2** | Sopan santun: batas laju + jitter per domain, `max_workers` per domain, UA jujur berkontak, patuhi `Retry-After`, jangan retry `403` | 2–3 hari | nol | Q2 |
| **3** | Lapisan `fetcher.py` bersama + tabel kebijakan `domains` (2.4) | ~1 minggu | nol | Q2 |
| **4** | UX katalog: field `Options` di `ParameterDefinition`, `technique` menjadi dropdown, `Category`/`Author` di API metode, pisahkan katalog per peran | 2–4 hari | nol | Q1 |
| **5** | Metode `rss_feed` terparameter penuh dengan dropdown sumber terkurasi IPDS (1.3) | ~1 minggu | nol | Q1 + Q2 |
| **6** | Cache + request kondisional (`ETag`/`If-Modified-Since`), circuit breaker per domain | 2–3 hari | nol | Q2 |
| **7** | Pool proxy (mulai dari ISP/static residential) — **hanya bila tahap 1–3 belum cukup** | ~1 minggu + langganan | berbayar | Q2 |
| **8** | Evaluasi layanan unblocking terkelola untuk sisa domain bernilai tinggi yang tetap gagal | asesmen | berbayar | Q2 |

Perhatikan bahwa tahap 1–6 seluruhnya **tanpa biaya langganan**, dan dari pengalaman pada beban kerja sebesar ini, tahap 1–3 saja biasanya sudah menghilangkan sebagian besar keluhan pemblokiran. Karena itu jangan mulai dari tahap 7.

---

## Lampiran — Rujukan Berkas

| Berkas | Perannya dalam dokumen ini |
| :--- | :--- |
| `backend/pkg/registry/registry.go:27-35` | `ParameterDefinition` — perlu field `Options` (1.4b) |
| `backend/pkg/registry/methods/target_url.go:48-54` | Parameter `technique` masih teks bebas (1.4a) |
| `backend/pkg/registry/methods/target_url.go:176-179, 209-242` | Retry yang memperburuk pemblokiran (2.2c) |
| `backend/pkg/registry/methods/google_news.go` | Contoh metode terparameter yang sudah benar untuk operator |
| `backend/handler/method_controller.go:22-31` | Belum mengirim `category`/`author` ke katalog (1.4c) |
| `backend/pkg/urlvalidator/` | Guard SSRF — jangan dilewati oleh rute proxy (Lapis 4.4) |
| `backend/service/job_service.go:390` | Timeout job 2 menit — perlu ditinjau ulang bila backoff ditambahkan |
| `backend/workers/python/worker.py` | Titik masuk & dispatcher worker |
| `backend/workers/python/css_scraper.py:51-83, 130-131` | Proxy/UA hardcoded; `except: pass` yang menyembunyikan blokir (2.2a, 2.2e, 2.2f) |
| `backend/workers/python/keyword_scraper.py:13-16` | Penanganan proxy yang rusak untuk kredensial (2.2d) |
| `backend/workers/python/headless_scraper.py:22-51` | Implementasi proxy/UA ketiga yang berbeda lagi (2.2d) |
| `backend/workers/python/google_news_scraper.py:14-20, 433` | `newspaper` tidak terpasang; 5 request paralel tanpa jeda (2.2b, 2.2g) |
| `backend/workers/python/requirements.txt:11` | `fake-useragent` terpasang tapi tidak dipakai (2.2a) |
| `frontend/src/types/index.ts:152-181, 193` | `MethodParam.Options`, `Method.category`, dan `ErrorType` sudah siap di frontend |
| `frontend/src/components/scrapers/DynamicScraperForm.tsx:192` | Sudah merender dropdown bila `options` tersedia (1.4b) |
| `docs/SCRAPER_MANAGEMENT_PIVOT.md` | Model katalog IPDS-sebagai-penyedia yang mendasari Bagian 1 |








