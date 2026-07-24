package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/pkg/response"
)

// ConfigController handles scraping configuration HTTP requests
type ConfigController struct {
	service contract.ConfigService
}

// NewConfigController creates a new ConfigController
func (c *ConfigController) InitService(s *contract.Service) {
	c.service = s.Config
}

// GetAll retrieves all scraping configs
// @Summary List all scraping configs
// @Description Get a list of all scraping configurations, optionally filtered by website_id
// @Tags Configs
// @Produce json
// @Security BearerAuth
// @Param website_id query int false "Filter by website ID"
// @Success 200 {object} response.APIResponse{data=[]models.ScrapeConfig}
// @Router /api/v1/configs [get]
func (h *ConfigController) GetAll(c *gin.Context) {
	var websiteID *int
	if widStr := c.Query("website_id"); widStr != "" {
		wid, err := strconv.Atoi(widStr)
		if err != nil {
			response.BadRequest(c, "Invalid website_id")
			return
		}
		websiteID = &wid
	}

	configs, err := h.service.GetAll(websiteID)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "Configs retrieved successfully", configs)
}

// Create creates a new scraping config
// @Summary Create a scraping config
// @Description Create a new scraping configuration for a website
// @Tags Configs
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body dto.CreateConfigRequest true "Config data"
// @Success 201 {object} response.APIResponse{data=models.ScrapeConfig}
// @Failure 400 {object} response.APIResponse
// @Router /api/v1/configs [post]
func (h *ConfigController) Create(c *gin.Context) {
	var req dto.CreateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	config, err := h.service.Create(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Config created successfully", config)
}

// GetByID retrieves a scraping config by ID
// @Summary Get config by ID
// @Description Get detailed information about a specific scraping configuration
// @Tags Configs
// @Produce json
// @Security BearerAuth
// @Param id path int true "Config ID"
// @Success 200 {object} response.APIResponse{data=models.ScrapeConfig}
// @Failure 404 {object} response.APIResponse
// @Router /api/v1/configs/{id} [get]
func (h *ConfigController) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid config ID")
		return
	}

	config, err := h.service.GetByID(id)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Config retrieved successfully", config)
}

// Update modifies an existing scraping config
// @Summary Update a scraping config
// @Description Update an existing scraping configuration
// @Tags Configs
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Config ID"
// @Param request body dto.UpdateConfigRequest true "Updated config data"
// @Success 200 {object} response.APIResponse{data=models.ScrapeConfig}
// @Failure 400,404 {object} response.APIResponse
// @Router /api/v1/configs/{id} [put]
func (h *ConfigController) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid config ID")
		return
	}

	var req dto.UpdateConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	config, err := h.service.Update(id, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, "Config updated successfully", config)
}

// Delete removes a scraping config
// @Summary Delete a scraping config
// @Description Delete a scraping configuration and all its associated schedulers and jobs
// @Tags Configs
// @Produce json
// @Security BearerAuth
// @Param id path int true "Config ID"
// @Success 200 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Router /api/v1/configs/{id} [delete]
func (h *ConfigController) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid config ID")
		return
	}

	if err := h.service.Delete(id); err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Config deleted successfully", nil)
}
