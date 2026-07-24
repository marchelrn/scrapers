package service

import (
	"errors"
	"net/http"

	"github.com/marchelrn/scrapers/repository"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

// ConfigService handles scraping configuration business logic
type ConfigService struct {
	configRepo  contract.ConfigRepository
	websiteRepo contract.WebsiteRepository
}

// ImplConfigService NewConfigService creates a new ConfigService
func ImplConfigService(configRepo contract.ConfigRepository, websiteRepo contract.WebsiteRepository) contract.ConfigService {
	return &ConfigService{
		configRepo:  configRepo,
		websiteRepo: websiteRepo,
	}
}

// Create validates and creates a new scraping config
func (s *ConfigService) Create(req dto.CreateConfigRequest) (*dto.ResponseCreateConfigRequest, error) {
	// Validate website exists
	_, err := s.websiteRepo.GetByID(req.WebsiteID)
	if err != nil {
		return nil, errors.New("website not found")
	}

	// Business rule validation: selector required for certain methods
	if err := s.validateMethodSelector(req.Method, req.Selector); err != nil {
		return nil, err
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	config := &models.ScrapeConfig{
		WebsiteID:  req.WebsiteID,
		Name:       req.Name,
		Method:     req.Method,
		Enabled:    enabled,
		Pagination: req.Pagination,
	}

	if req.Selector != "" {
		config.Selector = &req.Selector
	}
	if req.Attribute != "" {
		config.Attribute = &req.Attribute
	}

	if err := s.configRepo.Create(config); err != nil {
		return nil, errors.New("failed to create config")
	}

	return &dto.ResponseCreateConfigRequest{
		Code:    201,
		Message: "Config created successfully",
		Data: dto.CreateConfigRequest{
			WebsiteID:  config.WebsiteID,
			Name:       config.Name,
			Method:     config.Method,
			Selector:   *config.Selector,
			Attribute:  *config.Attribute,
			Pagination: config.Pagination,
			Enabled:    &config.Enabled,
		},
	}, nil
}

// GetAll retrieves all configs, optionally filtered by website_id
func (s *ConfigService) GetAll(websiteID *int) (*dto.ResponseGetAllConfig, error) {
	configs, err := s.configRepo.GetAll(websiteID)
	if err != nil {
		return nil, errors.New("failed to get all configs")
	}

	response := &dto.ResponseGetAllConfig{
		Code:    http.StatusOK,
		Message: "All configs retrieved successfully",
		Data:    []dto.ConfigData{},
	}
	for _, config := range configs {
		response.Data = append(response.Data, dto.ConfigData{
			WebsiteID:  config.WebsiteID,
			Name:       config.Name,
			Method:     config.Method,
			Selector:   *config.Selector,
			Attribute:  *config.Attribute,
			Pagination: config.Pagination,
			Enabled:    &config.Enabled,
		})
	}
	return response, nil
}

// GetByID retrieves a config by ID
func (s *ConfigService) GetByID(id int) (*dto.ResponseConfig, error) {
	config, err := s.configRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("config not found")
	}
	return &dto.ResponseConfig{
		Code:    http.StatusOK,
		Message: "Config retrieved successfully",
		Data: dto.ConfigData{
			WebsiteID:  config.WebsiteID,
			Name:       config.Name,
			Method:     config.Method,
			Selector:   *config.Selector,
			Attribute:  *config.Attribute,
			Pagination: config.Pagination,
			Enabled:    &config.Enabled,
		},
	}, nil
}

// Update validates and updates a scraping config
func (s *ConfigService) Update(id int, req dto.UpdateConfigRequest) (*dto.ResponseUpdateConfigRequest, error) {
	// Validate website exists
	_, err := s.websiteRepo.GetByID(req.WebsiteID)
	if err != nil {
		return nil, errors.New("website not found")
	}

	// Business rule validation
	if err := s.validateMethodSelector(req.Method, req.Selector); err != nil {
		return nil, err
	}

	config, err := s.configRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("config not found")
	}

	config.WebsiteID = req.WebsiteID
	config.Name = req.Name
	config.Method = req.Method
	config.Pagination = req.Pagination

	if req.Selector != "" {
		config.Selector = &req.Selector
	} else {
		config.Selector = nil
	}

	if req.Attribute != "" {
		config.Attribute = &req.Attribute
	} else {
		config.Attribute = nil
	}

	if req.Enabled != nil {
		config.Enabled = *req.Enabled
	}

	if err := s.configRepo.Update(config); err != nil {
		return nil, errors.New("failed to update config")
	}

	return &dto.ResponseUpdateConfigRequest{
		Code:    http.StatusOK,
		Message: "Config updated successfully",
		Data: dto.UpdateConfigRequest{
			WebsiteID:  config.WebsiteID,
			Name:       config.Name,
			Method:     config.Method,
			Selector:   *config.Selector,
			Attribute:  *config.Attribute,
			Pagination: config.Pagination,
			Enabled:    &config.Enabled,
		},
	}, nil
}

// Delete removes a config by ID
func (s *ConfigService) Delete(id int) error {
	if err := s.configRepo.Delete(id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return errors.New("config not found")
		}
		return errors.New("failed to delete config")
	}
	return nil
}

// validateMethodSelector enforces business rules:
// - method=CSS     → selector is required (CSS selector)
// - method=xpath   → selector is required (XPath expression)
// - method=regex   → selector is required (regex pattern)
// - method=api     → selector is required (API endpoint)
// - method=browser → selector is optional
func (s *ConfigService) validateMethodSelector(method, selector string) error {
	switch method {
	case "css":
		if selector == "" {
			return errors.New("selector is required for CSS method")
		}
	case "xpath":
		if selector == "" {
			return errors.New("selector (XPath expression) is required for XPath method")
		}
	case "regex":
		if selector == "" {
			return errors.New("selector (regex pattern) is required for Regex method")
		}
	case "api":
		if selector == "" {
			return errors.New("selector (API endpoint) is required for API method")
		}
	case "browser":
		// Selector is optional for browser method
	default:
		return errors.New("invalid scraping method: " + method)
	}
	return nil
}
