package contract

import (
	"github.com/marchelrn/scrapers/models"
)

type Repository struct {
	Config ConfigRepository
	Project ProjectRepository
	Scheduler SchedulerRepository
	User UserRepository
	Website WebsiteRepository
}

type ConfigRepository interface {
	Create(config *models.ScrapeConfig) error
	GetAll(websiteID *int) ([]models.ScrapeConfig, error)
	GetByID(id int) (*models.ScrapeConfig, error)
	Update(config *models.ScrapeConfig) error
	Delete(id int) error
}

type ProjectRepository interface {
	Create(project *models.Project) error
	GetAll() ([]models.Project, error)
	GetByID(id int) (*models.Project, error)
	Update(project *models.Project) error
	Delete(id int) error
}

type SchedulerRepository interface {
	Create(scheduler *models.Scheduler) error
	GetAll(configID *int) ([]models.Scheduler, error)
	GetByID(id int) (*models.Scheduler, error)
	Update(scheduler *models.Scheduler) error
	Delete(id int) error
}

type UserRepository interface {
	Create(user *models.User) error
	GetByEmail(email string) (*models.User, error)
	GetByID(id int) (*models.User, error)
	GetAll() ([]models.User, error)
}

type WebsiteRepository interface {
	Create(website *models.Website) error
	GetAll(projectID *int) ([]models.Website, error)
	GetByID(id int) (*models.Website, error)
	Update(website *models.Website) error
	Delete(id int) error
}

