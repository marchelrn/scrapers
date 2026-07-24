package dto

import (
	"encoding/json"
)

// CreateConfigRequest is the payload for creating a new scraping config
type CreateConfigRequest struct {
	WebsiteID  int             `json:"website_id" binding:"required"`
	Name       string          `json:"name" binding:"required"`
	Method     string          `json:"method" binding:"required,oneof=css xpath regex api browser"`
	Selector   string          `json:"selector"`
	Attribute  string          `json:"attribute"`
	Pagination json.RawMessage `json:"pagination"`
	Enabled    *bool           `json:"enabled"`
}

// UpdateConfigRequest is the payload for updating a scraping config
type UpdateConfigRequest struct {
	WebsiteID  int             `json:"website_id" binding:"required"`
	Name       string          `json:"name" binding:"required"`
	Method     string          `json:"method" binding:"required,oneof=css xpath regex api browser"`
	Selector   string          `json:"selector"`
	Attribute  string          `json:"attribute"`
	Pagination json.RawMessage `json:"pagination"`
	Enabled    *bool           `json:"enabled"`
}

type ConfigData struct {
	WebsiteID  int             `json:"website_id"`
	Name       string          `json:"name"`
	Method     string          `json:"method"`
	Selector   string          `json:"selector"`
	Attribute  string          `json:"attribute"`
	Pagination json.RawMessage `json:"pagination"`
	Enabled    *bool           `json:"enabled"`
}

// ResponseCreateConfigRequest is the response when user successfully creating a config
type ResponseCreateConfigRequest struct {
	Code    int                 `json:"code"`
	Message string              `json:"message"`
	Data    CreateConfigRequest `json:"create_data"`
}

// ResponseUpdateConfigRequest is the response when user updating Config
type ResponseUpdateConfigRequest struct {
	Code    int                 `json:"code"`
	Message string              `json:"message"`
	Data    UpdateConfigRequest `json:"updated_data"`
}

// ResponseGetAllConfig is the response when user getting configs
type ResponseGetAllConfig struct {
	Code    int          `json:"code"`
	Message string       `json:"message"`
	Data    []ConfigData `json:"configs"`
}

type ResponseConfig struct {
	Code    int        `json:"code"`
	Message string     `json:"message"`
	Data    ConfigData `json:"config_data"`
}
