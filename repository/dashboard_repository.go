package repository

import (
	"time"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/models"
	"gorm.io/gorm"
)

type dashboardRepository struct {
	db *gorm.DB
}

func ImplDashboardRepository(db *gorm.DB) contract.DashboardRepository {
	return &dashboardRepository{db: db}
}

func (r *dashboardRepository) GetSummary() (*models.DashboardSummary, error) {
	var summary models.DashboardSummary

	var activeWorkers int64
	err := r.db.Model(&models.ScrapingJob{}).
		Where("status = ?", models.JobStatusRunning).
		Where("worker_name IS NOT NULL").
		Distinct("worker_name").
		Count(&activeWorkers).Error
	if err != nil {
		return nil, err
	}
	summary.ActiveWorkers = int(activeWorkers)

	var running int64
	r.db.Model(&models.ScrapingJob{}).Where("status = ?", models.JobStatusRunning).Count(&running)
	summary.RunningJobs = int(running)

	var failed int64
	r.db.Model(&models.ScrapingJob{}).Where("status = ?", models.JobStatusFailed).Count(&failed)
	summary.FailedJobs = int(failed)

	var success int64
	r.db.Model(&models.ScrapingJob{}).Where("status = ?", models.JobStatusSuccess).Count(&success)
	summary.SuccessfulJobs = int(success)

	var pending int64
	r.db.Model(&models.ScrapingJob{}).Where("status = ?", models.JobStatusPending).Count(&pending)
	summary.Queue = int(pending)

	// Worker CPU mock (can be replaced with real metrics integration later)
	summary.WorkerCPU = 0.0

	var lastExecs []time.Time
	r.db.Model(&models.ScrapingJob{}).
		Where("finished_at IS NOT NULL").
		Order("finished_at desc").
		Limit(1).
		Pluck("finished_at", &lastExecs)
	if len(lastExecs) > 0 {
		summary.LastExecution = &lastExecs[0]
	}

	var nextExecs []time.Time
	r.db.Model(&models.Schedule{}).
		Where("next_run > ?", time.Now()).
		Order("next_run asc").
		Limit(1).
		Pluck("next_run", &nextExecs)
	if len(nextExecs) > 0 {
		summary.NextExecution = &nextExecs[0]
	}

	return &summary, nil
}
