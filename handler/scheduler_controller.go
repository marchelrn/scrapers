package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/pkg/response"
)

// SchedulerController handles scheduler HTTP requests
type SchedulerController struct {
	service contract.SchedulerService
}

// NewSchedulerController creates a new SchedulerController
func (c *SchedulerController) InitService(s *contract.Service) {
	c.service = s.Scheduler
}

// GetAll retrieves all schedulers
// @Summary List all schedulers
// @Description Get a list of all schedulers, optionally filtered by config_id
// @Tags Schedulers
// @Produce json
// @Security BearerAuth
// @Param config_id query int false "Filter by config ID"
// @Success 200 {object} response.APIResponse{data=[]models.Scheduler}
// @Router /api/v1/schedulers [get]
func (h *SchedulerController) GetAll(c *gin.Context) {
	var configID *int
	if cidStr := c.Query("config_id"); cidStr != "" {
		cid, err := strconv.Atoi(cidStr)
		if err != nil {
			response.BadRequest(c, "Invalid config_id")
			return
		}
		configID = &cid
	}

	schedulers, err := h.service.GetAll(configID)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "Schedulers retrieved successfully", schedulers)
}

// Create creates a new scheduler
// @Summary Create a scheduler
// @Description Create a new cron-based scheduler for a scraping config
// @Tags Schedulers
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body dto.CreateSchedulerRequest true "Scheduler data"
// @Success 201 {object} response.APIResponse{data=models.Scheduler}
// @Failure 400 {object} response.APIResponse
// @Router /api/v1/schedulers [post]
func (h *SchedulerController) Create(c *gin.Context) {
	var req dto.CreateSchedulerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	scheduler, err := h.service.Create(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Scheduler created successfully", scheduler)
}

// GetByID retrieves a scheduler by ID
// @Summary Get scheduler by ID
// @Description Get detailed information about a specific scheduler
// @Tags Schedulers
// @Produce json
// @Security BearerAuth
// @Param id path int true "Scheduler ID"
// @Success 200 {object} response.APIResponse{data=models.Scheduler}
// @Failure 404 {object} response.APIResponse
// @Router /api/v1/schedulers/{id} [get]
func (h *SchedulerController) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid scheduler ID")
		return
	}

	scheduler, err := h.service.GetByID(id)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Scheduler retrieved successfully", scheduler)
}

// Update modifies an existing scheduler
// @Summary Update a scheduler
// @Description Update an existing scheduler's cron expression or settings
// @Tags Schedulers
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Scheduler ID"
// @Param request body dto.UpdateSchedulerRequest true "Updated scheduler data"
// @Success 200 {object} response.APIResponse{data=models.Scheduler}
// @Failure 400,404 {object} response.APIResponse
// @Router /api/v1/schedulers/{id} [put]
func (h *SchedulerController) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid scheduler ID")
		return
	}

	var req dto.UpdateSchedulerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	scheduler, err := h.service.Update(id, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, "Scheduler updated successfully", scheduler)
}

// Delete removes a scheduler
// @Summary Delete a scheduler
// @Description Delete a scheduler
// @Tags Schedulers
// @Produce json
// @Security BearerAuth
// @Param id path int true "Scheduler ID"
// @Success 200 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Router /api/v1/schedulers/{id} [delete]
func (h *SchedulerController) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid scheduler ID")
		return
	}

	if err := h.service.Delete(id); err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Scheduler deleted successfully", nil)
}
