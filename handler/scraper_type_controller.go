package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/pkg/response"
)

// ScraperTypeController handles scraper type HTTP requests.
type ScraperTypeController struct {
	service contract.ScraperTypeService
}

func (ctrl *ScraperTypeController) InitService(s *contract.Service) {
	ctrl.service = s.ScraperType
}

// GetAll retrieves all scraper types.
func (h *ScraperTypeController) GetAll(c *gin.Context) {
	scraperTypes, err := h.service.GetAll()
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "Scraper types retrieved successfully", scraperTypes)
}

// Create creates a new scraper type.
func (h *ScraperTypeController) Create(c *gin.Context) {
	var req dto.CreateScraperTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	scraperType, err := h.service.Create(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Scraper type created successfully", scraperType)
}

// GetByID retrieves a scraper type by ID.
func (h *ScraperTypeController) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid scraper type ID")
		return
	}

	scraperType, err := h.service.GetByID(id)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Scraper type retrieved successfully", scraperType)
}

// Update modifies an existing scraper type.
func (h *ScraperTypeController) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid scraper type ID")
		return
	}

	var req dto.UpdateScraperTypeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	scraperType, err := h.service.Update(id, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, "Scraper type updated successfully", scraperType)
}

// Delete removes a scraper type.
func (h *ScraperTypeController) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid scraper type ID")
		return
	}

	if err := h.service.Delete(id); err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Scraper type deleted successfully", nil)
}
