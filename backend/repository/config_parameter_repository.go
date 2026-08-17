package repository

import (
	"github.com/marchelrn/scrapers/contract"
	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

// ConfigParameterRepository handles database operations for config_parameters.
type ConfigParameterRepository struct {
	db *gorm.DB
}

func ImplConfigParameterRepository(db *gorm.DB) contract.ConfigParameterRepository {
	return &ConfigParameterRepository{db: db}
}

func (r *ConfigParameterRepository) Create(m *models.ConfigParameter) error {
	return r.db.Create(m).Error
}

func (r *ConfigParameterRepository) GetByConfigID(configID string) ([]models.ConfigParameter, error) {
	var ms []models.ConfigParameter
	err := r.db.Where("config_id = ?", configID).Find(&ms).Error
	return ms, err
}

func (r *ConfigParameterRepository) DeleteByConfigID(configID string) error {
	return r.db.Where("config_id = ?", configID).Delete(&models.ConfigParameter{}).Error
}
