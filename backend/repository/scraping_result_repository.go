package repository

import (
	"github.com/marchelrn/scrapers/contract"
	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

// ScrapingResultRepository handles database operations for scraping_results.
type ScrapingResultRepository struct {
	db *gorm.DB
}

func ImplScrapingResultRepository(db *gorm.DB) contract.ScrapingResultRepository {
	return &ScrapingResultRepository{db: db}
}

func (r *ScrapingResultRepository) Create(m *models.ScrapingResult) error {
	return r.db.Create(m).Error
}

func (r *ScrapingResultRepository) GetByJobID(jobID string) ([]models.ScrapingResult, error) {
	var ms []models.ScrapingResult
	err := r.db.Where("job_id = ?", jobID).Order("created_at ASC").Find(&ms).Error
	return ms, err
}
