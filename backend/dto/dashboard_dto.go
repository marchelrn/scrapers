package dto

import "time"

type DashboardSummaryResponse struct {
	ActiveWorkers  int        `json:"active_workers"`
	RunningJobs    int        `json:"running_jobs"`
	FailedJobs     int        `json:"failed_jobs"`
	SuccessfulJobs int        `json:"successful_jobs"`
	Queue          int        `json:"queue"`
	WorkerCPU      float64    `json:"worker_cpu"`
	LastExecution  *time.Time `json:"last_execution"`
	NextExecution  *time.Time `json:"next_execution"`
}
