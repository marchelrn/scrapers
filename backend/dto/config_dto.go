package dto

import (
	"encoding/json"
	"time"
)

// CreateScrapingConfigRequest creates a configuration for a registered scraper type.
type CreateScrapingConfigRequest struct {
	Name            string                   `json:"name" binding:"required,max=255"`
	Description     *string                  `json:"description"`
	MethodCode      string                   `json:"method_code" binding:"required"`
	Status          string                   `json:"status" binding:"omitempty,oneof=active inactive"`
	ScheduleEnabled *bool                    `json:"schedule_enabled"`
	Parameters      []ConfigParameterRequest `json:"parameters"`
}

// UpdateScrapingConfigRequest updates mutable configuration fields. Nil values are not changed.
type UpdateScrapingConfigRequest struct {
	Name            *string                   `json:"name" binding:"omitempty,max=255"`
	Description     *string                   `json:"description"`
	MethodCode      *string                   `json:"method_code"`
	Status          *string                   `json:"status" binding:"omitempty,oneof=active inactive"`
	ScheduleEnabled *bool                     `json:"schedule_enabled"`
	Parameters      *[]ConfigParameterRequest `json:"parameters"`
}

// ConfigParameterRequest supplies one JSONB parameter value.
type ConfigParameterRequest struct {
	ParameterName  string          `json:"parameter_name" binding:"required,max=255"`
	ParameterValue json.RawMessage `json:"parameter_value" binding:"required"`
}

// RunConfigShortcutRequest is used to update parameters and instantly trigger a job.
type RunConfigShortcutRequest struct {
	Parameters []ConfigParameterRequest `json:"parameters" binding:"omitempty"`
}

// ConfigParameterResponse is the public representation of a configuration parameter.
type ConfigParameterResponse struct {
	ID             int             `json:"id"`
	ParameterName  string          `json:"parameter_name"`
	ParameterValue json.RawMessage `json:"parameter_value"`
}

// ScrapingConfigResponse is returned for create, detail, and list endpoints.
type ScrapingConfigResponse struct {
	ID              string                    `json:"id"`
	Name            string                    `json:"name"`
	Description     *string                   `json:"description,omitempty"`
	MethodCode      string                    `json:"method_code"`
	CreatedBy       *string                   `json:"created_by,omitempty"`
	Status          string                    `json:"status"`
	ScheduleEnabled bool                      `json:"schedule_enabled"`
	CreatedAt       time.Time                 `json:"created_at"`
	Parameters      []ConfigParameterResponse `json:"parameters,omitempty"`
}
