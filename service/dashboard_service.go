package service

import (
	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
)

type dashboardService struct {
	repo contract.DashboardRepository
}

func ImplDashboardService(repo contract.DashboardRepository) contract.DashboardService {
	return &dashboardService{repo: repo}
}

func (s *dashboardService) GetSummary() (*dto.DashboardSummaryResponse, error) {
	summary, err := s.repo.GetSummary()
	if err != nil {
		return nil, err
	}

	return &dto.DashboardSummaryResponse{
		ActiveWorkers:  summary.ActiveWorkers,
		RunningJobs:    summary.RunningJobs,
		FailedJobs:     summary.FailedJobs,
		SuccessfulJobs: summary.SuccessfulJobs,
		Queue:          summary.Queue,
		WorkerCPU:      summary.WorkerCPU,
		LastExecution:  summary.LastExecution,
		NextExecution:  summary.NextExecution,
	}, nil
}
