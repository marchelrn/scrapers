package handler

import "github.com/marchelrn/scrapers/contract"

type Controllers struct {
	Auth      *AuthController
	User      *UserController
	Config    *ScrapingConfigController
	Schedule  *ScheduleController
	Job       *ScrapingJobController
	Dashboard *DashboardController
	Secret    *SecretController
}

func New(svc *contract.Service) Controllers {
	ctrl := Controllers{
		Auth:      &AuthController{},
		User:      &UserController{},
		Config:    &ScrapingConfigController{},
		Schedule:  &ScheduleController{},
		Job:       &ScrapingJobController{},
		Dashboard: &DashboardController{},
		Secret:    &SecretController{},
	}

	ctrl.Auth.InitService(svc)
	ctrl.User.InitService(svc)
	ctrl.Config.InitService(svc)
	ctrl.Schedule.InitService(svc)
	ctrl.Job.InitService(svc)
	ctrl.Dashboard.InitService(svc)
	ctrl.Secret.InitService(svc)

	return ctrl
}
