package contract

import (
	"github.com/marchelrn/scrapers/dto"
)

type Service struct {
	Auth           AuthService
	User           UserService
	ScrapingConfig ScrapingConfigService
	Schedule       ScheduleService
	ScrapingJob    ScrapingJobService
	Dashboard      DashboardService
	Secret         SecretService
}

// ── Secrets ──────────────────────────────────────────────────────────────────

type SecretService interface {
	Create(req dto.CreateSecretRequest, userID string) (*dto.SecretResponse, error)
	GetAll(userID string, userRole string) ([]dto.SecretResponse, error)
	GetByID(id string, userID string, userRole string) (*dto.SecretResponse, error)
	Update(id string, req dto.UpdateSecretRequest, userID string, userRole string) (*dto.SecretResponse, error)
	Delete(id string, userID string, userRole string) error
}

// ── Auth ─────────────────────────────────────────────────────────────────────

type AuthService interface {
	Register(req dto.RegisterRequest) (*dto.UserResponse, error)
	Login(req dto.LoginRequest) (*dto.LoginResponse, error)
	ValidateToken(tokenString string) (string, string, error)
}

// ── Users ────────────────────────────────────────────────────────────────────

type UserService interface {
	GetAll() ([]dto.UserResponse, error)
	GetUserByID(id string) (*dto.UserResponse, error)
	UpdateProfile(id string, req dto.UpdateProfileRequest) (*dto.UserResponse, error)
	UpdateAsAdmin(id string, req dto.UpdateRequest) (*dto.UserResponse, error)
	Delete(id string) error
}

// ── Scraping Configs ─────────────────────────────────────────────────────────

type ScrapingConfigService interface {
	Create(req dto.CreateScrapingConfigRequest, userID string) (*dto.ScrapingConfigResponse, error)
	GetAll(userID string, userRole string) ([]dto.ScrapingConfigResponse, error)
	GetByID(id string, userID string, userRole string) (*dto.ScrapingConfigResponse, error)
	Update(id string, req dto.UpdateScrapingConfigRequest, userID string, userRole string) (*dto.ScrapingConfigResponse, error)
	Delete(id string, userID string, userRole string) error
}

// ── Schedules ────────────────────────────────────────────────────────────────

type ScheduleService interface {
	StartScheduler() error
	StopScheduler()
	Create(req dto.CreateScheduleRequest, userID string, userRole string) (*dto.ScheduleResponse, error)
	GetAll(configID *string, userID string, userRole string) ([]dto.ScheduleResponse, error)
	GetByID(id int, userID string, userRole string) (*dto.ScheduleResponse, error)
	Update(id int, req dto.UpdateScheduleRequest, userID string, userRole string) (*dto.ScheduleResponse, error)
	Delete(id int, userID string, userRole string) error
}

// ── Scraping Jobs ────────────────────────────────────────────────────────────

type ScrapingJobService interface {
	RecoverStuckJobs() error
	Create(req dto.CreateScrapingJobRequest, userID string, userRole string) (*dto.ScrapingJobResponse, error)
	RunShortcut(configID string, req dto.RunConfigShortcutRequest, userID string, userRole string) (*dto.ScrapingJobResponse, error)
	GetAll(configID *string, userID string, userRole string, limit int, offset int) ([]dto.ScrapingJobResponse, error)
	GetByID(id string, userID string, userRole string) (*dto.ScrapingJobResponse, error)
	UpdateStatus(id string, req dto.UpdateScrapingJobRequest) (*dto.ScrapingJobResponse, error)
	AddLog(jobID string, req dto.CreateScrapingLogRequest) (*dto.ScrapingLogResponse, error)
	AddResult(jobID string, req dto.CreateScrapingResultRequest) (*dto.ScrapingResultResponse, error)
}

// ── Dashboard ────────────────────────────────────────────────────────────────

type DashboardService interface {
	GetSummary(userID string, userRole string) (*dto.DashboardSummaryResponse, error)
}
