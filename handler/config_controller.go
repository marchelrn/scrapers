package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/pkg/response"
)

// ScrapingConfigController handles scraping configuration HTTP requests.
type ScrapingConfigController struct {
	service contract.ScrapingConfigService
}

func (ctrl *ScrapingConfigController) InitService(s *contract.Service) {
	ctrl.service = s.ScrapingConfig
}

// GetAll retrieves all scraping configs.
func (h *ScrapingConfigController) GetAll(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")

	configs, err := h.service.GetAll(userID.(string), userRole.(string))
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "Configs retrieved successfully", configs)
}

// Create creates a new scraping config.
func (h *ScrapingConfigController) Create(c *gin.Context) {
	var req dto.CreateScrapingConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "user not authenticated")
		return
	}

	config, err := h.service.Create(req, userID.(string))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Config created successfully", config)
}

// GetByID retrieves a scraping config by UUID.
func (h *ScrapingConfigController) GetByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Config ID is required")
		return
	}

	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")

	config, err := h.service.GetByID(id, userID.(string), userRole.(string))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Config retrieved successfully", config)
}

// Update modifies an existing scraping config.
func (h *ScrapingConfigController) Update(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Config ID is required")
		return
	}

	var req dto.UpdateScrapingConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")

	config, err := h.service.Update(id, req, userID.(string), userRole.(string))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, "Config updated successfully", config)
}

// Delete removes a scraping config.
func (h *ScrapingConfigController) Delete(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Config ID is required")
		return
	}

	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")

	if err := h.service.Delete(id, userID.(string), userRole.(string)); err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Config deleted successfully", nil)
}
