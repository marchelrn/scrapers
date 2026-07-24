package service

import (
	"errors"
	"net/url"

	"github.com/marchelrn/scrapers/repository"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

// WebsiteService handles website business logic
type WebsiteService struct {
	websiteRepo contract.WebsiteRepository
	projectRepo contract.ProjectRepository
}

// NewWebsiteService creates a new WebsiteService
func ImplWebsiteService(websiteRepo contract.WebsiteRepository, projectRepo contract.ProjectRepository) contract.WebsiteService {
	return &WebsiteService{
		websiteRepo: websiteRepo,
		projectRepo: projectRepo,
	}
}

// Create validates and creates a new website target
func (s *WebsiteService) Create(req dto.CreateWebsiteRequest) (*models.Website, error) {
	// Validate project exists
	_, err := s.projectRepo.GetByID(req.ProjectID)
	if err != nil {
		return nil, errors.New("project not found")
	}

	// Validate URL format
	if _, err := url.ParseRequestURI(req.BaseURL); err != nil {
		return nil, errors.New("invalid base URL format")
	}

	website := &models.Website{
		ProjectID:     req.ProjectID,
		Name:          req.Name,
		BaseURL:       req.BaseURL,
		LoginRequired: req.LoginRequired,
	}

	if err := s.websiteRepo.Create(website); err != nil {
		return nil, errors.New("failed to create website")
	}

	return website, nil
}

// GetAll retrieves all websites, optionally filtered by project_id
func (s *WebsiteService) GetAll(projectID *int) ([]models.Website, error) {
	return s.websiteRepo.GetAll(projectID)
}

// GetByID retrieves a website by ID
func (s *WebsiteService) GetByID(id int) (*models.Website, error) {
	website, err := s.websiteRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("website not found")
	}
	return website, nil
}

// Update validates and updates a website
func (s *WebsiteService) Update(id int, req dto.UpdateWebsiteRequest) (*models.Website, error) {
	// Validate project exists
	_, err := s.projectRepo.GetByID(req.ProjectID)
	if err != nil {
		return nil, errors.New("project not found")
	}

	// Validate URL format
	if _, err := url.ParseRequestURI(req.BaseURL); err != nil {
		return nil, errors.New("invalid base URL format")
	}

	website, err := s.websiteRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("website not found")
	}

	website.ProjectID = req.ProjectID
	website.Name = req.Name
	website.BaseURL = req.BaseURL
	website.LoginRequired = req.LoginRequired

	if err := s.websiteRepo.Update(website); err != nil {
		return nil, errors.New("failed to update website")
	}

	return website, nil
}

// Delete removes a website by ID
func (s *WebsiteService) Delete(id int) error {
	if err := s.websiteRepo.Delete(id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return errors.New("website not found")
		}
		return errors.New("failed to delete website")
	}
	return nil
}
