package repository

import (
	"github.com/marchelrn/scrapers/contract"
	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

// ScrapingJobRepository handles database operations for scraping_jobs.
type ScrapingJobRepository struct {
	db *gorm.DB
}

func ImplScrapingJobRepository(db *gorm.DB) contract.ScrapingJobRepository {
	return &ScrapingJobRepository{db: db}
}

func (r *ScrapingJobRepository) Create(m *models.ScrapingJob) error {
	return r.db.Create(m).Error
}

func (r *ScrapingJobRepository) GetAll(configID *string) ([]models.ScrapingJob, error) {
	var ms []models.ScrapingJob
	query := r.db
	if configID != nil {
		query = query.Where("config_id = ?", *configID)
	}
	err := query.Order("started_at DESC").Find(&ms).Error
	return ms, err
}

func (r *ScrapingJobRepository) GetByID(id string) (*models.ScrapingJob, error) {
	var m models.ScrapingJob
	err := r.db.Preload("Logs").Preload("Results").Where("id = ?", id).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *ScrapingJobRepository) Update(m *models.ScrapingJob) error {
	return r.db.Save(m).Error
}
