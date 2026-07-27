package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/pkg/response"
)

// ScheduleController handles schedule HTTP requests.
type ScheduleController struct {
	service contract.ScheduleService
}

func (ctrl *ScheduleController) InitService(s *contract.Service) {
	ctrl.service = s.Schedule
}

// GetAll retrieves all schedules, optionally filtered by config_id.
func (h *ScheduleController) GetAll(c *gin.Context) {
	var configID *string
	if cidStr := c.Query("config_id"); cidStr != "" {
		configID = &cidStr
	}

	schedules, err := h.service.GetAll(configID)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "Schedules retrieved successfully", schedules)
}

// Create creates a new schedule.
func (h *ScheduleController) Create(c *gin.Context) {
	var req dto.CreateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	schedule, err := h.service.Create(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Schedule created successfully", schedule)
}

// GetByID retrieves a schedule by ID.
func (h *ScheduleController) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid schedule ID")
		return
	}

	schedule, err := h.service.GetByID(id)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Schedule retrieved successfully", schedule)
}

// Update modifies an existing schedule.
func (h *ScheduleController) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid schedule ID")
		return
	}

	var req dto.UpdateScheduleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	schedule, err := h.service.Update(id, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, "Schedule updated successfully", schedule)
}

// Delete removes a schedule.
func (h *ScheduleController) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid schedule ID")
		return
	}

	if err := h.service.Delete(id); err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Schedule deleted successfully", nil)
}
