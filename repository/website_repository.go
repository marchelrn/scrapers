package repository

import (
	"github.com/marchelrn/scrapers/contract"

	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

// WebsiteRepository handles database operations for websites
type WebsiteRepository struct {
	db *gorm.DB
}

// NewWebsiteRepository creates a new WebsiteRepository
func ImplWebsiteRepository(db *gorm.DB) contract.WebsiteRepository {
	return &WebsiteRepository{db: db}
}

// Create inserts a new website into the database
func (r *WebsiteRepository) Create(m *models.Website) error {
	return r.db.Create(m).Error
}

// GetAll retrieves all websites, optionally filtered by project_id
func (r *WebsiteRepository) GetAll(projectID *int) ([]models.Website, error) {
	var ms []models.Website
	query := r.db
	if projectID != nil {
		query = query.Where("project_id = ?", *projectID)
	}
	err := query.Find(&ms).Error
	return ms, err
}

// GetByID retrieves a website by ID
func (r *WebsiteRepository) GetByID(id int) (*models.Website, error) {
	var m models.Website
	err := r.db.First(&m, id).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// Update modifies an existing website
func (r *WebsiteRepository) Update(m *models.Website) error {
	return r.db.Save(m).Error
}

// Delete removes a website by ID
func (r *WebsiteRepository) Delete(id int) error {
	return r.db.Delete(&models.Website{}, id).Error
}
