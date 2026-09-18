"""
Taksonomi error terpadu untuk seluruh worker scraping.

Masalah yang dipecahkan modul ini: sebelumnya hampir semua kegagalan berakhir
sebagai daftar kosong (`except Exception: pass`) atau satu kode generik
`EXECUTION_ERROR`. Akibatnya operator dari divisi non-IPDS tidak bisa
membedakan tiga situasi yang penanganannya sangat berbeda:

  1. "selector/parameter yang saya isi salah"      -> operator bisa perbaiki sendiri
  2. "situs targetnya menolak/memblokir sistem"    -> perlu tindakan IPDS
  3. "situsnya sedang bermasalah"                  -> cukup coba lagi nanti

Setiap kelas di bawah membawa tiga informasi:

  code       kode mesin yang dikirim pada output contract (dto.WorkerError.Code)
  hint       penjelasan + saran tindakan dalam Bahasa Indonesia, ditulis untuk
             pegawai non-teknis, bukan untuk developer
  retryable  apakah mencoba ulang dengan identitas yang sama masih masuk akal
             (403 misalnya TIDAK: mengulang hanya memperkuat pemblokiran)
"""


class ScraperError(Exception):
    """Induk semua error worker yang sudah terklasifikasi."""

    code = "EXECUTION_ERROR"
    hint = ""
    retryable = False
    # Apakah kegagalan ini dihitung sebagai "situs menolak kita" untuk
    # keperluan circuit breaker per domain.
    counts_against_domain = False

    def __init__(self, message, url=None, http_status=None, retry_after=None, hint=None):
        super().__init__(message)
        self.message = message
        self.url = url
        self.http_status = http_status
        self.retry_after = retry_after
        if hint is not None:
            self.hint = hint

    def public_message(self):
        """Pesan gabungan yang layak ditampilkan pada UI operator."""
        parts = [self.message]
        if self.hint:
            parts.append("Saran: " + self.hint)
        return " | ".join(parts)

    def to_dict(self):
        return {
            "code": self.code,
            "message": self.public_message(),
            "url": self.url,
            "http_status": self.http_status,
            "retry_after": self.retry_after,
        }


# --- Kesalahan konfigurasi dari sisi kita sendiri -------------------------

class ValidationError(ScraperError):
    code = "VALIDATION_ERROR"
    hint = ("Periksa kembali parameter konfigurasi (URL, selector, atau kata kunci). "
            "Kesalahan ini berasal dari isian konfigurasi, bukan dari situs target.")


class SelectorNotFoundError(ScraperError):
    code = "SELECTOR_NOT_FOUND"
    hint = ("Halaman berhasil diambil, tetapi elemen yang ditunjuk selector tidak ada. "
            "Biasanya struktur halaman berubah. Buka ulang Visual Selector dan pilih "
            "kembali elemen yang ingin diambil.")


class EmptyResultError(ScraperError):
    code = "EMPTY_RESULT"
    hint = ("Halaman berhasil diambil dan selector cocok, tetapi isinya kosong. "
            "Kemungkinan konten dimuat lewat interaksi pengguna, atau memang tidak "
            "ada data pada periode ini.")


# --- Situs target menolak sistem ini -------------------------------------

class RobotsDisallowedError(ScraperError):
    code = "ROBOTS_DISALLOWED"
    counts_against_domain = False
    hint = ("Situs target menyatakan pada robots.txt bahwa alamat ini tidak boleh "
            "diakses otomatis. Jangan dipaksa. Opsi yang benar: minta izin resmi ke "
            "pengelola situs, gunakan feed/RSS/API resmi mereka, atau ajukan ke IPDS "
            "untuk didaftarkan sebagai pengecualian setelah izin diperoleh.")


class BlockedError(ScraperError):
    code = "BLOCKED_403"
    retryable = False
    counts_against_domain = True
    hint = ("Situs target menolak permintaan (403). Mengulang dengan identitas yang "
            "sama hanya memperkuat pemblokiran. Laporkan ke IPDS: domain ini perlu "
            "penyesuaian kebijakan akses atau izin resmi.")


class RateLimitedError(ScraperError):
    code = "RATE_LIMITED_429"
    retryable = True
    counts_against_domain = True
    hint = ("Sistem mengambil data terlalu sering untuk situs ini (429). Jadwal "
            "penarikan perlu dilonggarkan. Coba lagi setelah jeda yang diminta situs.")


