package handler

import "github.com/marchelrn/scrapers/contract"

type Controllers struct {
	Auth          *AuthController
	ScraperType   *ScraperTypeController
	Config        *ScrapingConfigController
	Schedule      *ScheduleController
	Job           *ScrapingJobController
	Dashboard     *DashboardController
}

func New(svc *contract.Service) Controllers {
	ctrl := Controllers{
		Auth:        &AuthController{},
		ScraperType: &ScraperTypeController{},
		Config:      &ScrapingConfigController{},
		Schedule:    &ScheduleController{},
		Job:         &ScrapingJobController{},
		Dashboard:   &DashboardController{},
	}

	ctrl.Auth.InitService(svc)
	ctrl.ScraperType.InitService(svc)
	ctrl.Config.InitService(svc)
	ctrl.Schedule.InitService(svc)
	ctrl.Job.InitService(svc)
	ctrl.Dashboard.InitService(svc)

	return ctrl
}
