package models

import (
	"encoding/json"
	"time"
)

// ScrapingResult represents JSON output produced by a scraping job.
type ScrapingResult struct {
	ID         int             `json:"id" gorm:"column:id;primaryKey;autoIncrement"`
	JobID      string          `json:"job_id" gorm:"column:job_id;type:uuid;not null;index"`
	ResultJSON json.RawMessage `json:"result_json,omitempty" gorm:"column:result_json;type:jsonb"`
	CreatedAt  time.Time       `json:"created_at" gorm:"column:created_at;autoCreateTime"`

	Job ScrapingJob `json:"job,omitempty" gorm:"foreignKey:JobID;constraint:OnDelete:CASCADE"`
}

func (ScrapingResult) TableName() string { return "scraping_results" }
