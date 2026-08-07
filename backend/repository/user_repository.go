package repository

import (
	"errors"

	"github.com/marchelrn/scrapers/contract"
	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/models"
)

// UserRepository handles database operations for users.
type UserRepository struct {
	db *gorm.DB
}

func ImplUserRepository(db *gorm.DB) contract.UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(m *models.User) error {
	return r.db.Create(m).Error
}

func (r *UserRepository) GetByEmail(email string) (*models.User, error) {
	var m models.User
	err := r.db.Where("email = ?", email).First(&m).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &m, nil
}

func (r *UserRepository) GetByID(id string) (*models.User, error) {
	var m models.User
	err := r.db.Where("id = ?", id).First(&m).Error
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func (r *UserRepository) GetAll() ([]models.User, error) {
	var ms []models.User
	err := r.db.Find(&ms).Error
	return ms, err
}

func (r *UserRepository) Update(id string, m *models.User) (*models.User, error) {
	err := r.db.Where("id = ?", id).Updates(m).Error
	if err != nil {
		return nil, err
	}
	return m, nil
}

func (r *UserRepository) Delete(id string) error {
	err := r.db.Table("users").Where("id = ?", id).Delete(&models.User{}).Error
	if err != nil {
		return err
	}
	return nil
}
