package models

import "time"

// Job represents a scraping job execution record
type Job struct {
	ID         int        `json:"id" gorm:"primaryKey;autoIncrement"`
	ConfigID   int        `json:"config_id" gorm:\"column:config_id\"`
	Status     string     `json:"status" gorm:\"column:status\"`
	StartedAt  *time.Time `json:"started_at" gorm:\"column:started_at\"`
	FinishedAt *time.Time `json:"finished_at" gorm:\"column:finished_at\"`
	Message    *string    `json:"message" gorm:\"column:message\"`
	CreatedAt  time.Time  `json:"created_at" gorm:\"column:created_at\"`
}

// Job status constants
const (
	JobStatusPending = "pending"
	JobStatusRunning = "running"
	JobStatusSuccess = "success"
	JobStatusFailed  = "failed"
	JobStatusRetry   = "retry"
)
