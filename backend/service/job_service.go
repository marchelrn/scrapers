package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
	"github.com/marchelrn/scrapers/pkg/registry"
)

// ScrapingJobService handles scraping job business logic.
type ScrapingJobService struct {
	jobRepo         contract.ScrapingJobRepository
	logRepo         contract.ScrapingLogRepository
	resultRepo      contract.ScrapingResultRepository
	configRepo      contract.ScrapingConfigRepository
	secretRepo      contract.SecretRepository
	configParamRepo contract.ConfigParameterRepository
}

func ImplScrapingJobService(
	jobRepo contract.ScrapingJobRepository,
	logRepo contract.ScrapingLogRepository,
	resultRepo contract.ScrapingResultRepository,
	configRepo contract.ScrapingConfigRepository,
	secretRepo contract.SecretRepository,
	configParamRepo contract.ConfigParameterRepository,
) contract.ScrapingJobService {
	return &ScrapingJobService{
		jobRepo:         jobRepo,
		logRepo:         logRepo,
		resultRepo:      resultRepo,
		configRepo:      configRepo,
		secretRepo:      secretRepo,
		configParamRepo: configParamRepo,
	}
}

// RecoverStuckJobs finds jobs stuck in pending or running state due to a server crash and marks them as failed.
func (s *ScrapingJobService) RecoverStuckJobs() error {
	jobs, err := s.jobRepo.GetAll(nil, "", models.UserRoleAdmin, 0, 0)
	if err != nil {
		return errors.New("failed to retrieve jobs for recovery")
	}

	for _, job := range jobs {
		if job.Status == models.JobStatusPending || job.Status == models.JobStatusRunning {
			statusFailed := models.JobStatusFailed
			now := time.Now()
			s.UpdateStatus(job.ID, dto.UpdateScrapingJobRequest{
				Status:     &statusFailed,
				FinishedAt: &now,
			})

			s.AddLog(job.ID, dto.CreateScrapingLogRequest{
				Level:   models.ScrapingLogLevelError,
				Message: "Job execution interrupted and marked as failed due to server restart/crash.",
			})
		}
	}
	return nil
}

