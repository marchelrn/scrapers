package repository

import (
	"github.com/marchelrn/scrapers/contract"
	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

// ScheduleRepository handles database operations for schedules.
type ScheduleRepository struct {
	db *gorm.DB
}

func ImplScheduleRepository(db *gorm.DB) contract.ScheduleRepository {
	return &ScheduleRepository{db: db}
}

func (r *ScheduleRepository) Create(m *models.Schedule) error {
	return r.db.Create(m).Error
}

func (r *ScheduleRepository) GetAll(configID *string) ([]models.Schedule, error) {
	var ms []models.Schedule
	query := r.db
	if configID != nil {
		query = query.Where("config_id = ?", *configID)
	}
	err := query.Find(&ms).Error
	return ms, err
}

func (r *ScheduleRepository) GetByID(id int) (*models.Schedule, error) {
	var m models.Schedule
	err := r.db.First(&m, id).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *ScheduleRepository) Update(m *models.Schedule) error {
	return r.db.Save(m).Error
}

func (r *ScheduleRepository) Delete(id int) error {
	return r.db.Delete(&models.Schedule{}, id).Error
}
