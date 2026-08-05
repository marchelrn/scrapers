package repository

import (
	"github.com/marchelrn/scrapers/contract"
	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

type SecretRepository struct {
	db *gorm.DB
}

func ImplSecretRepository(db *gorm.DB) contract.SecretRepository {
	return &SecretRepository{db: db}
}

func (r *SecretRepository) Create(m *models.Secret) error {
	return r.db.Create(m).Error
}

func (r *SecretRepository) GetAll(userID string, userRole string) ([]models.Secret, error) {
	var ms []models.Secret
	query := r.db

	if userRole != models.UserRoleAdmin {
		query = query.Where("created_by = ?", userID)
	}

	err := query.Find(&ms).Error
	return ms, err
}

func (r *SecretRepository) GetByID(id string, userID string, userRole string) (*models.Secret, error) {
	var m models.Secret
	query := r.db.Where("id = ?", id)

	if userRole != models.UserRoleAdmin {
		query = query.Where("created_by = ?", userID)
	}

	err := query.First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *SecretRepository) Update(m *models.Secret) error {
	return r.db.Save(m).Error
}

func (r *SecretRepository) Delete(id string) error {
	return r.db.Where("id = ?", id).Delete(&models.Secret{}).Error
}
