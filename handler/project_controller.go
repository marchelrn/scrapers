package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/pkg/response"
)

// ProjectController handles project HTTP requests
type ProjectController struct {
	service contract.ProjectService
}

// NewProjectController creates a new ProjectController
func (c *ProjectController) InitService(s *contract.Service) {
	c.service = s.Project
}

// GetAll retrieves all projects
// @Summary List all projects
// @Description Get a list of all scraping projects
// @Tags Projects
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.APIResponse{data=[]models.Project}
// @Router /api/v1/projects [get]
func (h *ProjectController) GetAll(c *gin.Context) {
	projects, err := h.service.GetAll()
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "Projects retrieved successfully", projects.Data)
}

// Create creates a new project
// @Summary Create a project
// @Description Create a new scraping project
// @Tags Projects
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body dto.CreateProjectRequest true "Project data"
// @Success 201 {object} response.APIResponse{data=models.Project}
// @Failure 400 {object} response.APIResponse
// @Router /api/v1/projects [post]
func (h *ProjectController) Create(c *gin.Context) {
	var req dto.CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	userID, _ := c.Get("user_id")
	project, err := h.service.Create(req, userID.(int))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Project created successfully", project)
}

// GetByID retrieves a project by ID
// @Summary Get project by ID
// @Description Get detailed information about a specific project
// @Tags Projects
// @Produce json
// @Security BearerAuth
// @Param id path int true "Project ID"
// @Success 200 {object} response.APIResponse{data=models.Project}
// @Failure 404 {object} response.APIResponse
// @Router /api/v1/projects/{id} [get]
func (h *ProjectController) GetByID(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	project, err := h.service.GetByID(id)
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Project retrieved successfully", project)
}

// Update modifies an existing project
// @Summary Update a project
// @Description Update an existing scraping project
// @Tags Projects
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Project ID"
// @Param request body dto.UpdateProjectRequest true "Updated project data"
// @Success 200 {object} response.APIResponse{data=models.Project}
// @Failure 400,404 {object} response.APIResponse
// @Router /api/v1/projects/{id} [put]
func (h *ProjectController) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	var req dto.UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	project, err := h.service.Update(id, req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, "Project updated successfully", project)
}

// Delete removes a project
// @Summary Delete a project
// @Description Delete a scraping project and all its associated data
// @Tags Projects
// @Produce json
// @Security BearerAuth
// @Param id path int true "Project ID"
// @Success 200 {object} response.APIResponse
// @Failure 404 {object} response.APIResponse
// @Router /api/v1/projects/{id} [delete]
func (h *ProjectController) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "Invalid project ID")
		return
	}

	if err := h.service.Delete(id); err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Project deleted successfully", nil)
}
