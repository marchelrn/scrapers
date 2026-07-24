package models

import "time"

// Website represents a target website for scraping
type Website struct {
	ID            int       `json:"id" gorm:"primaryKey;autoIncrement"`
	ProjectID     int       `json:"project_id" gorm:\"column:project_id\"`
	Name          string    `json:"name" gorm:\"column:name\"`
	BaseURL       string    `json:"base_url" gorm:\"column:base_url\"`
	LoginRequired bool      `json:"login_required" gorm:\"column:login_required\"`
	CreatedAt     time.Time `json:"created_at" gorm:\"column:created_at\"`
	UpdatedAt     time.Time `json:"updated_at" gorm:\"column:updated_at\"`
}
