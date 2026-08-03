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

func (r *ScheduleRepository) GetAll(configID *string, userID string, userRole string) ([]models.Schedule, error) {
	var ms []models.Schedule
	query := r.db.Joins("JOIN scraping_configs ON schedules.config_id = scraping_configs.id")

	if configID != nil {
		query = query.Where("schedules.config_id = ?", *configID)
	}

	if userRole != models.UserRoleAdmin {
		query = query.Where("scraping_configs.created_by = ?", userID)
	}

	err := query.Find(&ms).Error
	return ms, err
}

func (r *ScheduleRepository) GetByID(id int, userID string, userRole string) (*models.Schedule, error) {
	var m models.Schedule
	query := r.db.Joins("JOIN scraping_configs ON schedules.config_id = scraping_configs.id").Where("schedules.id = ?", id)

	if userRole != models.UserRoleAdmin {
		query = query.Where("scraping_configs.created_by = ?", userID)
	}

	err := query.First(&m).Error
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
