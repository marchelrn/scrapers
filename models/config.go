package models

import (
	"encoding/json"
	"time"
)

// ScrapeConfig represents a scraping configuration linked to a website
type ScrapeConfig struct {
	ID         int             `json:"id" gorm:"primaryKey;autoIncrement"`
	WebsiteID  int             `json:"website_id" gorm:\"column:website_id\"`
	Name       string          `json:"name" gorm:\"column:name\"`
	Method     string          `json:"method" gorm:\"column:method\"`
	Selector   *string         `json:"selector" gorm:\"column:selector\"`
	Attribute  *string         `json:"attribute" gorm:\"column:attribute\"`
	Pagination json.RawMessage `json:"pagination" gorm:\"column:pagination\"`
	Enabled    bool            `json:"enabled" gorm:\"column:enabled\"`
	CreatedAt  time.Time       `json:"created_at" gorm:\"column:created_at\"`
	UpdatedAt  time.Time       `json:"updated_at" gorm:\"column:updated_at\"`
}

// ValidMethods contains all supported scraping methods
var ValidMethods = []string{"css", "xpath", "regex", "api", "browser"}
