package service

import (
	"errors"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

// ScraperTypeService handles scraper type business logic.
type ScraperTypeService struct {
	scraperTypeRepo contract.ScraperTypeRepository
}

func ImplScraperTypeService(scraperTypeRepo contract.ScraperTypeRepository) contract.ScraperTypeService {
	return &ScraperTypeService{scraperTypeRepo: scraperTypeRepo}
}

// Create creates a new scraper type.
func (s *ScraperTypeService) Create(req dto.CreateScraperTypeRequest) (*dto.ScraperTypeResponse, error) {
	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	scraperType := &models.ScraperType{
		Name:        req.Name,
		PythonFile:  req.PythonFile,
		Description: req.Description,
		IsActive:    isActive,
	}

	if err := s.scraperTypeRepo.Create(scraperType); err != nil {
		return nil, errors.New("failed to create scraper type")
	}

	resp := dto.ToScraperTypeResponse(*scraperType)
	return &resp, nil
}

// GetAll retrieves all scraper types.
func (s *ScraperTypeService) GetAll() ([]dto.ScraperTypeResponse, error) {
	scraperTypes, err := s.scraperTypeRepo.GetAll()
	if err != nil {
		return nil, errors.New("failed to get scraper types")
	}

	responses := make([]dto.ScraperTypeResponse, 0, len(scraperTypes))
	for _, st := range scraperTypes {
		responses = append(responses, dto.ToScraperTypeResponse(st))
	}
	return responses, nil
}

// GetByID retrieves a scraper type by ID.
func (s *ScraperTypeService) GetByID(id int) (*dto.ScraperTypeResponse, error) {
	scraperType, err := s.scraperTypeRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("scraper type not found")
	}
	resp := dto.ToScraperTypeResponse(*scraperType)
	return &resp, nil
}

// Update updates a scraper type.
func (s *ScraperTypeService) Update(id int, req dto.UpdateScraperTypeRequest) (*dto.ScraperTypeResponse, error) {
	scraperType, err := s.scraperTypeRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("scraper type not found")
	}

	if req.Name != nil {
		scraperType.Name = *req.Name
	}
	if req.PythonFile != nil {
		scraperType.PythonFile = *req.PythonFile
	}
	if req.Description != nil {
		scraperType.Description = req.Description
	}
	if req.IsActive != nil {
		scraperType.IsActive = *req.IsActive
	}

	if err := s.scraperTypeRepo.Update(scraperType); err != nil {
		return nil, errors.New("failed to update scraper type")
	}

	resp := dto.ToScraperTypeResponse(*scraperType)
	return &resp, nil
}

// Delete removes a scraper type by ID.
func (s *ScraperTypeService) Delete(id int) error {
	_, err := s.scraperTypeRepo.GetByID(id)
	if err != nil {
		return errors.New("scraper type not found")
	}
	if err := s.scraperTypeRepo.Delete(id); err != nil {
		return errors.New("failed to delete scraper type")
	}
	return nil
}
