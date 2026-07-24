package repository

import (
	"github.com/marchelrn/scrapers/contract"

	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

// SchedulerRepository handles database operations for schedulers
type SchedulerRepository struct {
	db *gorm.DB
}

// NewSchedulerRepository creates a new SchedulerRepository
func ImplSchedulerRepository(db *gorm.DB) contract.SchedulerRepository {
	return &SchedulerRepository{db: db}
}

// Create inserts a new scheduler into the database
func (r *SchedulerRepository) Create(m *models.Scheduler) error {
	return r.db.Create(m).Error
}

// GetAll retrieves all schedulers, optionally filtered by config_id
func (r *SchedulerRepository) GetAll(configID *int) ([]models.Scheduler, error) {
	var ms []models.Scheduler
	query := r.db
	if configID != nil {
		query = query.Where("config_id = ?", *configID)
	}
	err := query.Find(&ms).Error
	return ms, err
}

// GetByID retrieves a scheduler by ID
func (r *SchedulerRepository) GetByID(id int) (*models.Scheduler, error) {
	var m models.Scheduler
	err := r.db.First(&m, id).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// Update modifies an existing scheduler
func (r *SchedulerRepository) Update(m *models.Scheduler) error {
	return r.db.Save(m).Error
}

// Delete removes a scheduler by ID
func (r *SchedulerRepository) Delete(id int) error {
	return r.db.Delete(&models.Scheduler{}, id).Error
}
