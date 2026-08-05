package handler

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestProxyController_GetHTML_NoURL(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctrl := NewProxyController()

	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request, _ = http.NewRequest("GET", "/proxy", nil)

	ctrl.GetHTML(ctx)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestProxyController_GetHTML_SSRF(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctrl := NewProxyController()

	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request, _ = http.NewRequest("GET", "/proxy?url=http://localhost:8080/admin", nil)

	ctrl.GetHTML(ctx)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestProxyController_GetHTML_InvalidScheme(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctrl := NewProxyController()

	w := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(w)
	ctx.Request, _ = http.NewRequest("GET", "/proxy?url=ftp://example.com", nil)

	ctrl.GetHTML(ctx)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, w.Code)
	}
}
