# Sesi 10: Rencana Integrasi Visual Selector (Point-and-Click)

Dokumen ini merangkum *Blueprint* (cetak biru) dan rancangan kerja untuk membangun antarmuka "Low Code" berbasis Visual Selector (Point-and-Click) bagi pengguna sistem Manajemen Scrapers BPS.

Dokumen ini disiapkan khusus untuk tim pengembang Frontend agar selaras dengan kemampuan Backend Golang dan Worker Python yang sudah selesai di tahap MVP.

---

## 1. Konsep & Tujuan Fitur

Fitur **Visual Selector** bertujuan untuk membebaskan pengguna dari keharusan mempelajari *sintaks* CSS Selector atau XPath saat menggunakan metode ekstraksi Web. 

**Cara Kerja User Experience (UX):**
1. User memasukkan URL target (misal: `https://bps.go.id/inflasi`).
2. Aplikasi web (Frontend) menampilkan pratinjau langsung dari halaman tersebut di layar.
3. User menyorot dan mengklik elemen yang ingin diambil (misalnya judul artikel atau sel tabel) dengan bantuan kursor mouse (elemen akan disorot warna saat _hover_).
4. Aplikasi otomatis mencari pola elemen sejenis di halaman tersebut dan menyorotnya.
5. User menekan "Simpan", lalu aplikasi mengonversi hasil klik tersebut menjadi *CSS Selector* atau *XPath* secara tak kasat mata dan mengirimkannya ke Backend.

> **Penting (Co-existence):** Fitur Visual Selector ini tidak menyingkirkan fitur "Low Code Keyword Search" (DuckDuckGo News Web Search) yang dibuat pada Sesi 7.1. Keduanya hidup berdampingan. User dapat memilih: **Mencari lewat Keyword** (tanpa perlu URL sama sekali) ATAU **Visual Selector** (untuk data pada URL spesifik yang strukturnya rumit seperti tabel).

---

## 2. Kebutuhan di Sisi Frontend (Implementation Guide)

Tim Frontend memegang peran sentral dalam menerjemahkan antarmuka visual (klik) menjadi bahasa mesin (CSS/XPath). Berikut komponen utama yang wajib dibangun:

### A. IFrame Sandbox & DOM Rendering
Situs web target tidak dapat begitu saja disisipkan dalam `<iframe src="https://target.com">` karena aturan *Cross-Origin Resource Sharing (CORS)* dan proteksi *X-Frame-Options*. 
**Tugas Frontend:** 
- Menggunakan endpoint *Proxy* dari backend untuk memuat HTML mentah dari target.
- Memasukkan HTML mentah tersebut ke dalam elemen `<iframe sandbox="allow-same-origin allow-scripts">` atau melalui _Shadow DOM_ (seperti implementasi ekstensi browser).

### B. JavaScript DOM Injection (Pendeteksi Kursor)
Setelah halaman termuat di dalam IFrame, Frontend harus menyuntikkan skrip JS (injected script) untuk menangani interaksi pengguna:
- **Mouseover / Hover:** Menambahkan _style_ pembatas (mis. `outline: 2px solid red; background: rgba(255,0,0,0.3);`) setiap kali _event mouseover_ aktif pada sebuah _node_ HTML (`div, p, td, tr, h1-h6`).
- **Mouseclick:** Merekam elemen mana yang diklik oleh pengguna.

### C. Algoritma Kalkulasi Selector (Generator)
Saat pengguna mengklik elemen, Frontend wajib mengkalkulasi *"path"* unik elemen tersebut.
- **Logika:** Menelusuri hirarki elemen HTML (DOM Tree) ke atas (`element.parentNode`).
- **Contoh:** Jika user mengklik sel tabel, algoritma mengekstrak tag `<td>`, melihat induknya `<tr>`, lalu mencari apakah tabel utama memiliki `id` atau `class` spesifik.
- **Library Bantuan:** Tim Frontend dapat menggunakan pustaka sumber terbuka (Open Source) yang sudah teruji seperti [**finder**](https://github.com/antonmedv/finder) (CSS Selector Generator) atau [**optimal-select**](https://github.com/fczbkk/optimal-select) untuk Javascript agar tidak perlu menulis algoritma kalkulasi ini dari nol.

### D. Highlight Similar Elements (Pendeteksian Ganda)
Setelah _CSS Selector_ tercipta dari klik pertama, Frontend dapat menggunakan perintah `document.querySelectorAll(generatedSelector)` untuk mewarnai elemen lain yang sejenis di layar, memberi konfirmasi visual kepada user bahwa *"Ini seluruh deret data yang akan diambil"*.

---

## 3. Kebutuhan / Penyesuaian di Sisi Backend

Meskipun fondasi Backend kita (Sesi 3.1 & 4.3) sudah sempurna untuk menerima dan mengeksekusi parameter `technique: "css"` beserta parameter `selector: "..."`, ada satu penyesuaian khusus (Endpoint) yang wajib disiapkan di Golang agar fitur Frontend ini bisa bekerja mulus.

### A. Pembuatan Endpoint "CORS Proxy" (`GET /proxy`)
Seperti dijelaskan pada bagian 2A, Frontend akan ditolak browsernya jika mencoba memuat situs web lain secara langsung. Backend Golang wajib menyediakan jalur untuk mengunduh HTML tersebut dan mengirimkannya ke Frontend dengan "CORS yang diizinkan".

**Spesifikasi API Backend Tambahan:**
- Endpoint: `GET /api/proxy?url=https://target.com`
- Fungsi: Golang akan melakukan HTTP GET (via `net/http` atau `resty`) ke URL yang diminta, membuang _Security Headers_ (seperti `X-Frame-Options` dan `Content-Security-Policy`), lalu mengembalikan string teks HTML mentah (`text/html`) kepada Frontend. 

### B. Endpoint Registry (Tetap Sama)
Saat user selesai menggunakan Visual Selector dan menekan tombol "Simpan", Frontend akan mengirimkan *payload* yang persis sama dengan Sesi 4.1 ke Backend:
```json
{
  "name": "Data Target Visual",
  "method_code": "target_url",
  "status": "active",
  "parameters": [
    { "parameter_name": "url", "parameter_value": "https://bps.go.id/inflasi" },
    { "parameter_name": "technique", "parameter_value": "css" },
    { "parameter_name": "selector", "parameter_value": "table#data > tbody > tr > td:nth-child(2)" }
  ]
}
```
Backend Golang **tidak perlu tahu** bahwa `parameter_value` tersebut digenerate oleh Visual Selector Frontend; Backend hanya menggunakannya dan memanggil worker Python.

---

## 4. Kesimpulan Rencana (Plan)
Untuk merealisasikan fitur ini di masa depan:
1. **Developer Backend** hanya perlu menambahkan satu rute `GET /proxy` yang aman (tanpa _SSRF exploit_) yang mereturn HTML asli.
2. **Developer Frontend** bertanggung jawab penuh menyisipkan Iframe, menginjeksi skrip _hover_, memakai pustaka pihak ketiga penentu selector (`finder.js`), dan menyambungkannya ke rute Backend. 
3. Opsi pencarian instan berbasis **Keyword Search (DuckDuckGo)** tetap disediakan sebagai menu andalan ("Fast Track") bagi pengguna yang tidak ingin membuka URL target sama sekali.
