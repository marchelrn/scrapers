package service

import (
	"net/http"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
)

type HealthService struct {
	repo contract.HealthRepository
}

func ImplHealthService(repo contract.HealthRepository) *HealthService {
	return &HealthService{repo: repo}
}

func (s *HealthService) GetStatus() *dto.Response {
	response := s.repo.GetStatus()

	return &dto.Response{
		Status:  http.StatusOK,
		Message: response,
	}
}
