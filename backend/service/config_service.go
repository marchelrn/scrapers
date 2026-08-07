package service

import (
	"encoding/json"
	"errors"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
	"github.com/marchelrn/scrapers/pkg/registry"
)

// ScrapingConfigService handles scraping configuration business logic.
type ScrapingConfigService struct {
	configRepo      contract.ScrapingConfigRepository
	configParamRepo contract.ConfigParameterRepository
}

func ImplScrapingConfigService(
	configRepo contract.ScrapingConfigRepository,
	configParamRepo contract.ConfigParameterRepository,
) contract.ScrapingConfigService {
	return &ScrapingConfigService{
		configRepo:      configRepo,
		configParamRepo: configParamRepo,
	}
}

// Create validates and creates a new scraping config with its parameters.
func (s *ScrapingConfigService) Create(req dto.CreateScrapingConfigRequest, userID string) (*dto.ScrapingConfigResponse, error) {
	// Validate method exists
	method, err := registry.Get().GetMethod(req.MethodCode)
	if err != nil {
		return nil, errors.New("method code not registered")
	}

	// Unmarshal and validate parameters
	paramMap := make(map[string]interface{})
	for _, p := range req.Parameters {
		var val interface{}
		if err := json.Unmarshal(p.ParameterValue, &val); err != nil {
			return nil, errors.New("invalid json in parameter " + p.ParameterName)
		}
		paramMap[p.ParameterName] = val
	}

	if err := method.Validate(paramMap); err != nil {
		return nil, errors.New("invalid parameters: " + err.Error())
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
		MethodCode:      req.MethodCode,
		CreatedBy:       &userID,
		Status:          status,
		ScheduleEnabled: scheduleEnabled,
	}

	// Build parameter list
	var configParams []models.ConfigParameter
	for _, p := range req.Parameters {
		configParams = append(configParams, models.ConfigParameter{
			ParameterName:  p.ParameterName,
			ParameterValue: p.ParameterValue,
		})
	}

	// Atomic create config + params in one transaction
	if err := s.configRepo.CreateWithParams(config, configParams); err != nil {
		return nil, errors.New("failed to create config")
	}

	// Reload with relations
	created, err := s.configRepo.GetByID(config.ID, userID, models.UserRoleOperator) // Pass operator so it enforces check on creator
	if err != nil {
		return nil, errors.New("failed to reload config")
	}

	resp := dto.ToScrapingConfigResponse(*created)
	return &resp, nil
}

// GetAll retrieves all scraping configs.
func (s *ScrapingConfigService) GetAll(userID string, userRole string) ([]dto.ScrapingConfigResponse, error) {
	configs, err := s.configRepo.GetAll(userID, userRole)
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
func (s *ScrapingConfigService) GetByID(id string, userID string, userRole string) (*dto.ScrapingConfigResponse, error) {
	config, err := s.configRepo.GetByID(id, userID, userRole)
	if err != nil {
		return nil, errors.New("config not found")
	}
	resp := dto.ToScrapingConfigResponse(*config)
	return &resp, nil
}

// Update validates and updates a scraping config.
func (s *ScrapingConfigService) Update(id string, req dto.UpdateScrapingConfigRequest, userID string, userRole string) (*dto.ScrapingConfigResponse, error) {
	config, err := s.configRepo.GetByID(id, userID, userRole)
	if err != nil {
		return nil, errors.New("config not found")
	}

	if req.Name != nil {
		config.Name = *req.Name
	}
	if req.Description != nil {
		config.Description = req.Description
	}
	if req.MethodCode != nil {
		// Validate method exists
		_, err := registry.Get().GetMethod(*req.MethodCode)
		if err != nil {
			return nil, errors.New("method code not registered")
		}
		config.MethodCode = *req.MethodCode
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
		// Validate against registry
		method, err := registry.Get().GetMethod(config.MethodCode)
		if err != nil {
			return nil, errors.New("invalid method code on config")
		}

		paramMap := make(map[string]interface{})
		for _, p := range *req.Parameters {
			var val interface{}
			if err := json.Unmarshal(p.ParameterValue, &val); err != nil {
				return nil, errors.New("invalid json in parameter " + p.ParameterName)
			}
			paramMap[p.ParameterName] = val
		}

		if err := method.Validate(paramMap); err != nil {
			return nil, errors.New("invalid parameters: " + err.Error())
		}

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
	updated, err := s.configRepo.GetByID(id, userID, userRole)
	if err != nil {
		return nil, errors.New("failed to reload config")
	}

	resp := dto.ToScrapingConfigResponse(*updated)
	return &resp, nil
}

// Delete removes a config by UUID.
func (s *ScrapingConfigService) Delete(id string, userID string, userRole string) error {
	_, err := s.configRepo.GetByID(id, userID, userRole)
	if err != nil {
		return errors.New("config not found")
	}
	if err := s.configRepo.Delete(id); err != nil {
		return errors.New("failed to delete config")
	}
	return nil
}
