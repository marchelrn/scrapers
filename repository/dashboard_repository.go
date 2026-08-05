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

func (r *dashboardRepository) GetSummary(userID string, userRole string) (*models.DashboardSummary, error) {
	var summary models.DashboardSummary

	baseJobQuery := r.db.Model(&models.ScrapingJob{})
	if userRole != models.UserRoleAdmin {
		baseJobQuery = baseJobQuery.Joins("JOIN scraping_configs ON scraping_jobs.config_id = scraping_configs.id").
			Where("scraping_configs.created_by = ?", userID)
	}

	var activeWorkers int64
	err := baseJobQuery.Session(&gorm.Session{}).
		Where("scraping_jobs.status = ?", models.JobStatusRunning).
		Where("scraping_jobs.worker_name IS NOT NULL").
		Distinct("scraping_jobs.worker_name").
		Count(&activeWorkers).Error
	if err != nil {
		return nil, err
	}
	summary.ActiveWorkers = int(activeWorkers)

	var running int64
	baseJobQuery.Session(&gorm.Session{}).Where("scraping_jobs.status = ?", models.JobStatusRunning).Count(&running)
	summary.RunningJobs = int(running)

	var failed int64
	baseJobQuery.Session(&gorm.Session{}).Where("scraping_jobs.status = ?", models.JobStatusFailed).Count(&failed)
	summary.FailedJobs = int(failed)

	var success int64
	baseJobQuery.Session(&gorm.Session{}).Where("scraping_jobs.status = ?", models.JobStatusSuccess).Count(&success)
	summary.SuccessfulJobs = int(success)

	var pending int64
	baseJobQuery.Session(&gorm.Session{}).Where("scraping_jobs.status = ?", models.JobStatusPending).Count(&pending)
	summary.Queue = int(pending)

	// Worker CPU mock (can be replaced with real metrics integration later)
	summary.WorkerCPU = 0.0

	var lastExecs []time.Time
	baseJobQuery.Session(&gorm.Session{}).
		Where("scraping_jobs.finished_at IS NOT NULL").
		Order("scraping_jobs.finished_at desc").
		Limit(1).
		Pluck("scraping_jobs.finished_at", &lastExecs)
	if len(lastExecs) > 0 {
		summary.LastExecution = &lastExecs[0]
	}

	baseScheduleQuery := r.db.Model(&models.Schedule{})
	if userRole != models.UserRoleAdmin {
		baseScheduleQuery = baseScheduleQuery.Joins("JOIN scraping_configs ON schedules.config_id = scraping_configs.id").
			Where("scraping_configs.created_by = ?", userID)
	}

	var nextExecs []time.Time
	baseScheduleQuery.Session(&gorm.Session{}).
		Where("schedules.next_run > ?", time.Now()).
		Order("schedules.next_run asc").
		Limit(1).
		Pluck("schedules.next_run", &nextExecs)
	if len(nextExecs) > 0 {
		summary.NextExecution = &nextExecs[0]
	}

	return &summary, nil
}
