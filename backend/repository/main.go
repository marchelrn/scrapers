package repository

import (
	"github.com/marchelrn/scrapers/contract"
	"gorm.io/gorm"
)

func New(db *gorm.DB) *contract.Repository {
	return &contract.Repository{
		User:            ImplUserRepository(db),
		ScrapingConfig:  ImplScrapingConfigRepository(db),
		ConfigParameter: ImplConfigParameterRepository(db),
		Schedule:        ImplScheduleRepository(db),
		ScrapingJob:     ImplScrapingJobRepository(db),
		ScrapingLog:     ImplScrapingLogRepository(db),
		ScrapingResult:  ImplScrapingResultRepository(db),
		Dashboard:       ImplDashboardRepository(db),
	}
}
