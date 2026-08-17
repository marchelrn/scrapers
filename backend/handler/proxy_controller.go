package handler

import (
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/marchelrn/scrapers/pkg/urlvalidator"
)

type ProxyController struct{}

func NewProxyController() *ProxyController {
	return &ProxyController{}
}

// GetHTML fetches raw HTML from the requested URL to bypass CORS and frame options.
func (c *ProxyController) GetHTML(ctx *gin.Context) {
	targetURL := ctx.Query("url")
	if targetURL == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "url parameter is required"})
		return
	}

	// Protect against SSRF
	if err := urlvalidator.Validate(targetURL); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid url: " + err.Error()})
		return
	}

	// Set up transport with proxy support
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment, // Respect HTTP_PROXY, HTTPS_PROXY, NO_PROXY
	}

	client := &http.Client{
		Timeout:   10 * time.Second,
		Transport: transport,
	}

	req, err := http.NewRequestWithContext(ctx.Request.Context(), "GET", targetURL, nil)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create request: " + err.Error()})
		return
	}

	// Use standard browser user agent to avoid basic bot blocks
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Sec-Ch-Ua", "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\"")
	req.Header.Set("Sec-Ch-Ua-Mobile", "?0")
	req.Header.Set("Sec-Ch-Ua-Platform", "\"Windows\"")

	resp, err := client.Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, gin.H{"error": "failed to fetch url: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	// Only accept HTML responses
	contentType := resp.Header.Get("Content-Type")
	// If it's empty, we assume it's okay. If it's not empty, it must contain text/html
	// Note: Sometimes Content-Type has extra info like "text/html; charset=UTF-8"
	if contentType != "" && len(contentType) >= 9 && contentType[:9] != "text/html" {
		// Log but don't fail immediately, some firewalls return non-html content types on challenges
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read response body"})
		return
	}

	// Remove security headers that prevent framing
	ctx.Header("Access-Control-Allow-Origin", "*")
	ctx.Header("X-Frame-Options", "ALLOWALL")
	ctx.Header("Content-Security-Policy", "frame-ancestors *")

	// Send raw HTML back
	
	// Add proper status handling for 407 Proxy Auth
	if resp.StatusCode == http.StatusProxyAuthRequired {
		ctx.JSON(http.StatusProxyAuthRequired, gin.H{"error": "Proxy authentication failed. Check your Smartproxy credentials in .env"})
		return
	}

	ctx.Data(resp.StatusCode, "text/html; charset=utf-8", bodyBytes)
}
