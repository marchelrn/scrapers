package repository

import (
	"github.com/marchelrn/scrapers/contract"

	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

// ProjectRepository handles database operations for projects
type ProjectRepository struct {
	db *gorm.DB
}

// NewProjectRepository creates a new ProjectRepository
func ImplProjectRepository(db *gorm.DB) contract.ProjectRepository {
	return &ProjectRepository{db: db}
}

// Create inserts a new project into the database
func (r *ProjectRepository) Create(m *models.Project) error {
	return r.db.Create(m).Error
}

// GetAll retrieves all projects
func (r *ProjectRepository) GetAll() ([]models.Project, error) {
	var ms []models.Project
	err := r.db.Find(&ms).Error
	return ms, err
}

// GetByID retrieves a project by ID
func (r *ProjectRepository) GetByID(id int) (*models.Project, error) {
	var m models.Project
	err := r.db.First(&m, id).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// Update modifies an existing project
func (r *ProjectRepository) Update(m *models.Project) error {
	return r.db.Save(m).Error
}

// Delete removes a project by ID
func (r *ProjectRepository) Delete(id int) error {
	return r.db.Delete(&models.Project{}, id).Error
}
