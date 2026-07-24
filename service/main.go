package service

import (
	"github.com/marchelrn/scrapers/config"
	"github.com/marchelrn/scrapers/contract"
)

func New(repo *contract.Repository) *contract.Service {
	cfg := config.Load()

	return &contract.Service{
		Auth:      ImplAuthService(repo.User, cfg),
		Project:   ImplProjectService(repo.Project),
		Website:   ImplWebsiteService(repo.Website, repo.Project),
		Config:    ImplConfigService(repo.Config, repo.Website),
		Scheduler: ImplSchedulerService(repo.Scheduler, repo.Config),
	}
}
