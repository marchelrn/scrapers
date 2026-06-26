package contract

import "github.com/marchelrn/scrapers/dto"

type Service struct {
	HealthService HealthService
}

type HealthService interface {
	GetStatus() *dto.Response
}

type AccountService interface {
	Login(email, password string) (*dto.AccountResponse, error)
	Register(payload *dto.RegisterPayload) (*dto.Response, error)
}
