package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/pkg/response"
)

type DashboardController struct {
	service contract.DashboardService
}

func (c *DashboardController) InitService(s *contract.Service) {
	c.service = s.Dashboard
}

func (c *DashboardController) GetSummary(ctx *gin.Context) {
	summary, err := c.service.GetSummary()
	if err != nil {
		response.InternalServerError(ctx, "Failed to get dashboard summary")
		return
	}

	response.OK(ctx, "Dashboard summary retrieved successfully", summary)
}
