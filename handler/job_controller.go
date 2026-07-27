package handler

import (
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

	jobs, err := h.service.GetAll(configID)
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

	job, err := h.service.Create(req)
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

	job, err := h.service.GetByID(id)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Job retrieved successfully", job)
}

// UpdateStatus updates job execution state (used by workers).
func (h *ScrapingJobController) UpdateStatus(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Job ID is required")
		return
	}

	var req dto.UpdateScrapingJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	job, err := h.service.UpdateStatus(id, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, "Job updated successfully", job)
}

// AddLog adds a log entry to a job.
func (h *ScrapingJobController) AddLog(c *gin.Context) {
	jobID := c.Param("id")
	if jobID == "" {
		response.BadRequest(c, "Job ID is required")
		return
	}

	var req dto.CreateScrapingLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	log, err := h.service.AddLog(jobID, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Log added successfully", log)
}

// AddResult persists JSONB output for a job.
func (h *ScrapingJobController) AddResult(c *gin.Context) {
	jobID := c.Param("id")
	if jobID == "" {
		response.BadRequest(c, "Job ID is required")
		return
	}

	var req dto.CreateScrapingResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	result, err := h.service.AddResult(jobID, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Result added successfully", result)
}
