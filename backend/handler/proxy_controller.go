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
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		ctx.JSON(http.StatusBadGateway, gin.H{"error": "failed to fetch url: " + err.Error()})
		return
	}
	defer resp.Body.Close()

	// Only accept HTML responses
	contentType := resp.Header.Get("Content-Type")
	// If it's empty, we assume it's okay. If it's not empty, it must contain text/html
	if contentType != "" && len(contentType) >= 9 && contentType[:9] != "text/html" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "url did not return HTML content"})
		return
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read response body"})
		return
	}

	// Remove security headers that prevent framing
	ctx.Header("Access-Control-Allow-Origin", "*")
	ctx.Header("X-Frame-Options", "ALLOWALL")

	// Send raw HTML back
	ctx.Data(resp.StatusCode, "text/html; charset=utf-8", bodyBytes)
}
