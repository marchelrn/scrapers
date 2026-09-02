package handler

import (
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/marchelrn/scrapers/pkg/urlvalidator"
)

type ProxyController struct{}

func NewProxyController() *ProxyController {
	return &ProxyController{}
}

// proxyFetchTimeout dibuat lebih longgar dari 10 detik sebelumnya karena banyak
// portal pemda daerah memang lambat, dan batas 10 detik membuat Visual Selector
// gagal pada situs yang sebenarnya bisa diambil.
const proxyFetchTimeout = 20 * time.Second

// Penanda halaman verifikasi (Cloudflare, DataDome, Imperva, PerimeterX, DDoS-Guard).
// Halaman semacam ini sering dikirim dengan status HTTP 200, sehingga tanpa
// pemeriksaan isi ia akan terlihat seperti pengambilan yang berhasil -- dan
// operator dibiarkan memilih elemen dari halaman "Just a moment...".
var proxyChallengeMarkers = []string{
	"just a moment",
	"checking your browser before accessing",
	"attention required! | cloudflare",
	"cf-browser-verification",
	"cf_chl_opt",
	"enable javascript and cookies to continue",
	"captcha-delivery.com",
	"datadome",
	"incapsula incident id",
	"_incapsula_resource",
	"perimeterx",
	"px-captcha",
	"verifying you are human",
	"ddos-guard",
}

