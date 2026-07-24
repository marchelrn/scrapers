package repository

import (
	"github.com/marchelrn/scrapers/contract"
	"gorm.io/gorm"
)

func New(db *gorm.DB) *contract.Repository {
	return &contract.Repository{
		Config:    ImplConfigRepository(db),
		Project:   ImplProjectRepository(db),
		Scheduler: ImplSchedulerRepository(db),
		User:      ImplUserRepository(db),
		Website:   ImplWebsiteRepository(db),
	}
}
