package service

import (
	"errors"
	"testing"
	"time"

	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

type mockScheduleRepo struct {
	schedules []models.Schedule
	lastID    int
}

func (m *mockScheduleRepo) Create(schedule *models.Schedule) error {
	m.lastID++
	schedule.ID = m.lastID
	m.schedules = append(m.schedules, *schedule)
	return nil
}
func (m *mockScheduleRepo) GetAll(configID *string, userID string, userRole string) ([]models.Schedule, error) {
	return m.schedules, nil
}
func (m *mockScheduleRepo) GetByID(id int, userID string, userRole string) (*models.Schedule, error) {
	for i, s := range m.schedules {
		if s.ID == id {
			return &m.schedules[i], nil
		}
	}
	return nil, errors.New("not found")
}
func (m *mockScheduleRepo) Update(schedule *models.Schedule) error {
	for i, s := range m.schedules {
		if s.ID == schedule.ID {
			m.schedules[i] = *schedule
			return nil
		}
	}
	return errors.New("not found")
}
func (m *mockScheduleRepo) Delete(id int) error {
	var n []models.Schedule
	for _, s := range m.schedules {
		if s.ID != id {
			n = append(n, s)
		}
	}
	m.schedules = n
	return nil
}

type mockJobSvc struct{}

func (m *mockJobSvc) Create(req dto.CreateScrapingJobRequest, userID string, userRole string) (*dto.ScrapingJobResponse, error) {
	return &dto.ScrapingJobResponse{}, nil
}
func (m *mockJobSvc) GetAll(configID *string, userID string, userRole string) ([]dto.ScrapingJobResponse, error) {
	return nil, nil
}
func (m *mockJobSvc) GetByID(id string, userID string, userRole string) (*dto.ScrapingJobResponse, error) {
	return nil, nil
}
func (m *mockJobSvc) UpdateStatus(id string, req dto.UpdateScrapingJobRequest) (*dto.ScrapingJobResponse, error) {
	return nil, nil
}
func (m *mockJobSvc) AddLog(jobID string, req dto.CreateScrapingLogRequest) (*dto.ScrapingLogResponse, error) {
	return nil, nil
}
func (m *mockJobSvc) AddResult(jobID string, req dto.CreateScrapingResultRequest) (*dto.ScrapingResultResponse, error) {
	return nil, nil
}

func TestScheduleLifecycle(t *testing.T) {
	configID := "cfg-1"
	cfgRepo := &mockConfigRepo{
		configs: []models.ScrapingConfig{
			{ID: configID, Status: models.ScrapingConfigStatusActive, ScheduleEnabled: true},
		},
	}

	schRepo := &mockScheduleRepo{}
	jobSvc := &mockJobSvc{}

	svc := ImplScheduleService(schRepo, cfgRepo, jobSvc)

	// Test Start
	err := svc.StartScheduler()
	if err != nil {
		t.Fatalf("failed to start scheduler: %v", err)
	}

	// Test Create
	enabled := true
	req := dto.CreateScheduleRequest{
		ConfigID:       configID,
		CronExpression: "*/1 * * * *", // every minute
		Enabled:        &enabled,
	}

	resp, err := svc.Create(req, "user1", models.UserRoleAdmin)
	if err != nil {
		t.Fatalf("failed to create schedule: %v", err)
	}

	if resp.NextRun == nil {
		t.Errorf("NextRun was not computed upon creation")
	}

	// Wait slightly to let cron catch up internally (though it's synchronous for addition)
	time.Sleep(50 * time.Millisecond)

	// Test Update
	newCron := "0 0 * * *" // daily
	disabled := false
	updReq := dto.UpdateScheduleRequest{
		CronExpression: &newCron,
		Enabled:        &disabled,
	}

	updResp, err := svc.Update(resp.ID, updReq, "user1", models.UserRoleAdmin)
	if err != nil {
		t.Fatalf("failed to update schedule: %v", err)
	}

	if updResp.NextRun != nil {
		t.Errorf("NextRun should be nil when disabled, got %v", updResp.NextRun)
	}

	// Test Delete
	err = svc.Delete(resp.ID, "user1", models.UserRoleAdmin)
	if err != nil {
		t.Fatalf("failed to delete schedule: %v", err)
	}

	svc.StopScheduler()
}
