package contract

import (
	"github.com/marchelrn/scrapers/models"
)

type Repository struct {
	User                UserRepository
	ScraperType         ScraperTypeRepository
	ParameterDefinition ParameterDefinitionRepository
	ScrapingConfig      ScrapingConfigRepository
	ConfigParameter     ConfigParameterRepository
	Schedule            ScheduleRepository
	ScrapingJob         ScrapingJobRepository
	ScrapingLog         ScrapingLogRepository
	ScrapingResult      ScrapingResultRepository
	Dashboard           DashboardRepository
}

// ── Users ────────────────────────────────────────────────────────────────────

type UserRepository interface {
	Create(user *models.User) error
	GetByEmail(email string) (*models.User, error)
	GetByID(id int) (*models.User, error)
	GetAll() ([]models.User, error)
}

// ── Scraper Types ────────────────────────────────────────────────────────────

type ScraperTypeRepository interface {
	Create(scraperType *models.ScraperType) error
	GetAll() ([]models.ScraperType, error)
	GetByID(id int) (*models.ScraperType, error)
	Update(scraperType *models.ScraperType) error
	Delete(id int) error
}

// ── Parameter Definitions ────────────────────────────────────────────────────

type ParameterDefinitionRepository interface {
	Create(definition *models.ParameterDefinition) error
	GetByScraperTypeID(scraperTypeID int) ([]models.ParameterDefinition, error)
	GetByID(id int) (*models.ParameterDefinition, error)
	Update(definition *models.ParameterDefinition) error
	Delete(id int) error
}

// ── Scraping Configs ─────────────────────────────────────────────────────────

type ScrapingConfigRepository interface {
	Create(config *models.ScrapingConfig) error
	GetAll() ([]models.ScrapingConfig, error)
	GetByID(id string) (*models.ScrapingConfig, error)
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
	GetAll(configID *string) ([]models.Schedule, error)
	GetByID(id int) (*models.Schedule, error)
	Update(schedule *models.Schedule) error
	Delete(id int) error
}

// ── Scraping Jobs ────────────────────────────────────────────────────────────

type ScrapingJobRepository interface {
	Create(job *models.ScrapingJob) error
	GetAll(configID *string) ([]models.ScrapingJob, error)
	GetByID(id string) (*models.ScrapingJob, error)
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
	GetSummary() (*models.DashboardSummary, error)
}
