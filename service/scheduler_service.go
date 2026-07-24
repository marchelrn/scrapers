package service

import (
	"errors"

	"github.com/marchelrn/scrapers/repository"

	"github.com/robfig/cron/v3"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

// SchedulerService handles scheduler business logic
type SchedulerService struct {
	schedulerRepo contract.SchedulerRepository
	configRepo    contract.ConfigRepository
}

// NewSchedulerService creates a new SchedulerService
func ImplSchedulerService(schedulerRepo contract.SchedulerRepository, configRepo contract.ConfigRepository) contract.SchedulerService {
	return &SchedulerService{
		schedulerRepo: schedulerRepo,
		configRepo:    configRepo,
	}
}

// Create validates and creates a new scheduler
func (s *SchedulerService) Create(req dto.CreateSchedulerRequest) (*models.Scheduler, error) {
	// Validate config exists
	_, err := s.configRepo.GetByID(req.ConfigID)
	if err != nil {
		return nil, errors.New("scraping config not found")
	}

	// Validate cron expression
	if err := s.validateCronExpression(req.CronExpression); err != nil {
		return nil, err
	}

	timezone := "Asia/Jakarta"
	if req.Timezone != "" {
		timezone = req.Timezone
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	scheduler := &models.Scheduler{
		ConfigID:       req.ConfigID,
		CronExpression: req.CronExpression,
		Timezone:       timezone,
		Enabled:        enabled,
	}

	if err := s.schedulerRepo.Create(scheduler); err != nil {
		return nil, errors.New("failed to create scheduler")
	}

	return scheduler, nil
}

// GetAll retrieves all schedulers, optionally filtered by config_id
func (s *SchedulerService) GetAll(configID *int) ([]models.Scheduler, error) {
	return s.schedulerRepo.GetAll(configID)
}

// GetByID retrieves a scheduler by ID
func (s *SchedulerService) GetByID(id int) (*models.Scheduler, error) {
	scheduler, err := s.schedulerRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("scheduler not found")
	}
	return scheduler, nil
}

// Update validates and updates a scheduler
func (s *SchedulerService) Update(id int, req dto.UpdateSchedulerRequest) (*models.Scheduler, error) {
	// Validate config exists
	_, err := s.configRepo.GetByID(req.ConfigID)
	if err != nil {
		return nil, errors.New("scraping config not found")
	}

	// Validate cron expression
	if err := s.validateCronExpression(req.CronExpression); err != nil {
		return nil, err
	}

	scheduler, err := s.schedulerRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("scheduler not found")
	}

	scheduler.ConfigID = req.ConfigID
	scheduler.CronExpression = req.CronExpression

	if req.Timezone != "" {
		scheduler.Timezone = req.Timezone
	}

	if req.Enabled != nil {
		scheduler.Enabled = *req.Enabled
	}

	if err := s.schedulerRepo.Update(scheduler); err != nil {
		return nil, errors.New("failed to update scheduler")
	}

	return scheduler, nil
}

// Delete removes a scheduler by ID
func (s *SchedulerService) Delete(id int) error {
	if err := s.schedulerRepo.Delete(id); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			return errors.New("scheduler not found")
		}
		return errors.New("failed to delete scheduler")
	}
	return nil
}

// validateCronExpression checks if a cron expression is valid using robfig/cron
func (s *SchedulerService) validateCronExpression(expression string) error {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	_, err := parser.Parse(expression)
	if err != nil {
		return errors.New("invalid cron expression: " + err.Error())
	}
	return nil
}
