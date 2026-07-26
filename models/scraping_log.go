package models

import "time"

const (
	ScrapingLogLevelInfo  = "INFO"
	ScrapingLogLevelWarn  = "WARN"
	ScrapingLogLevelError = "ERROR"
)

// ScrapingLog represents a log entry emitted while a job runs.
type ScrapingLog struct {
	ID        int `json:"id" gorm:"column:id;primaryKey;autoIncrement"`
	JobID     string `json:"job_id" gorm:"column:job_id;type:uuid;not null;index"`
	Level     string `json:"level" gorm:"column:level;not null;default:INFO"`
	Message   string `json:"message" gorm:"column:message;not null"`
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`

	Job ScrapingJob `json:"job,omitempty" gorm:"foreignKey:JobID;constraint:OnDelete:CASCADE"`
}

func (ScrapingLog) TableName() string { return "scraping_logs" }
