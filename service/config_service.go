package service

import (
	"errors"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

// ScrapingConfigService handles scraping configuration business logic.
type ScrapingConfigService struct {
	configRepo      contract.ScrapingConfigRepository
	configParamRepo contract.ConfigParameterRepository
	scraperTypeRepo contract.ScraperTypeRepository
}

func ImplScrapingConfigService(
	configRepo contract.ScrapingConfigRepository,
	configParamRepo contract.ConfigParameterRepository,
	scraperTypeRepo contract.ScraperTypeRepository,
) contract.ScrapingConfigService {
	return &ScrapingConfigService{
		configRepo:      configRepo,
		configParamRepo: configParamRepo,
		scraperTypeRepo: scraperTypeRepo,
	}
}

// Create validates and creates a new scraping config with its parameters.
func (s *ScrapingConfigService) Create(req dto.CreateScrapingConfigRequest, userID int) (*dto.ScrapingConfigResponse, error) {
	// Validate scraper type exists
	_, err := s.scraperTypeRepo.GetByID(req.ScraperTypeID)
	if err != nil {
		return nil, errors.New("scraper type not found")
	}

	status := models.ScrapingConfigStatusActive
	if req.Status != "" {
		status = req.Status
	}

	scheduleEnabled := false
	if req.ScheduleEnabled != nil {
		scheduleEnabled = *req.ScheduleEnabled
	}

	config := &models.ScrapingConfig{
		Name:            req.Name,
		Description:     req.Description,
		ScraperTypeID:   req.ScraperTypeID,
		CreatedBy:       &userID,
		Status:          status,
		ScheduleEnabled: scheduleEnabled,
	}

	if err := s.configRepo.Create(config); err != nil {
		return nil, errors.New("failed to create config")
	}

	// Save parameters
	if len(req.Parameters) > 0 {
		for _, p := range req.Parameters {
			param := &models.ConfigParameter{
				ConfigID:       config.ID,
				ParameterName:  p.ParameterName,
				ParameterValue: p.ParameterValue,
			}
			if err := s.configParamRepo.Create(param); err != nil {
				return nil, errors.New("failed to create config parameter")
			}
		}
	}

	// Reload with relations
	created, err := s.configRepo.GetByID(config.ID)
	if err != nil {
		return nil, errors.New("failed to reload config")
	}

	resp := dto.ToScrapingConfigResponse(*created)
	return &resp, nil
}

// GetAll retrieves all scraping configs.
func (s *ScrapingConfigService) GetAll() ([]dto.ScrapingConfigResponse, error) {
	configs, err := s.configRepo.GetAll()
	if err != nil {
		return nil, errors.New("failed to get configs")
	}

	responses := make([]dto.ScrapingConfigResponse, 0, len(configs))
	for _, c := range configs {
		responses = append(responses, dto.ToScrapingConfigResponse(c))
	}
	return responses, nil
}

// GetByID retrieves a config by UUID.
func (s *ScrapingConfigService) GetByID(id string) (*dto.ScrapingConfigResponse, error) {
	config, err := s.configRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("config not found")
	}
	resp := dto.ToScrapingConfigResponse(*config)
	return &resp, nil
}

// Update validates and updates a scraping config.
func (s *ScrapingConfigService) Update(id string, req dto.UpdateScrapingConfigRequest) (*dto.ScrapingConfigResponse, error) {
	config, err := s.configRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("config not found")
	}

	if req.Name != nil {
		config.Name = *req.Name
	}
	if req.Description != nil {
		config.Description = req.Description
	}
	if req.ScraperTypeID != nil {
		// Validate scraper type exists
		if _, err := s.scraperTypeRepo.GetByID(*req.ScraperTypeID); err != nil {
			return nil, errors.New("scraper type not found")
		}
		config.ScraperTypeID = *req.ScraperTypeID
	}
	if req.Status != nil {
		config.Status = *req.Status
	}
	if req.ScheduleEnabled != nil {
		config.ScheduleEnabled = *req.ScheduleEnabled
	}

	if err := s.configRepo.Update(config); err != nil {
		return nil, errors.New("failed to update config")
	}

	// Replace parameters if provided
	if req.Parameters != nil {
		if err := s.configParamRepo.DeleteByConfigID(id); err != nil {
			return nil, errors.New("failed to clear old parameters")
		}
		for _, p := range *req.Parameters {
			param := &models.ConfigParameter{
				ConfigID:       id,
				ParameterName:  p.ParameterName,
				ParameterValue: p.ParameterValue,
			}
			if err := s.configParamRepo.Create(param); err != nil {
				return nil, errors.New("failed to create config parameter")
			}
		}
	}

	// Reload
	updated, err := s.configRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("failed to reload config")
	}

	resp := dto.ToScrapingConfigResponse(*updated)
	return &resp, nil
}

// Delete removes a config by UUID.
func (s *ScrapingConfigService) Delete(id string) error {
	_, err := s.configRepo.GetByID(id)
	if err != nil {
		return errors.New("config not found")
	}
	if err := s.configRepo.Delete(id); err != nil {
		return errors.New("failed to delete config")
	}
	return nil
}
