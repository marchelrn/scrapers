package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/pkg/response"
)

// ScrapingJobController handles scraping job HTTP requests.
type ScrapingJobController struct {
	service contract.ScrapingJobService
}

func (ctrl *ScrapingJobController) InitService(s *contract.Service) {
	ctrl.service = s.ScrapingJob
}

// GetAll retrieves all jobs, optionally filtered by config_id.
func (h *ScrapingJobController) GetAll(c *gin.Context) {
	var configID *string
	if cidStr := c.Query("config_id"); cidStr != "" {
		configID = &cidStr
	}

	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	offset := 0
	if pageStr := c.Query("page"); pageStr != "" {
		if page, err := strconv.Atoi(pageStr); err == nil && page > 0 {
			offset = (page - 1) * limit
		}
	}

	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")

	jobs, err := h.service.GetAll(configID, userID.(string), userRole.(string), limit, offset)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "Jobs retrieved successfully", jobs)
}

// Create queues a new scraping job.
func (h *ScrapingJobController) Create(c *gin.Context) {
	var req dto.CreateScrapingJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")

	job, err := h.service.Create(req, userID.(string), userRole.(string))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Job created successfully", job)
}

// GetByID retrieves a job by UUID, including logs and results.
func (h *ScrapingJobController) GetByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Job ID is required")
		return
	}

	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")

	job, err := h.service.GetByID(id, userID.(string), userRole.(string))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Job retrieved successfully", job)
}
