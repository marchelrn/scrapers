package service

import "github.com/marchelrn/scrapers/contract"

type HealthService struct {
	repo contract.HealthRepository
}

func NewHealthService(repo contract.HealthRepository) *HealthService {
	return &HealthService{repo: repo}
}

func (s *HealthService) GetStatus() string {
	return s.repo.GetStatus()
}
