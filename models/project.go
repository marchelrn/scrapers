package models

import "time"

// Project represents a scraping project (e.g., "Migrasi Berita")
type Project struct {
	ID          int       `json:"id" gorm:"primaryKey;autoIncrement"`
	Name        string    `json:"name" gorm:\"column:name\"`
	Description *string   `json:"description" gorm:\"column:description\"`
	CreatedBy   *int      `json:"created_by" gorm:\"column:created_by\"`
	CreatedAt   time.Time `json:"created_at" gorm:\"column:created_at\"`
	UpdatedAt   time.Time `json:"updated_at" gorm:\"column:updated_at\"`
}
