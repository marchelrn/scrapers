package repository

import (
	"github.com/marchelrn/scrapers/contract"
	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

// ScraperTypeRepository handles database operations for scraper_types.
type ScraperTypeRepository struct {
	db *gorm.DB
}

func ImplScraperTypeRepository(db *gorm.DB) contract.ScraperTypeRepository {
	return &ScraperTypeRepository{db: db}
}

func (r *ScraperTypeRepository) Create(m *models.ScraperType) error {
	return r.db.Create(m).Error
}

func (r *ScraperTypeRepository) GetAll() ([]models.ScraperType, error) {
	var ms []models.ScraperType
	err := r.db.Preload("Parameters").Find(&ms).Error
	return ms, err
}

func (r *ScraperTypeRepository) GetByID(id int) (*models.ScraperType, error) {
	var m models.ScraperType
	err := r.db.Preload("Parameters").First(&m, id).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *ScraperTypeRepository) Update(m *models.ScraperType) error {
	return r.db.Save(m).Error
}

func (r *ScraperTypeRepository) Delete(id int) error {
	return r.db.Delete(&models.ScraperType{}, id).Error
}
