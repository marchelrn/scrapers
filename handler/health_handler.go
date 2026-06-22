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

func (h *HealthHandler) GetHealth(ctx *gin.Context) {
	response := h.service.GetStatus()

	ctx.JSON(http.StatusOK, response)
}
