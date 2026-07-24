package service

import (
	"errors"
	"net/http"

	"github.com/marchelrn/scrapers/repository"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

// ProjectService handles project business logic
type ProjectService struct {
	projectRepo contract.ProjectRepository
}

// NewProjectService creates a new ProjectService
func ImplProjectService(projectRepo contract.ProjectRepository) contract.ProjectService {
	return &ProjectService{projectRepo: projectRepo}
}

// Create validates and creates a new project
func (s *ProjectService) Create(req dto.CreateProjectRequest, userID int) (*dto.ResponseCreateProjectRequest, error) {
	// Business validation
	if req.Name == "" {
		return nil, errors.New("project name is required")
	}

	project := &models.Project{
		Name:      req.Name,
		CreatedBy: &userID,
	}

	if req.Description != "" {
		project.Description = &req.Description
	}

	if err := s.projectRepo.Create(project); err != nil {
		return nil, errors.New("failed to create project")
	}

	return &dto.ResponseCreateProjectRequest{
		Code:    http.StatusOK,
		Message: "Project created successfully",
		Data: dto.CreateProjectRequest{
			Name:        project.Name,
			Description: *project.Description,
		},
	}, nil
}

// GetAll retrieves all projects
func (s *ProjectService) GetAll() (*dto.ResponseGetAllProject, error) {
	projects, err := s.projectRepo.GetAll()
	if err != nil {
		return nil, errors.New("failed to get all projects")
	}
	response := &dto.ResponseGetAllProject{
		Data: []dto.ProjectData{},
	}

	for _, project := range projects {
		response.Data = append(response.Data, dto.ProjectData{
			Name:        project.Name,
			Description: *project.Description,
		})
	}
	return response, nil
}

// GetByID retrieves a project by ID
func (s *ProjectService) GetByID(id int) (*dto.ResponseProject, error) {
	project, err := s.projectRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("project not found")
	}
	return &dto.ResponseProject{
		Data: dto.ProjectData{
			Name:        project.Name,
			Description: *project.Description,
		},
	}, nil
}

// Update validates and updates a project
func (s *ProjectService) Update(id int, req dto.UpdateProjectRequest) (*dto.ResponseUpdateProjectRequest, error) {
	if req.Name == "" {
		return nil, errors.New("project name is required")
	}

	project, err := s.projectRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("project not found")
	}

	project.Name = req.Name
	if req.Description != "" {
		project.Description = &req.Description
	}

	if err := s.projectRepo.Update(project); err != nil {
		return nil, errors.New("failed to update project")
	}

	return &dto.ResponseUpdateProjectRequest{
		Code:    http.StatusOK,
		Message: "Project updated successfully",
		Data: dto.UpdateProjectRequest{
			Name:        project.Name,
			Description: *project.Description,
		},
	}, nil
}

// Delete removes a project by ID
func (s *ProjectService) Delete(id int) error {
	if err := s.projectRepo.Delete(id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return errors.New("project not found")
		}
		return errors.New("failed to delete project")
	}
	return nil
}
