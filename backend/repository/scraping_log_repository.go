package repository

import (
	"github.com/marchelrn/scrapers/contract"
	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

// ScrapingLogRepository handles database operations for scraping_logs.
type ScrapingLogRepository struct {
	db *gorm.DB
}

func ImplScrapingLogRepository(db *gorm.DB) contract.ScrapingLogRepository {
	return &ScrapingLogRepository{db: db}
}

func (r *ScrapingLogRepository) Create(m *models.ScrapingLog) error {
	return r.db.Create(m).Error
}

func (r *ScrapingLogRepository) GetByJobID(jobID string) ([]models.ScrapingLog, error) {
	var ms []models.ScrapingLog
	err := r.db.Where("job_id = ?", jobID).Order("created_at ASC").Find(&ms).Error
	return ms, err
}
