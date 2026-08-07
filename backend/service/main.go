package service

import (
	"github.com/marchelrn/scrapers/config"
	"github.com/marchelrn/scrapers/contract"
)

func New(repo *contract.Repository) *contract.Service {
	cfg := config.Load()

	jobSvc := ImplScrapingJobService(repo.ScrapingJob, repo.ScrapingLog, repo.ScrapingResult, repo.ScrapingConfig, repo.Secret, repo.ConfigParameter)
	scheduleSvc := ImplScheduleService(repo.Schedule, repo.ScrapingConfig, jobSvc)

	return &contract.Service{
		Auth:           ImplAuthService(repo.User, cfg),
		User:           ImplUserService(repo.User),
		ScrapingConfig: ImplScrapingConfigService(repo.ScrapingConfig, repo.ConfigParameter),
		Schedule:       scheduleSvc,
		ScrapingJob:    jobSvc,
		Dashboard:      ImplDashboardService(repo.Dashboard),
		Secret:         ImplSecretService(repo.Secret),
	}
}
