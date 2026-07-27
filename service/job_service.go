package service

import (
	"encoding/json"
	"errors"
	"os/exec"
	"time"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

// ScrapingJobService handles scraping job business logic.
type ScrapingJobService struct {
	jobRepo    contract.ScrapingJobRepository
	logRepo    contract.ScrapingLogRepository
	resultRepo contract.ScrapingResultRepository
	configRepo contract.ScrapingConfigRepository
}

func ImplScrapingJobService(
	jobRepo contract.ScrapingJobRepository,
	logRepo contract.ScrapingLogRepository,
	resultRepo contract.ScrapingResultRepository,
	configRepo contract.ScrapingConfigRepository,
) contract.ScrapingJobService {
	return &ScrapingJobService{
		jobRepo:    jobRepo,
		logRepo:    logRepo,
		resultRepo: resultRepo,
		configRepo: configRepo,
	}
}

// Create queues a new scraping job.
func (s *ScrapingJobService) Create(req dto.CreateScrapingJobRequest) (*dto.ScrapingJobResponse, error) {
	// Validate config exists
	config, err := s.configRepo.GetByID(req.ConfigID)
	if err != nil {
		return nil, errors.New("scraping config not found")
	}

	job := &models.ScrapingJob{
		ConfigID: req.ConfigID,
		Status:   models.JobStatusPending,
	}

	if err := s.jobRepo.Create(job); err != nil {
		return nil, errors.New("failed to create job")
	}

	// TRIGGER EXECUTOR IN BACKGROUND
	go s.executeJobAsync(job.ID, config)

	resp := dto.ToScrapingJobResponse(*job)
	return &resp, nil
}

// GetAll retrieves all jobs, optionally filtered by config_id.
func (s *ScrapingJobService) GetAll(configID *string) ([]dto.ScrapingJobResponse, error) {
	jobs, err := s.jobRepo.GetAll(configID)
	if err != nil {
		return nil, errors.New("failed to get jobs")
	}

	responses := make([]dto.ScrapingJobResponse, 0, len(jobs))
	for _, j := range jobs {
		responses = append(responses, dto.ToScrapingJobResponse(j))
	}
	return responses, nil
}

// GetByID retrieves a job by UUID, including logs and results.
func (s *ScrapingJobService) GetByID(id string) (*dto.ScrapingJobResponse, error) {
	job, err := s.jobRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("job not found")
	}
	resp := dto.ToScrapingJobResponse(*job)
	return &resp, nil
}

// UpdateStatus updates the execution state of a job (used by workers).
func (s *ScrapingJobService) UpdateStatus(id string, req dto.UpdateScrapingJobRequest) (*dto.ScrapingJobResponse, error) {
	job, err := s.jobRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("job not found")
	}

	if req.Status != nil {
		job.Status = *req.Status
	}
	if req.StartedAt != nil {
		job.StartedAt = req.StartedAt
	}
	if req.FinishedAt != nil {
		job.FinishedAt = req.FinishedAt
	}
	if req.WorkerName != nil {
		job.WorkerName = req.WorkerName
	}

	if err := s.jobRepo.Update(job); err != nil {
		return nil, errors.New("failed to update job")
	}

	resp := dto.ToScrapingJobResponse(*job)
	return &resp, nil
}

// AddLog adds a log entry to a job.
func (s *ScrapingJobService) AddLog(jobID string, req dto.CreateScrapingLogRequest) (*dto.ScrapingLogResponse, error) {
	// Validate job exists
	_, err := s.jobRepo.GetByID(jobID)
	if err != nil {
		return nil, errors.New("job not found")
	}

	level := models.ScrapingLogLevelInfo
	if req.Level != "" {
		level = req.Level
	}

	log := &models.ScrapingLog{
		JobID:   jobID,
		Level:   level,
		Message: req.Message,
	}

	if err := s.logRepo.Create(log); err != nil {
		return nil, errors.New("failed to create log")
	}

	resp := dto.ToScrapingLogResponse(*log)
	return &resp, nil
}

// AddResult persists JSONB output for a job.
func (s *ScrapingJobService) AddResult(jobID string, req dto.CreateScrapingResultRequest) (*dto.ScrapingResultResponse, error) {
	// Validate job exists
	_, err := s.jobRepo.GetByID(jobID)
	if err != nil {
		return nil, errors.New("job not found")
	}

	result := &models.ScrapingResult{
		JobID:      jobID,
		ResultJSON: req.ResultJSON,
	}

	if err := s.resultRepo.Create(result); err != nil {
		return nil, errors.New("failed to create result")
	}

	resp := dto.ToScrapingResultResponse(*result)
	return &resp, nil
}

// executeJobAsync runs the python worker in the background
func (s *ScrapingJobService) executeJobAsync(jobID string, config *models.ScrapingConfig) {
	// Update status to running
	statusRunning := models.JobStatusRunning
	workerName := "go-backend-executor"
	now := time.Now()
	s.UpdateStatus(jobID, dto.UpdateScrapingJobRequest{
		Status:     &statusRunning,
		StartedAt:  &now,
		WorkerName: &workerName,
	})

	// Collect parameters
	params := make(map[string]interface{})
	for _, p := range config.Parameters {
		var val interface{}
		_ = json.Unmarshal(p.ParameterValue, &val)
		params[p.ParameterName] = val
	}
	paramsJSONBytes, _ := json.Marshal(params)
	paramsJSON := string(paramsJSONBytes)

	// Run command using venv python
	pythonFile := config.ScraperType.PythonFile
	cmd := exec.Command("workers/python/venv/bin/python", "workers/python/worker.py", pythonFile, paramsJSON)
	
	output, err := cmd.CombinedOutput()
	
	now = time.Now()
	if err != nil {
		statusFailed := models.JobStatusFailed
		s.UpdateStatus(jobID, dto.UpdateScrapingJobRequest{
			Status:     &statusFailed,
			FinishedAt: &now,
		})
		s.AddLog(jobID, dto.CreateScrapingLogRequest{
			Level:   models.ScrapingLogLevelError,
			Message: "Execution failed: " + err.Error() + "\nOutput: " + string(output),
		})
		return
	}

	// Save raw output as JSON
	s.AddResult(jobID, dto.CreateScrapingResultRequest{
		ResultJSON: json.RawMessage(output),
	})

	statusSuccess := models.JobStatusSuccess
	s.UpdateStatus(jobID, dto.UpdateScrapingJobRequest{
		Status:     &statusSuccess,
		FinishedAt: &now,
	})
	
	s.AddLog(jobID, dto.CreateScrapingLogRequest{
		Level:   models.ScrapingLogLevelInfo,
		Message: "Execution finished successfully",
	})
}

