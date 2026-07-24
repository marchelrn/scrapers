package middleware

import (
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/marchelrn/scrapers/config"
)

// CORSMiddleware configures CORS for the API
func CORSMiddleware(cfg *config.Config) gin.HandlerFunc {
	origin := cfg.URL
	if origin == "" {
		origin = "http://localhost:8080"
	}
	if origin != "*" && !strings.HasPrefix(origin, "http://") && !strings.HasPrefix(origin, "https://") {
		origin = "http://" + origin
	}

	corsConfig := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"},
		AllowHeaders:     []string{"Origin", "Content-Length", "Content-Type", "Authorization", "Accept", "X-Requested-With"},
		ExposeHeaders:    []string{"Content-Length"},
		MaxAge:           12 * time.Hour,
	}

	if origin == "*" {
		corsConfig.AllowAllOrigins = true
		corsConfig.AllowCredentials = false
	} else {
		corsConfig.AllowOrigins = []string{origin}
		corsConfig.AllowCredentials = true
	}

	return cors.New(corsConfig)
}