func proxyLooksLikeChallenge(header http.Header, body string) bool {
	for _, key := range []string{"cf-mitigated", "x-datadome", "x-datadome-cid", "x-iinfo"} {
		if header.Get(key) != "" {
			return true
		}
	}
	if strings.Contains(strings.ToLower(header.Get("Server")), "ddos-guard") {
		return true
	}

	lower := strings.ToLower(body)
	if len(lower) > 200000 {
		lower = lower[:200000]
	}
	for _, marker := range proxyChallengeMarkers {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

// --- Proxy keluar milik kita sendiri -------------------------------------
//
// Ketika HTTP_PROXY/HTTPS_PROXY diisi, kegagalan proxy TIDAK tiba sebagai
// respons HTTP. Untuk target https, proxy menolak pada tahap CONNECT sehingga
// client.Do mengembalikan error dan pemeriksaan resp.StatusCode == 407 di bawah
// tidak pernah tercapai -- kegagalannya tersamar sebagai "server tidak berhasil
// menghubungi situs target", yang menuduh alamat isian operator padahal proxy
// kitalah yang menolak.

// Kredensial proxy tidak boleh ikut tampil pada pesan yang dibaca operator.
var proxyUserinfoRe = regexp.MustCompile(`//[^/\s:@]+:[^/\s@]+@`)

func scrubProxyCredentials(text string) string {
	return proxyUserinfoRe.ReplaceAllString(text, "//***:***@")
}

// proxyEndpoint mengembalikan host:port proxy tanpa kredensial, atau "" bila
// tidak ada proxy yang dikonfigurasi.
func proxyEndpoint() string {
	for _, name := range []string{"HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"} {
		raw := strings.TrimSpace(os.Getenv(name))
		if raw == "" {
			continue
		}
		if !strings.Contains(raw, "://") {
			raw = "http://" + raw
		}
		parsed, err := url.Parse(raw)
		if err != nil || parsed.Host == "" {
			continue
		}
		return parsed.Host
	}
	return ""
}

var proxyFailureMarkers = []string{
	"proxy authentication required",
	"proxyconnect",
	"tunnel connection failed",
	"cannot connect to proxy",
	"http: error connecting to proxy",
}

// classifyProxyTransportError memisahkan "proxy kita bermasalah" dari "situs
// target tidak dapat dihubungi". Keduanya gagal di client.Do, tetapi tindakan
// yang perlu diambil sangat berbeda: yang pertama urusan IPDS, yang kedua bisa
// jadi salah alamat.
func classifyProxyTransportError(err error) (string, string, bool) {
	endpoint := proxyEndpoint()
	if endpoint == "" {
		return "", "", false
	}
	detail := scrubProxyCredentials(err.Error())
	lower := strings.ToLower(detail)
	for _, marker := range proxyFailureMarkers {
		if strings.Contains(lower, marker) {
			code := "PROXY_ERROR"
			reason := "tidak dapat dihubungi"
			if strings.Contains(lower, "proxy authentication required") || strings.Contains(lower, "407") {
				code = "PROXY_AUTH_FAILED"
				reason = "menolak kredensial yang dipakai platform"
			}
			return code,
				"Proxy keluar " + endpoint + " " + reason + ". Situs target belum pernah dihubungi, " +
					"jadi ini bukan penolakan dari situs itu dan bukan kesalahan alamat yang Anda isi. " +
					"Laporkan ke IPDS agar kredensial atau kuota proxy diperiksa. Detail teknis: " + detail,
				true
		}
	}
	return "", "", false
}

// classifyProxyFailure menerjemahkan balasan situs target menjadi kode dan pesan
// yang bisa dipahami operator.
//
// Sebelumnya status target diteruskan mentah lewat ctx.Data, sehingga sebuah 403
// dari situs target membuat axios di frontend menolak respons dan hanya
// menampilkan "Gagal mengambil HTML target via proxy". Alasan sebenarnya --
// diblokir, dibatasi laju, halaman verifikasi, atau alamat salah -- terbuang.
func classifyProxyFailure(status int, header http.Header, body string) (string, string, bool) {
	if proxyLooksLikeChallenge(header, body) {
		return "CHALLENGE_DETECTED",
			"Situs target menampilkan halaman verifikasi otomatis (Cloudflare/WAF), bukan halaman aslinya. " +
				"Visual Selector tidak dapat dipakai di sini. Gunakan teknik 'Cari Kata Kunci' atau 'Headless' " +
				"yang menjalankan peramban sungguhan, atau ajukan ke IPDS untuk mengurus akses resmi ke situs ini.",
			true
	}

	switch {
	case status >= 200 && status < 300:
		return "", "", false
	case status == http.StatusUnauthorized:
		return "AUTH_FAILED",
			"Situs target meminta autentikasi (HTTP 401). Halaman ini tidak bisa diambil tanpa kredensial.", true
	case status == http.StatusForbidden, status == http.StatusUnavailableForLegalReasons:
		return "BLOCKED_403",
			"Situs target menolak permintaan dari server ini (HTTP " + http.StatusText(status) + "). " +
				"Ini penolakan dari sisi situs, bukan kesalahan isian Anda. Coba lagi nanti, " +
				"atau laporkan ke IPDS agar situs ini didaftarkan untuk penanganan khusus.", true
	case status == http.StatusNotFound, status == http.StatusGone:
		return "NOT_FOUND",
			"Alamat tidak ditemukan di situs target (HTTP 404/410). Periksa kembali URL yang Anda masukkan.", true
	case status == http.StatusTooManyRequests:
		return "RATE_LIMITED_429",
			"Situs target membatasi jumlah permintaan (HTTP 429). Tunggu beberapa menit sebelum mencoba lagi.", true
	case status >= 500:
		return "UPSTREAM_ERROR",
			"Situs target sedang bermasalah (HTTP " + http.StatusText(status) + "). Ini di luar kendali platform; coba lagi nanti.", true
	default:
		return "UPSTREAM_ERROR",
			"Situs target membalas dengan status yang tidak diharapkan (HTTP " + http.StatusText(status) + ").", true
	}
}

// GetHTML fetches raw HTML from the requested URL to bypass CORS and frame options.
func (c *ProxyController) GetHTML(ctx *gin.Context) {
	targetURL := strings.TrimSpace(ctx.Query("url"))
	if targetURL == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":  "VALIDATION_ERROR",
			"error": "Parameter 'url' wajib diisi.",
		})
		return
	}

	// Alamat tanpa skema adalah kesalahan isian yang paling sering terjadi.
	// Ditambahkan otomatis agar operator tidak perlu tahu soal skema URL.
	if !strings.HasPrefix(targetURL, "http://") && !strings.HasPrefix(targetURL, "https://") {
		targetURL = "https://" + targetURL
	}

	// Protect against SSRF
	if err := urlvalidator.Validate(targetURL); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":  "VALIDATION_ERROR",
			"error": "URL tidak dapat diakses: " + err.Error(),
		})
		return
	}

	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment, // Respect HTTP_PROXY, HTTPS_PROXY, NO_PROXY
	}

	client := &http.Client{
		Timeout:   proxyFetchTimeout,
		Transport: transport,
	}

	req, err := http.NewRequestWithContext(ctx.Request.Context(), "GET", targetURL, nil)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":  "VALIDATION_ERROR",
			"error": "URL tidak dapat diproses: " + err.Error(),
		})
		return
	}

	// Visual Selector menampilkan halaman untuk dilihat manusia, jadi identitas
	// peramban memang wajar di sini. Accept-Language disamakan dengan worker
	// (id-ID) supaya halaman yang dipilih operator sama dengan halaman yang nanti
	// diambil oleh job.
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7")
	req.Header.Set("Accept-Language", "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7")
	req.Header.Set("Sec-Ch-Ua", "\"Not_A Brand\";v=\"24\", \"Chromium\";v=\"131\", \"Google Chrome\";v=\"131\"")
	req.Header.Set("Sec-Ch-Ua-Mobile", "?0")
	req.Header.Set("Sec-Ch-Ua-Platform", "\"Windows\"")

	resp, err := client.Do(req)
	if err != nil {
		if code, message, isProxy := classifyProxyTransportError(err); isProxy {
			ctx.JSON(http.StatusBadGateway, gin.H{"code": code, "error": message})
			return
		}
		message := "Server tidak berhasil menghubungi situs target: " + scrubProxyCredentials(err.Error())
		if strings.Contains(err.Error(), "context canceled") {
			message = "Permintaan dibatalkan sebelum situs target menjawab."
		} else if strings.Contains(err.Error(), "Timeout") || strings.Contains(err.Error(), "timeout") {
			message = "Situs target tidak menjawab dalam 20 detik. Situs mungkin sangat lambat atau sedang menahan permintaan dari server ini."
		} else if strings.Contains(err.Error(), "no such host") {
			message = "Nama domain tidak dapat ditemukan. Periksa kembali ejaan alamatnya."
		} else if strings.Contains(err.Error(), "certificate") {
			message = "Sertifikat TLS situs target tidak valid, sehingga koneksi dihentikan demi keamanan."
		}
		ctx.JSON(http.StatusBadGateway, gin.H{"code": "NETWORK_ERROR", "error": message})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusProxyAuthRequired {
		ctx.JSON(http.StatusBadGateway, gin.H{
			"code":  "PROXY_AUTH_FAILED",
			"error": "Autentikasi proxy gagal (HTTP 407). Periksa kredensial proxy pada konfigurasi backend.",
		})
		return
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, gin.H{
			"code":  "NETWORK_ERROR",
			"error": "Isi halaman terputus di tengah pengambilan: " + err.Error(),
		})
		return
	}

	if code, message, failed := classifyProxyFailure(resp.StatusCode, resp.Header, string(bodyBytes)); failed {
		ctx.JSON(http.StatusBadGateway, gin.H{
			"code":          code,
			"error":         message,
			"target_status": resp.StatusCode,
			"target_url":    targetURL,
		})
		return
	}

	// Remove security headers that prevent framing
	ctx.Header("Access-Control-Allow-Origin", "*")
	ctx.Header("X-Frame-Options", "ALLOWALL")
	ctx.Header("Content-Security-Policy", "frame-ancestors *")
	// Alamat akhir setelah pengalihan; dipakai frontend agar selector disimpan
	// terhadap URL yang benar-benar diambil.
	ctx.Header("X-Proxy-Final-Url", resp.Request.URL.String())
	ctx.Header("Access-Control-Expose-Headers", "X-Proxy-Final-Url")

	ctx.Data(http.StatusOK, "text/html; charset=utf-8", bodyBytes)
}
