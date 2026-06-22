package handler

import (
	"encoding/json"
	"net/http"

	"github.com/marchelrn/scrapers/contract"
)

type HealthHandler struct {
	service contract.HealthService
}

func NewHealthHandler(service contract.HealthService) *HealthHandler {
	return &HealthHandler{service: service}
}

func (h *HealthHandler) GetHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{
		"status": h.service.GetStatus(),
	})
}
