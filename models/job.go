package models

import "time"

const (
	JobStatusPending = "pending"
	JobStatusRunning = "running"
	JobStatusSuccess = "success"
	JobStatusFailed  = "failed"
)

// ScrapingJob represents one execution of a scraping configuration.
type ScrapingJob struct {
	ID         string `json:"id" gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey"`
	ConfigID   string `json:"config_id" gorm:"column:config_id;type:uuid;not null;index"`
	Status     string `json:"status" gorm:"column:status;not null;default:pending"`
	StartedAt  *time.Time `json:"started_at,omitempty" gorm:"column:started_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty" gorm:"column:finished_at"`
	WorkerName *string `json:"worker_name,omitempty" gorm:"column:worker_name"`

	Config  ScrapingConfig   `json:"config,omitempty" gorm:"foreignKey:ConfigID;constraint:OnDelete:CASCADE"`
	Logs    []ScrapingLog    `json:"logs,omitempty" gorm:"foreignKey:JobID"`
	Results []ScrapingResult `json:"results,omitempty" gorm:"foreignKey:JobID"`
}

func (ScrapingJob) TableName() string { return "scraping_jobs" }
