package routes

import (
	"net/http"

	"github.com/marchelrn/scrapers/handler"
)

func NewRouter(healthHandler *handler.HealthHandler) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthHandler.GetHealth)
	return mux
}
