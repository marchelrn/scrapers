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

type mockJobSvc struct {
	jobs []dto.ScrapingJobResponse
}

func (m *mockJobSvc) RecoverStuckJobs() error { return nil }

func (m *mockJobSvc) Create(req dto.CreateScrapingJobRequest, userID string, userRole string) (*dto.ScrapingJobResponse, error) {
	newJob := dto.ScrapingJobResponse{ID: "job-1", ConfigID: req.ConfigID, Status: models.JobStatusPending}
	m.jobs = append(m.jobs, newJob)
	return &newJob, nil
}

func (m *mockJobSvc) RunShortcut(configID string, req dto.RunConfigShortcutRequest, userID string, userRole string) (*dto.ScrapingJobResponse, error) {
	return nil, nil
}

func (m *mockJobSvc) GetAll(configID *string, userID string, userRole string, limit int, offset int) ([]dto.ScrapingJobResponse, error) {
	if configID != nil {
		var filtered []dto.ScrapingJobResponse
		for _, j := range m.jobs {
			if j.ConfigID == *configID {
				filtered = append(filtered, j)
			}
		}
		return filtered, nil
	}
	return m.jobs, nil
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

func TestScheduleConcurrencyLock(t *testing.T) {
	configID := "cfg-lock"
	cfgRepo := &mockConfigRepo{
		configs: []models.ScrapingConfig{
			{ID: configID, Status: models.ScrapingConfigStatusActive, ScheduleEnabled: true},
		},
	}

	schRepo := &mockScheduleRepo{}
	jobSvc := &mockJobSvc{}

	// Add an existing running job to the mock
	jobSvc.jobs = append(jobSvc.jobs, dto.ScrapingJobResponse{
		ID:       "existing-job",
		ConfigID: configID,
		Status:   models.JobStatusRunning,
	})

	svc := ImplScheduleService(schRepo, cfgRepo, jobSvc)

	sch := models.Schedule{
		ID:             99,
		ConfigID:       configID,
		CronExpression: "*/1 * * * *",
		Enabled:        true,
		Timezone:       "Asia/Makassar",
	}

	// This should run but NOT create a new job because one is already running
	s := svc.(*ScheduleService)
	s.cronRunner.Start()
	s.registerJobInternal(sch)

	// Trigger the job func manually to test the logic
	entry := s.cronRunner.Entries()[0]
	entry.Job.Run()

	if len(jobSvc.jobs) != 1 {
		t.Errorf("expected 1 job, got %d. Duplicate execution lock failed", len(jobSvc.jobs))
	}

	// Now simulate job finishing
	jobSvc.jobs[0].Status = models.JobStatusSuccess
	entry.Job.Run()

	if len(jobSvc.jobs) != 2 {
		t.Errorf("expected 2 jobs, got %d. Lock did not release after job success", len(jobSvc.jobs))
	}

	s.StopScheduler()
}
