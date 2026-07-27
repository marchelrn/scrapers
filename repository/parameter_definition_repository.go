package repository

import (
	"github.com/marchelrn/scrapers/contract"
	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

// ParameterDefinitionRepository handles database operations for parameter_definitions.
type ParameterDefinitionRepository struct {
	db *gorm.DB
}

func ImplParameterDefinitionRepository(db *gorm.DB) contract.ParameterDefinitionRepository {
	return &ParameterDefinitionRepository{db: db}
}

func (r *ParameterDefinitionRepository) Create(m *models.ParameterDefinition) error {
	return r.db.Create(m).Error
}

func (r *ParameterDefinitionRepository) GetByScraperTypeID(scraperTypeID int) ([]models.ParameterDefinition, error) {
	var ms []models.ParameterDefinition
	err := r.db.Where("scraper_type_id = ?", scraperTypeID).Find(&ms).Error
	return ms, err
}

func (r *ParameterDefinitionRepository) GetByID(id int) (*models.ParameterDefinition, error) {
	var m models.ParameterDefinition
	err := r.db.First(&m, id).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *ParameterDefinitionRepository) Update(m *models.ParameterDefinition) error {
	return r.db.Save(m).Error
}

func (r *ParameterDefinitionRepository) Delete(id int) error {
	return r.db.Delete(&models.ParameterDefinition{}, id).Error
}
