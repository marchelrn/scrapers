package contract

import "github.com/marchelrn/scrapers/dto"

type Service struct {
	HealthService HealthService
}

type HealthService interface {
	GetStatus() *dto.Response
}
