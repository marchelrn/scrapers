package service

import (
	"github.com/marchelrn/scrapers/config"
	"github.com/marchelrn/scrapers/contract"
)

func New(repo *contract.Repository) *contract.Service {
	cfg := config.Load()

	return &contract.Service{
		Auth:           ImplAuthService(repo.User, cfg),
		ScraperType:    ImplScraperTypeService(repo.ScraperType),
		ScrapingConfig: ImplScrapingConfigService(repo.ScrapingConfig, repo.ConfigParameter, repo.ScraperType),
		Schedule:       ImplScheduleService(repo.Schedule, repo.ScrapingConfig),
		ScrapingJob:    ImplScrapingJobService(repo.ScrapingJob, repo.ScrapingLog, repo.ScrapingResult, repo.ScrapingConfig),
		Dashboard:      ImplDashboardService(repo.Dashboard),
	}
}
