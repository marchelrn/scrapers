package service

import (
	"errors"

	"github.com/robfig/cron/v3"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

// ScheduleService handles schedule business logic.
type ScheduleService struct {
	scheduleRepo contract.ScheduleRepository
	configRepo   contract.ScrapingConfigRepository
}

func ImplScheduleService(scheduleRepo contract.ScheduleRepository, configRepo contract.ScrapingConfigRepository) contract.ScheduleService {
	return &ScheduleService{
		scheduleRepo: scheduleRepo,
		configRepo:   configRepo,
	}
}

// Create validates and creates a new schedule.
func (s *ScheduleService) Create(req dto.CreateScheduleRequest) (*dto.ScheduleResponse, error) {
	// Validate config exists
	_, err := s.configRepo.GetByID(req.ConfigID)
	if err != nil {
		return nil, errors.New("scraping config not found")
	}

	// Validate cron expression
	if err := s.validateCronExpression(req.CronExpression); err != nil {
		return nil, err
	}

	timezone := "Asia/Makassar"
	if req.Timezone != "" {
		timezone = req.Timezone
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	schedule := &models.Schedule{
		ConfigID:       req.ConfigID,
		CronExpression: req.CronExpression,
		Timezone:       timezone,
		Enabled:        enabled,
	}

	if err := s.scheduleRepo.Create(schedule); err != nil {
		return nil, errors.New("failed to create schedule")
	}

	resp := dto.ToScheduleResponse(*schedule)
	return &resp, nil
}

// GetAll retrieves all schedules, optionally filtered by config_id.
func (s *ScheduleService) GetAll(configID *string) ([]dto.ScheduleResponse, error) {
	schedules, err := s.scheduleRepo.GetAll(configID)
	if err != nil {
		return nil, errors.New("failed to get schedules")
	}

	responses := make([]dto.ScheduleResponse, 0, len(schedules))
	for _, sch := range schedules {
		responses = append(responses, dto.ToScheduleResponse(sch))
	}
	return responses, nil
}

// GetByID retrieves a schedule by ID.
func (s *ScheduleService) GetByID(id int) (*dto.ScheduleResponse, error) {
	schedule, err := s.scheduleRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("schedule not found")
	}
	resp := dto.ToScheduleResponse(*schedule)
	return &resp, nil
}

// Update validates and updates a schedule.
func (s *ScheduleService) Update(id int, req dto.UpdateScheduleRequest) (*dto.ScheduleResponse, error) {
	schedule, err := s.scheduleRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("schedule not found")
	}

	if req.CronExpression != nil {
		if err := s.validateCronExpression(*req.CronExpression); err != nil {
			return nil, err
		}
		schedule.CronExpression = *req.CronExpression
	}

	if req.Timezone != nil {
		schedule.Timezone = *req.Timezone
	}

	if req.Enabled != nil {
		schedule.Enabled = *req.Enabled
	}

	if err := s.scheduleRepo.Update(schedule); err != nil {
		return nil, errors.New("failed to update schedule")
	}

	resp := dto.ToScheduleResponse(*schedule)
	return &resp, nil
}

// Delete removes a schedule by ID.
func (s *ScheduleService) Delete(id int) error {
	_, err := s.scheduleRepo.GetByID(id)
	if err != nil {
		return errors.New("schedule not found")
	}
	if err := s.scheduleRepo.Delete(id); err != nil {
		return errors.New("failed to delete schedule")
	}
	return nil
}

// validateCronExpression checks if a cron expression is valid using robfig/cron.
func (s *ScheduleService) validateCronExpression(expression string) error {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	_, err := parser.Parse(expression)
	if err != nil {
		return errors.New("invalid cron expression: " + err.Error())
	}
	return nil
}
