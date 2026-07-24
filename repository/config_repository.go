package repository

import (
	"github.com/marchelrn/scrapers/contract"

	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

// ConfigRepository handles database operations for scrape configs
type ConfigRepository struct {
	db *gorm.DB
}

// ImplConfigRepository NewConfigRepository creates a new ConfigRepository
func ImplConfigRepository(db *gorm.DB) contract.ConfigRepository {
	return &ConfigRepository{db: db}
}

// Create inserts a new scrape config into the database
func (r *ConfigRepository) Create(m *models.ScrapeConfig) error {
	return r.db.Create(m).Error
}

// GetAll retrieves all scrape configs, optionally filtered by website_id
func (r *ConfigRepository) GetAll(websiteID *int) ([]models.ScrapeConfig, error) {
	var ms []models.ScrapeConfig
	query := r.db
	if websiteID != nil {
		query = query.Where("website_id = ?", *websiteID)
	}
	err := query.Find(&ms).Error
	return ms, err
}

// GetByID retrieves a scrape config by ID
func (r *ConfigRepository) GetByID(id int) (*models.ScrapeConfig, error) {
	var m models.ScrapeConfig
	err := r.db.First(&m, id).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// Update modifies an existing scrape config
func (r *ConfigRepository) Update(m *models.ScrapeConfig) error {
	return r.db.Save(m).Error
}

// Delete removes a scrape config by ID
func (r *ConfigRepository) Delete(id int) error {
	return r.db.Delete(&models.ScrapeConfig{}, id).Error
}