// Create queues a new scraping job.
func (s *ScrapingJobService) Create(req dto.CreateScrapingJobRequest, userID string, userRole string) (*dto.ScrapingJobResponse, error) {
	// Validate config exists and user owns it
	config, err := s.configRepo.GetByID(req.ConfigID, userID, userRole)
	if err != nil {
		return nil, errors.New("scraping config not found or unauthorized")
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

// RunShortcut updates parameters and instantly runs a job.
func (s *ScrapingJobService) RunShortcut(configID string, req dto.RunConfigShortcutRequest, userID string, userRole string) (*dto.ScrapingJobResponse, error) {
	// Validate config exists and user owns it
	config, err := s.configRepo.GetByID(configID, userID, userRole)
	if err != nil {
		return nil, errors.New("scraping config not found or unauthorized")
	}

	updatedConfig := config
	if len(req.Parameters) > 0 {
		// Validate new parameters against registry
		method, err := registry.Get().GetMethod(config.MethodCode)
		if err != nil {
			return nil, errors.New("invalid method code on config")
		}

		paramMap := make(map[string]interface{})
		for _, p := range req.Parameters {
			var val interface{}
			if err := json.Unmarshal(p.ParameterValue, &val); err != nil {
				return nil, errors.New("invalid json in parameter " + p.ParameterName)
			}
			paramMap[p.ParameterName] = val
		}

		if err := method.Validate(paramMap); err != nil {
			return nil, errors.New("invalid parameters: " + err.Error())
		}

		// Replace parameters in DB
		if err := s.configParamRepo.DeleteByConfigID(configID); err != nil {
			return nil, errors.New("failed to clear old parameters")
		}
		for _, p := range req.Parameters {
			param := &models.ConfigParameter{
				ConfigID:       configID,
				ParameterName:  p.ParameterName,
				ParameterValue: p.ParameterValue,
			}
			if err := s.configParamRepo.Create(param); err != nil {
				return nil, errors.New("failed to update config parameters")
			}
		}

		// Reload config to get the newly attached parameters for execution
		updatedConfig, _ = s.configRepo.GetByID(configID, userID, userRole)
	}

	// Create and Run Job
	job := &models.ScrapingJob{
		ConfigID: configID,
		Status:   models.JobStatusPending,
	}

	if err := s.jobRepo.Create(job); err != nil {
		return nil, errors.New("failed to create job")
	}

	// TRIGGER EXECUTOR IN BACKGROUND
	go s.executeJobAsync(job.ID, updatedConfig)

	resp := dto.ToScrapingJobResponse(*job)
	return &resp, nil
}

// GetAll retrieves all jobs, optionally filtered by config_id.
func (s *ScrapingJobService) GetAll(configID *string, userID string, userRole string, limit int, offset int) ([]dto.ScrapingJobResponse, error) {
	jobs, err := s.jobRepo.GetAll(configID, userID, userRole, limit, offset)
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
func (s *ScrapingJobService) GetByID(id string, userID string, userRole string) (*dto.ScrapingJobResponse, error) {
	job, err := s.jobRepo.GetByID(id, userID, userRole)
	if err != nil {
		return nil, errors.New("job not found or unauthorized")
	}
	resp := dto.ToScrapingJobResponse(*job)
	return &resp, nil
}

// UpdateStatus updates the execution state of a job (used by workers).
func (s *ScrapingJobService) UpdateStatus(id string, req dto.UpdateScrapingJobRequest) (*dto.ScrapingJobResponse, error) {
	// Internal update bypasses ownership checks by using admin role
	job, err := s.jobRepo.GetByID(id, "", models.UserRoleAdmin)
	if err != nil {
		return nil, errors.New("job not found")
	}

	if req.Status != nil {
		newStatus := *req.Status
		// State transition validation
		isValidTransition := false
		switch job.Status {
		case models.JobStatusPending:
			if newStatus == models.JobStatusRunning || newStatus == models.JobStatusFailed {
				isValidTransition = true
			}
		case models.JobStatusRunning:
			if newStatus == models.JobStatusSuccess || newStatus == models.JobStatusFailed {
				isValidTransition = true
			}
		}

		if !isValidTransition {
			return nil, errors.New("invalid status transition from " + job.Status + " to " + newStatus)
		}
		job.Status = newStatus
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
	// Validate job exists, bypass ownership check for internal worker
	_, err := s.jobRepo.GetByID(jobID, "", models.UserRoleAdmin)
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
	// Validate job exists, bypass ownership check for internal worker
	_, err := s.jobRepo.GetByID(jobID, "", models.UserRoleAdmin)
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

	// Get method from registry
	method, err := registry.Get().GetMethod(config.MethodCode)
	if err != nil {
		statusFailed := models.JobStatusFailed
		now = time.Now()
		s.UpdateStatus(jobID, dto.UpdateScrapingJobRequest{
			Status:     &statusFailed,
			FinishedAt: &now,
		})
		s.AddLog(jobID, dto.CreateScrapingLogRequest{
			Level:   models.ScrapingLogLevelError,
			Message: "Failed to get method from registry: " + err.Error(),
		})
		return
	}

	// Collect parameters
	params := make(map[string]interface{})
	for _, p := range config.Parameters {
		var val interface{}
		_ = json.Unmarshal(p.ParameterValue, &val)
		params[p.ParameterName] = val
	}

	// Resolve secret_reference if present
	if secretID, ok := params["secret_reference"]; ok && secretID != "" {
		if sidStr, isStr := secretID.(string); isStr {
			// Get secret (bypassing ownership check since this is internal execution)
			// But ideally we should ensure the config owner owns the secret.
			// Let's use the config creator ID to fetch it safely.
			creatorID := ""
			if config.CreatedBy != nil {
				creatorID = *config.CreatedBy
			}

			secret, err := s.secretRepo.GetByID(sidStr, creatorID, models.UserRoleOperator)
			if err != nil {
				// Fallback to admin if config owner is missing or something
				secret, err = s.secretRepo.GetByID(sidStr, "", models.UserRoleAdmin)
			}

			if err == nil && secret != nil {
				// Inject the resolved secret value into the params for the worker
				// Clean the secret from accidental quotes or spaces that user might have pasted into DB
				cleanSecret := strings.TrimSpace(secret.SecretValue)
				cleanSecret = strings.Trim(cleanSecret, `"`)
				cleanSecret = strings.Trim(cleanSecret, `'`)

				params["_resolved_secret_value"] = cleanSecret
				params["_resolved_secret_type"] = secret.SecretType
			} else {
				s.AddLog(jobID, dto.CreateScrapingLogRequest{
					Level:   models.ScrapingLogLevelWarn,
					Message: "Failed to resolve secret_reference: " + sidStr,
				})
			}
		}
	}

	// Run command using registry method with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	workerResult, err := method.Execute(ctx, params)
	now = time.Now()

	if err != nil || workerResult.Status != "success" {
		statusFailed := models.JobStatusFailed
		s.UpdateStatus(jobID, dto.UpdateScrapingJobRequest{
			Status:     &statusFailed,
			FinishedAt: &now,
		})

		errorMsg := "Execution failed"
		if ctx.Err() == context.DeadlineExceeded {
			errorMsg = "Execution timed out"
		} else if err != nil {
			errorMsg = "Execution error: " + err.Error()
		} else if workerResult != nil && workerResult.Error != nil {
			errorMsg = "Worker error: " + workerResult.Error.Message
		}

		s.AddLog(jobID, dto.CreateScrapingLogRequest{
			Level:   models.ScrapingLogLevelError,
			Message: errorMsg,
		})

		// Still save result if parseable even if failed
		if workerResult != nil {
			resBytes, _ := json.Marshal(workerResult)
			s.AddResult(jobID, dto.CreateScrapingResultRequest{
				ResultJSON: json.RawMessage(resBytes),
			})
		}
		return
	}

	// Save valid contract output
	resBytes, _ := json.Marshal(workerResult)
	s.AddResult(jobID, dto.CreateScrapingResultRequest{
		ResultJSON: json.RawMessage(resBytes),
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