class ChallengeDetectedError(ScraperError):
    code = "CHALLENGE_DETECTED"
    retryable = False
    counts_against_domain = True
    hint = ("Situs target memasang perlindungan bot (Cloudflare/DataDome/WAF) dan "
            "menyajikan halaman verifikasi, bukan konten. Melewati verifikasi ini "
            "bukan praktik yang benar. Ajukan ke IPDS untuk menempuh jalur akses "
            "resmi ke pengelola situs.")


class AuthFailedError(ScraperError):
    code = "AUTH_FAILED"
    hint = ("Situs target memerlukan login untuk membuka halaman ini (401). "
            "Sistem tidak menyimpan kredensial apa pun, sehingga halaman "
            "tersebut tidak dapat diambil. Ajukan ke IPDS untuk menempuh "
            "jalur akses resmi ke pengelola situs.")


# --- Masalah di sisi situs / jaringan ------------------------------------

class NotFoundError(ScraperError):
    code = "NOT_FOUND_404"
    hint = ("Alamat tidak ditemukan di situs target (404/410). Halaman mungkin "
            "sudah dipindah atau dihapus. Perbarui URL pada konfigurasi.")


class UpstreamError(ScraperError):
    code = "UPSTREAM_ERROR"
    retryable = True
    counts_against_domain = True
    hint = ("Situs target sedang bermasalah (error 5xx). Ini di luar kendali kita; "
            "jadwal berikutnya biasanya sudah normal kembali.")


class FetchTimeoutError(ScraperError):
    code = "FETCH_TIMEOUT"
    retryable = True
    counts_against_domain = True
    hint = ("Situs target tidak merespons dalam batas waktu. Bila berulang, "
            "kurangi frekuensi penarikan atau perbesar batas waktu.")


class NetworkError(ScraperError):
    code = "NETWORK_ERROR"
    retryable = True
    counts_against_domain = True
    hint = ("Koneksi ke situs target gagal (DNS/TLS/jaringan). Periksa konektivitas "
            "server dan konfigurasi proxy.")


class ProxyConfigError(ScraperError):
    """Proxy keluar milik kita sendiri yang bermasalah, bukan situs target.

    Dipisahkan dari NetworkError karena dua alasan praktis. Pertama, pesannya harus
    menunjuk ke konfigurasi platform, bukan menyuruh operator memeriksa alamat yang
    ia isi -- alamatnya benar, proxy kita yang menolak. Kedua, kegagalan ini TIDAK
    boleh dihitung sebagai "situs menolak kita": bila dihitung, satu proxy mati akan
    membekukan setiap domain yang dicoba lewat circuit breaker selama 15 menit,
    padahal tidak satu pun domain itu pernah menolak kita.
    """

    code = "PROXY_ERROR"
    retryable = False
    counts_against_domain = False
    hint = ("Proxy keluar yang dipakai platform menolak atau tidak dapat dihubungi. "
            "Ini masalah konfigurasi server, bukan kesalahan isian Anda maupun "
            "penolakan dari situs target. Laporkan ke IPDS agar kredensial atau kuota "
            "proxy (HTTP_PROXY/HTTPS_PROXY) diperiksa; sementara itu penarikan dapat "
            "dijalankan tanpa proxy.")


class ContentTypeError(ScraperError):
    code = "CONTENT_TYPE_MISMATCH"
    hint = ("Situs mengembalikan jenis konten yang tidak sesuai harapan (misal HTML "
            "padahal seharusnya JSON). Sering merupakan tanda halaman blokir atau "
            "halaman login.")


class BrowserError(ScraperError):
    code = "BROWSER_ERROR"
    retryable = True
    hint = ("Browser internal (Playwright) gagal menjalankan halaman. Bila berulang, "
            "laporkan ke IPDS karena kemungkinan masalah pada lingkungan server.")


# --- Perlindungan diri sendiri -------------------------------------------

class CircuitOpenError(ScraperError):
    code = "CIRCUIT_OPEN"
    retryable = False
    hint = ("Sistem menghentikan sementara akses ke domain ini karena beberapa "
            "percobaan terakhir ditolak. Jeda ini disengaja agar alamat IP BPS tidak "
            "masuk daftar hitam permanen. Tunggu sampai masa jeda berakhir.")


ALL_CODES = sorted({
    cls.code
    for cls in (
        ScraperError, ValidationError, SelectorNotFoundError, EmptyResultError,
        RobotsDisallowedError, BlockedError, RateLimitedError, ChallengeDetectedError,
        AuthFailedError, NotFoundError, UpstreamError, FetchTimeoutError, NetworkError,
        ProxyConfigError, ContentTypeError, BrowserError, CircuitOpenError,
    )
})
