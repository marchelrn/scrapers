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

func (r *ScrapingConfigRepository) CreateWithParams(m *models.ScrapingConfig, params []models.ConfigParameter) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(m).Error; err != nil {
			return err
		}
		for i := range params {
			params[i].ConfigID = m.ID
			if err := tx.Create(&params[i]).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *ScrapingConfigRepository) GetAll(userID string, userRole string) ([]models.ScrapingConfig, error) {
	var ms []models.ScrapingConfig
	query := r.db.Preload("Parameters")

	if userRole != models.UserRoleAdmin {
		query = query.Where("created_by = ?", userID)
	}

	err := query.Find(&ms).Error
	return ms, err
}

func (r *ScrapingConfigRepository) GetByID(id string, userID string, userRole string) (*models.ScrapingConfig, error) {
	var m models.ScrapingConfig
	query := r.db.Preload("Parameters").Preload("Schedules").Where("id = ?", id)

	if userRole != models.UserRoleAdmin {
		query = query.Where("created_by = ?", userID)
	}

	err := query.First(&m).Error
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
