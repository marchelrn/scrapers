package service

import "github.com/marchelrn/scrapers/contract"

func New(repo *contract.Repository) (*contract.Service, error) {
	return &contract.Service{
		HealthService: ImplHealthService(repo.Health),
	}, nil
}
