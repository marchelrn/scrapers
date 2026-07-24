package handler

import "github.com/marchelrn/scrapers/contract"

type Controllers struct {
	Auth      *AuthController
	Config    *ConfigController
	Project   *ProjectController
	Scheduler *SchedulerController
	Website   *WebsiteController
}

func New(repo *contract.Service) Controllers {
	ctrl := Controllers{
		Auth:      &AuthController{},
		Config:    &ConfigController{},
		Project:   &ProjectController{},
		Scheduler: &SchedulerController{},
		Website:   &WebsiteController{},
	}

	ctrl.Auth.InitService(repo)
	ctrl.Config.InitService(repo)
	ctrl.Project.InitService(repo)
	ctrl.Scheduler.InitService(repo)
	ctrl.Website.InitService(repo)

	return ctrl
}
