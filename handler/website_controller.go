package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/pkg/response"
)

// WebsiteController handles website HTTP requests
type WebsiteController struct {
	service contract.WebsiteService
}

// NewWebsiteController creates a new WebsiteController
func (c *WebsiteController) InitService(s *contract.Service) {
	c.service = s.Website
}

// GetAll retrieves all websites
// @Summary List all websites
// @Description Get a list of all website targets, optionally filtered by project_id
// @Tags Websites
// @Produce json
// @Security BearerAuth
// @Param project_id query int false "Filter by project ID"
// @Success 200 {object} response.APIResponse{data=[]models.Website}
// @Router /api/v1/websites [get]
func (h *WebsiteController) GetAll(c *gin.Context) {
	var projectID *int
	if pidStr := c.Query("project_id"); pidStr != "" {
		pid, err := strconv.Atoi(pidStr)
		if err != nil {
			response.BadRequest(c, "Invalid project_id")
			return
		}
		projectID = &pid
	}

	websites, err := h.service.GetAll(projectID)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "Websites retrieved successfully", websites)
}

// Create creates a new website target
// @Summary Create a website
// @Description Add a new website target for scraping
// @Tags Websites
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body dto.CreateWebsiteRequest true "Website data"
// @Success 201 {object} response.APIResponse{data=models.Website}
// @Failure 400 {object} response.APIResponse
// @Router /api/v1/websites [post]
func (h *WebsiteController) Create(c *gin.Context) {
	var req dto.CreateWebsiteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	website, err := h.service.Create(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Website created successfully", website)
}

// GetByID retrieves a website by ID
// @Summary Get website by ID
// @Description Get detailed information about a specific website target
// @Tags Websites
// @Produce json
// @Security BearerAuth
// @Param id path int true "Website ID"
// @Success 200 {object} response.APIResponse{data=models.Website}
// @Failure 404 {object} response.APIResponse
// @Router /api/v1/websites/{id} [get]
func (h *WebsiteController) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid website ID")
		return
	}

	website, err := h.service.GetByID(id)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Website retrieved successfully", website)
}

// Update modifies an existing website
// @Summary Update a website
// @Description Update an existing website target
// @Tags Websites
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Website ID"
// @Param request body dto.UpdateWebsiteRequest true "Updated website data"
// @Success 200 {object} response.APIResponse{data=models.Website}
// @Failure 400,404 {object} response.APIResponse
// @Router /api/v1/websites/{id} [put]
func (h *WebsiteController) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid website ID")
		return
	}

	var req dto.UpdateWebsiteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	website, err := h.service.Update(id, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, "Website updated successfully", website)
}

// Delete removes a website
// @Summary Delete a website
// @Description Delete a website target and all its associated configurations
// @Tags Websites
// @Produce json
// @Security BearerAuth
// @Param id path int true "Website ID"
// @Success 200 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Router /api/v1/websites/{id} [delete]
func (h *WebsiteController) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid website ID")
		return
	}

	if err := h.service.Delete(id); err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Website deleted successfully", nil)
}
