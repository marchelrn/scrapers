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

func (r *ScrapingJobRepository) GetAll(configID *string, userID string, userRole string) ([]models.ScrapingJob, error) {
	var ms []models.ScrapingJob
	query := r.db.Joins("JOIN scraping_configs ON scraping_jobs.config_id = scraping_configs.id")

	if configID != nil {
		query = query.Where("scraping_jobs.config_id = ?", *configID)
	}

	if userRole != models.UserRoleAdmin {
		query = query.Where("scraping_configs.created_by = ?", userID)
	}

	err := query.Order("scraping_jobs.started_at DESC").Find(&ms).Error
	return ms, err
}

func (r *ScrapingJobRepository) GetByID(id string, userID string, userRole string) (*models.ScrapingJob, error) {
	var m models.ScrapingJob
	query := r.db.Preload("Logs").Preload("Results").Joins("JOIN scraping_configs ON scraping_jobs.config_id = scraping_configs.id").Where("scraping_jobs.id = ?", id)

	if userRole != models.UserRoleAdmin {
		query = query.Where("scraping_configs.created_by = ?", userID)
	}

	err := query.First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *ScrapingJobRepository) Update(m *models.ScrapingJob) error {
	return r.db.Save(m).Error
}
