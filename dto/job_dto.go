package dto

import (
	"encoding/json"
	"time"
)

// CreateScrapingJobRequest queues a new execution for a configuration.
type CreateScrapingJobRequest struct {
	ConfigID string `json:"config_id" binding:"required,uuid4"`
}

// UpdateScrapingJobRequest is used by workers to report execution state.
type UpdateScrapingJobRequest struct {
	Status     *string    `json:"status" binding:"omitempty,oneof=pending running success failed"`
	StartedAt  *time.Time `json:"started_at"`
	FinishedAt *time.Time `json:"finished_at"`
	WorkerName *string    `json:"worker_name" binding:"omitempty,max=255"`
}

// CreateScrapingLogRequest adds one log entry to a job.
type CreateScrapingLogRequest struct {
	Level   string `json:"level" binding:"omitempty,oneof=INFO WARN ERROR"`
	Message string `json:"message" binding:"required"`
}

// CreateScrapingResultRequest persists JSONB output for a job.
type CreateScrapingResultRequest struct {
	ResultJSON json.RawMessage `json:"result_json" binding:"required"`
}

type ScrapingLogResponse struct {
	ID        int       `json:"id"`
	JobID     string    `json:"job_id"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	CreatedAt time.Time `json:"created_at"`
}

type ScrapingResultResponse struct {
	ID         int             `json:"id"`
	JobID      string          `json:"job_id"`
	ResultJSON json.RawMessage `json:"result_json"`
	CreatedAt  time.Time       `json:"created_at"`
}

// ScrapingJobResponse is returned for a job and optionally includes logs and results.
type ScrapingJobResponse struct {
	ID         string                  `json:"id"`
	ConfigID   string                  `json:"config_id"`
	Status     string                  `json:"status"`
	StartedAt  *time.Time              `json:"started_at,omitempty"`
	FinishedAt *time.Time              `json:"finished_at,omitempty"`
	WorkerName *string                 `json:"worker_name,omitempty"`
	Logs       []ScrapingLogResponse   `json:"logs,omitempty"`
	Results    []ScrapingResultResponse `json:"results,omitempty"`
}
