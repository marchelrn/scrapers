package service

import (
	"errors"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

type SecretService struct {
	secretRepo contract.SecretRepository
}

func ImplSecretService(secretRepo contract.SecretRepository) contract.SecretService {
	return &SecretService{
		secretRepo: secretRepo,
	}
}

func (s *SecretService) Create(req dto.CreateSecretRequest, userID string) (*dto.SecretResponse, error) {
	secret := &models.Secret{
		Name:        req.Name,
		Description: req.Description,
		SecretType:  req.SecretType,
		SecretValue: req.SecretValue,
		CreatedBy:   userID,
	}

	if err := s.secretRepo.Create(secret); err != nil {
		return nil, errors.New("failed to create secret")
	}

	resp := dto.ToSecretResponse(*secret)
	return &resp, nil
}

func (s *SecretService) GetAll(userID string, userRole string) ([]dto.SecretResponse, error) {
	secrets, err := s.secretRepo.GetAll(userID, userRole)
	if err != nil {
		return nil, errors.New("failed to get secrets")
	}

	responses := make([]dto.SecretResponse, 0, len(secrets))
	for _, sec := range secrets {
		responses = append(responses, dto.ToSecretResponse(sec))
	}
	return responses, nil
}

func (s *SecretService) GetByID(id string, userID string, userRole string) (*dto.SecretResponse, error) {
	secret, err := s.secretRepo.GetByID(id, userID, userRole)
	if err != nil {
		return nil, errors.New("secret not found")
	}
	resp := dto.ToSecretResponse(*secret)
	return &resp, nil
}

func (s *SecretService) Update(id string, req dto.UpdateSecretRequest, userID string, userRole string) (*dto.SecretResponse, error) {
	secret, err := s.secretRepo.GetByID(id, userID, userRole)
	if err != nil {
		return nil, errors.New("secret not found")
	}

	if req.Name != nil {
		secret.Name = *req.Name
	}
	if req.Description != nil {
		secret.Description = req.Description
	}
	if req.SecretType != nil {
		secret.SecretType = *req.SecretType
	}
	if req.SecretValue != nil {
		secret.SecretValue = *req.SecretValue
	}

	if err := s.secretRepo.Update(secret); err != nil {
		return nil, errors.New("failed to update secret")
	}

	resp := dto.ToSecretResponse(*secret)
	return &resp, nil
}

func (s *SecretService) Delete(id string, userID string, userRole string) error {
	_, err := s.secretRepo.GetByID(id, userID, userRole)
	if err != nil {
		return errors.New("secret not found")
	}
	if err := s.secretRepo.Delete(id); err != nil {
		return errors.New("failed to delete secret")
	}
	return nil
}
