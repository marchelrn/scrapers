package contract

import (
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

type Service struct {
	Auth      AuthService
	Config    ConfigService
	Project   ProjectService
	Scheduler SchedulerService
	Website   WebsiteService
}

type AuthService interface {
	Register(req dto.RegisterRequest) (*dto.UserResponse, error)
	Login(req dto.LoginRequest) (*dto.LoginResponse, error)
	GetUserByID(id int) (*dto.UserResponse, error)
	ValidateToken(tokenString string) (int, string, error)
}

type ConfigService interface {
	Create(req dto.CreateConfigRequest) (*dto.ResponseCreateConfigRequest, error)
	GetAll(websiteID *int) (*dto.ResponseGetAllConfig, error)
	GetByID(id int) (*dto.ResponseConfig, error)
	Update(id int, req dto.UpdateConfigRequest) (*dto.ResponseUpdateConfigRequest, error)
	Delete(id int) error
}

type ProjectService interface {
	Create(req dto.CreateProjectRequest, userID int) (*dto.ResponseCreateProjectRequest, error)
	GetAll() (*dto.ResponseGetAllProject, error)
	GetByID(id int) (*dto.ResponseProject, error)
	Update(id int, req dto.UpdateProjectRequest) (*dto.ResponseUpdateProjectRequest, error)
	Delete(id int) error
}

type SchedulerService interface {
	Create(req dto.CreateSchedulerRequest) (*models.Scheduler, error)
	GetAll(configID *int) ([]models.Scheduler, error)
	GetByID(id int) (*models.Scheduler, error)
	Update(id int, req dto.UpdateSchedulerRequest) (*models.Scheduler, error)
	Delete(id int) error
}

type WebsiteService interface {
	Create(req dto.CreateWebsiteRequest) (*models.Website, error)
	GetAll(projectID *int) ([]models.Website, error)
	GetByID(id int) (*models.Website, error)
	Update(id int, req dto.UpdateWebsiteRequest) (*models.Website, error)
	Delete(id int) error
}
