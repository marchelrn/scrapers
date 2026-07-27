package contract

import (
	"github.com/marchelrn/scrapers/dto"
)

type Service struct {
	Auth           AuthService
	ScraperType    ScraperTypeService
	ScrapingConfig ScrapingConfigService
	Schedule       ScheduleService
	ScrapingJob    ScrapingJobService
}

// ── Auth ─────────────────────────────────────────────────────────────────────

type AuthService interface {
	Register(req dto.RegisterRequest) (*dto.UserResponse, error)
	Login(req dto.LoginRequest) (*dto.LoginResponse, error)
	GetUserByID(id int) (*dto.UserResponse, error)
	ValidateToken(tokenString string) (int, string, error)
}

// ── Scraper Types ────────────────────────────────────────────────────────────

type ScraperTypeService interface {
	Create(req dto.CreateScraperTypeRequest) (*dto.ScraperTypeResponse, error)
	GetAll() ([]dto.ScraperTypeResponse, error)
	GetByID(id int) (*dto.ScraperTypeResponse, error)
	Update(id int, req dto.UpdateScraperTypeRequest) (*dto.ScraperTypeResponse, error)
	Delete(id int) error
}

// ── Scraping Configs ─────────────────────────────────────────────────────────

type ScrapingConfigService interface {
	Create(req dto.CreateScrapingConfigRequest, userID int) (*dto.ScrapingConfigResponse, error)
	GetAll() ([]dto.ScrapingConfigResponse, error)
	GetByID(id string) (*dto.ScrapingConfigResponse, error)
	Update(id string, req dto.UpdateScrapingConfigRequest) (*dto.ScrapingConfigResponse, error)
	Delete(id string) error
}

// ── Schedules ────────────────────────────────────────────────────────────────

type ScheduleService interface {
	Create(req dto.CreateScheduleRequest) (*dto.ScheduleResponse, error)
	GetAll(configID *string) ([]dto.ScheduleResponse, error)
	GetByID(id int) (*dto.ScheduleResponse, error)
	Update(id int, req dto.UpdateScheduleRequest) (*dto.ScheduleResponse, error)
	Delete(id int) error
}

// ── Scraping Jobs ────────────────────────────────────────────────────────────

type ScrapingJobService interface {
	Create(req dto.CreateScrapingJobRequest) (*dto.ScrapingJobResponse, error)
	GetAll(configID *string) ([]dto.ScrapingJobResponse, error)
	GetByID(id string) (*dto.ScrapingJobResponse, error)
	UpdateStatus(id string, req dto.UpdateScrapingJobRequest) (*dto.ScrapingJobResponse, error)
	AddLog(jobID string, req dto.CreateScrapingLogRequest) (*dto.ScrapingLogResponse, error)
	AddResult(jobID string, req dto.CreateScrapingResultRequest) (*dto.ScrapingResultResponse, error)
}
