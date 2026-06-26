package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/marchelrn/scrapers/contract"
)

type HealthHandler struct {
	service contract.HealthService
}

func (c *HealthHandler) InitService(svc contract.HealthService) {
	c.service = svc
}

// @Schemes http
// @Description Get health status of the server
// @Tags health
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Router /health [get]
func (h *HealthHandler) GetHealth(ctx *gin.Context) {
	response := h.service.GetStatus()

	ctx.JSON(http.StatusOK, response)
}
