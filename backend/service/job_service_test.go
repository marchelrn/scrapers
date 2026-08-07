package service

import (
	"encoding/json"
	"errors"
	"testing"
	"time"

	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
	"github.com/marchelrn/scrapers/pkg/registry"
	"github.com/marchelrn/scrapers/pkg/registry/methods"
)

// Mock repos for testing
type mockJobRepo struct {
	job *models.ScrapingJob
}

func (m *mockJobRepo) Create(job *models.ScrapingJob) error { return nil }
func (m *mockJobRepo) GetAll(configID *string, userID string, userRole string, limit int, offset int) ([]models.ScrapingJob, error) {
	return nil, nil
}
func (m *mockJobRepo) GetByID(id string, userID string, userRole string) (*models.ScrapingJob, error) {
	if m.job == nil {
		return nil, errors.New("not found")
	}
	return m.job, nil
}
func (m *mockJobRepo) Update(job *models.ScrapingJob) error {
	m.job = job
	return nil
}

type mockConfigRepoForJob struct {
	config *models.ScrapingConfig
}

func (m *mockConfigRepoForJob) Create(config *models.ScrapingConfig) error { return nil }
func (m *mockConfigRepoForJob) CreateWithParams(config *models.ScrapingConfig, params []models.ConfigParameter) error {
	return nil
}
func (m *mockConfigRepoForJob) GetAll(userID string, userRole string) ([]models.ScrapingConfig, error) {
	return nil, nil
}
func (m *mockConfigRepoForJob) GetByID(id string, userID string, userRole string) (*models.ScrapingConfig, error) {
	if m.config == nil {
		return nil, errors.New("not found")
	}
	return m.config, nil
}
func (m *mockConfigRepoForJob) Update(config *models.ScrapingConfig) error { return nil }
func (m *mockConfigRepoForJob) Delete(id string) error                     { return nil }

type mockSecretRepoForJob struct{}

func (m *mockSecretRepoForJob) Create(secret *models.Secret) error { return nil }
func (m *mockSecretRepoForJob) GetAll(userID string, userRole string) ([]models.Secret, error) {
	return nil, nil
}
func (m *mockSecretRepoForJob) GetByID(id string, userID string, userRole string) (*models.Secret, error) {
	return nil, errors.New("not found")
}
func (m *mockSecretRepoForJob) Update(secret *models.Secret) error { return nil }
func (m *mockSecretRepoForJob) Delete(id string) error             { return nil }

func TestJobStatusTransition(t *testing.T) {
	registry.Get().Register(methods.NewTargetURLMethod())

	tests := []struct {
		name        string
		startStatus string
		nextStatus  string
		expectError bool
	}{
		{"pending to running is valid", models.JobStatusPending, models.JobStatusRunning, false},
		{"pending to failed is valid", models.JobStatusPending, models.JobStatusFailed, false},
		{"pending to success is invalid", models.JobStatusPending, models.JobStatusSuccess, true},

		{"running to success is valid", models.JobStatusRunning, models.JobStatusSuccess, false},
		{"running to failed is valid", models.JobStatusRunning, models.JobStatusFailed, false},
		{"running to pending is invalid", models.JobStatusRunning, models.JobStatusPending, true},

		{"success to running is invalid", models.JobStatusSuccess, models.JobStatusRunning, true},
		{"success to pending is invalid", models.JobStatusSuccess, models.JobStatusPending, true},

		{"failed to running is invalid", models.JobStatusFailed, models.JobStatusRunning, true},
		{"failed to pending is invalid", models.JobStatusFailed, models.JobStatusPending, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			now := time.Now()
			repo := &mockJobRepo{
				job: &models.ScrapingJob{
					ID:        "job-1",
					ConfigID:  "cfg-1",
					Status:    tt.startStatus,
					StartedAt: &now,
				},
			}

			svc := &ScrapingJobService{
				jobRepo:         repo,
				configRepo:      &mockConfigRepoForJob{},
				secretRepo:      &mockSecretRepoForJob{},
				configParamRepo: &mockConfigParamRepo{},
			}

			next := tt.nextStatus
			req := dto.UpdateScrapingJobRequest{
				Status: &next,
			}

			_, err := svc.UpdateStatus("job-1", req)

			if tt.expectError && err == nil {
				t.Errorf("expected error for transition %s -> %s, got nil", tt.startStatus, tt.nextStatus)
			}

			if !tt.expectError && err != nil {
				t.Errorf("expected no error for transition %s -> %s, got %v", tt.startStatus, tt.nextStatus, err)
			}
		})
	}
}

func TestWorkerResultContractParsing(t *testing.T) {
	// 1. Test success output
	successOutput := []byte(`{
		"status": "success",
		"method": "target_url",
		"results": ["item1", "item2"],
		"metadata": {
			"source": "https://example.com",
			"fetched_at": "2026-07-29T10:00:00Z",
			"item_count": 2
		},
		"error": null
	}`)

	var res dto.WorkerResult
	err := json.Unmarshal(successOutput, &res)
	if err != nil {
		t.Fatalf("failed to parse success output: %v", err)
	}
	if res.Status != "success" {
		t.Errorf("expected status 'success', got '%s'", res.Status)
	}
	if res.Metadata.ItemCount != 2 {
		t.Errorf("expected item count 2, got %d", res.Metadata.ItemCount)
	}

	// 2. Test failure output
	failedOutput := []byte(`{
		"status": "failed",
		"method": "target_url",
		"results": [],
		"metadata": {
			"source": "https://example.com",
			"fetched_at": "2026-07-29T10:00:00Z",
			"item_count": 0
		},
		"error": {
			"code": "EXECUTION_ERROR",
			"message": "connection reset by peer"
		}
	}`)

	var failedRes dto.WorkerResult
	err = json.Unmarshal(failedOutput, &failedRes)
	if err != nil {
		t.Fatalf("failed to parse failed output: %v", err)
	}
	if failedRes.Status != "failed" {
		t.Errorf("expected status 'failed', got '%s'", failedRes.Status)
	}
	if failedRes.Error == nil {
		t.Fatalf("expected error object, got nil")
	}
	if failedRes.Error.Code != "EXECUTION_ERROR" {
		t.Errorf("expected error code 'EXECUTION_ERROR', got '%s'", failedRes.Error.Code)
	}
}
