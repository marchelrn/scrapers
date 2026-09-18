package contract

import (
	"github.com/marchelrn/scrapers/models"
)

type Repository struct {
	User            UserRepository
	ScrapingConfig  ScrapingConfigRepository
	ConfigParameter ConfigParameterRepository
	Schedule        ScheduleRepository
	ScrapingJob     ScrapingJobRepository
	ScrapingLog     ScrapingLogRepository
	ScrapingResult  ScrapingResultRepository
	Dashboard       DashboardRepository
}

// ── Users ────────────────────────────────────────────────────────────────────

type UserRepository interface {
	Create(user *models.User) error
	GetByEmail(email string) (*models.User, error)
	GetByID(id string) (*models.User, error)
	GetAll(userID string) ([]models.User, error)
	Update(id string, model *models.User) (*models.User, error)
	Delete(id string) error
}

// ── Scraping Configs ─────────────────────────────────────────────────────────

type ScrapingConfigRepository interface {
	Create(config *models.ScrapingConfig) error
	CreateWithParams(config *models.ScrapingConfig, params []models.ConfigParameter) error
	GetAll(userID string, userRole string) ([]models.ScrapingConfig, error)
	GetByID(id string, userID string, userRole string) (*models.ScrapingConfig, error)
	Update(config *models.ScrapingConfig) error
	Delete(id string) error
}

// ── Config Parameters ────────────────────────────────────────────────────────

type ConfigParameterRepository interface {
	Create(param *models.ConfigParameter) error
	GetByConfigID(configID string) ([]models.ConfigParameter, error)
	DeleteByConfigID(configID string) error
}

// ── Schedules ────────────────────────────────────────────────────────────────

type ScheduleRepository interface {
	Create(schedule *models.Schedule) error
	GetAll(configID *string, userID string, userRole string) ([]models.Schedule, error)
	GetByID(id int, userID string, userRole string) (*models.Schedule, error)
	Update(schedule *models.Schedule) error
	Delete(id int) error
}

// ── Scraping Jobs ────────────────────────────────────────────────────────────

type ScrapingJobRepository interface {
	Create(job *models.ScrapingJob) error
	GetAll(configID *string, userID string, userRole string, limit int, offset int) ([]models.ScrapingJob, error)
	GetByID(id string, userID string, userRole string) (*models.ScrapingJob, error)
	Update(job *models.ScrapingJob) error
}

// ── Scraping Logs ────────────────────────────────────────────────────────────

type ScrapingLogRepository interface {
	Create(log *models.ScrapingLog) error
	GetByJobID(jobID string) ([]models.ScrapingLog, error)
}

// ── Scraping Results ─────────────────────────────────────────────────────────

type ScrapingResultRepository interface {
	Create(result *models.ScrapingResult) error
	GetByJobID(jobID string) ([]models.ScrapingResult, error)
}

// ── Dashboard ────────────────────────────────────────────────────────────────

type DashboardRepository interface {
	GetSummary(userID string, userRole string) (*models.DashboardSummary, error)
}
