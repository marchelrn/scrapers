package repository

import (
	"github.com/marchelrn/scrapers/contract"
	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

// ScrapingConfigRepository handles database operations for scraping_configs.
type ScrapingConfigRepository struct {
	db *gorm.DB
}

func ImplScrapingConfigRepository(db *gorm.DB) contract.ScrapingConfigRepository {
	return &ScrapingConfigRepository{db: db}
}

func (r *ScrapingConfigRepository) Create(m *models.ScrapingConfig) error {
	return r.db.Create(m).Error
}

func (r *ScrapingConfigRepository) GetAll() ([]models.ScrapingConfig, error) {
	var ms []models.ScrapingConfig
	err := r.db.Preload("Parameters").Preload("ScraperType").Find(&ms).Error
	return ms, err
}

func (r *ScrapingConfigRepository) GetByID(id string) (*models.ScrapingConfig, error) {
	var m models.ScrapingConfig
	err := r.db.Preload("Parameters").Preload("ScraperType").Preload("Schedules").Where("id = ?", id).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *ScrapingConfigRepository) Update(m *models.ScrapingConfig) error {
	return r.db.Save(m).Error
}

func (r *ScrapingConfigRepository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&models.ScrapingConfig{}).Error
}
