package dto

import "time"

// CreateScheduleRequest creates a cron schedule for a scraping configuration.
type CreateScheduleRequest struct {
	ConfigID       string `json:"config_id" binding:"required,uuid4"`
	CronExpression string `json:"cron_expression" binding:"required,max=100"`
	Timezone       string `json:"timezone" binding:"omitempty,max=100"`
	Enabled        *bool  `json:"enabled"`
	// RunOnce true: jalankan sekali pada waktu cocok berikutnya lalu berhenti.
	// Default false: jalankan terus mengikuti ekspresi cron.
	RunOnce *bool `json:"run_once"`
}

// UpdateScheduleRequest updates mutable schedule fields. Nil values are not changed.
type UpdateScheduleRequest struct {
	CronExpression *string `json:"cron_expression" binding:"omitempty,max=100"`
	Timezone       *string `json:"timezone" binding:"omitempty,max=100"`
	Enabled        *bool   `json:"enabled"`
	RunOnce        *bool   `json:"run_once"`
}

// ScheduleResponse is the public representation of a schedule.
type ScheduleResponse struct {
	ID             int        `json:"id"`
	ConfigID       string     `json:"config_id"`
	CronExpression string     `json:"cron_expression"`
	Timezone       string     `json:"timezone"`
	Enabled        bool       `json:"enabled"`
	RunOnce        bool       `json:"run_once"`
	NextRun        *time.Time `json:"next_run,omitempty"`
	LastRun        *time.Time `json:"last_run,omitempty"`
}
