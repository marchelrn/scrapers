package repository

import (
	"github.com/marchelrn/scrapers/contract"
)

func New() *contract.Repository {
	return &contract.Repository{
		Health: ImplHealthRepository(),
	}
}
