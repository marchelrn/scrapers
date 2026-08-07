package service

import (
	"errors"
	"log"
	"sync"
	"time"

	"github.com/robfig/cron/v3"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

// ScheduleService handles schedule business logic and runtime.
type ScheduleService struct {
	scheduleRepo contract.ScheduleRepository
	configRepo   contract.ScrapingConfigRepository
	jobSvc       contract.ScrapingJobService

	cronRunner *cron.Cron
	entryIDs   map[int]cron.EntryID
	mu         sync.Mutex
}

func ImplScheduleService(
	scheduleRepo contract.ScheduleRepository,
	configRepo contract.ScrapingConfigRepository,
	jobSvc contract.ScrapingJobService,
) contract.ScheduleService {
	// Enable timezone support and exact minute/hour parsing
	cronRunner := cron.New(cron.WithParser(cron.NewParser(
		cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor,
	)))

	return &ScheduleService{
		scheduleRepo: scheduleRepo,
		configRepo:   configRepo,
		jobSvc:       jobSvc,
		cronRunner:   cronRunner,
		entryIDs:     make(map[int]cron.EntryID),
	}
}

// StartScheduler loads all active schedules and starts the cron runtime.
func (s *ScheduleService) StartScheduler() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Load all schedules (as internal system, fetch all regardless of user)
	schedules, err := s.scheduleRepo.GetAll(nil, "", models.UserRoleAdmin)
	if err != nil {
		return errors.New("failed to load schedules for runtime")
	}

	for _, sch := range schedules {
		if sch.Enabled {
			s.registerJobInternal(sch)
		}
	}

	s.cronRunner.Start()
	log.Println("Scheduler runtime started")
	return nil
}

// StopScheduler stops the cron runtime.
func (s *ScheduleService) StopScheduler() {
	s.mu.Lock()
	defer s.mu.Unlock()

	ctx := s.cronRunner.Stop()
	<-ctx.Done()
	log.Println("Scheduler runtime stopped")
}

// registerJobInternal adds the schedule to the cron runner. Must hold mutex.
func (s *ScheduleService) registerJobInternal(sch models.Schedule) {
	// Remove if already exists
	if oldEntry, exists := s.entryIDs[sch.ID]; exists {
		s.cronRunner.Remove(oldEntry)
		delete(s.entryIDs, sch.ID)
	}

	loc, err := time.LoadLocation(sch.Timezone)
	if err != nil {
		loc = time.Local
	}

	// Create job closure
	jobFunc := func() {
		// Verify config is still active before running
		config, err := s.configRepo.GetByID(sch.ConfigID, "", models.UserRoleAdmin)
		if err != nil || config.Status != models.ScrapingConfigStatusActive || !config.ScheduleEnabled {
			log.Printf("Schedule %d skipped: config %s is not active/enabled\n", sch.ID, sch.ConfigID)
			return
		}

		// Prevent duplicate execution: Check if there's already a pending/running job for this config
		// We only fetch 10 active jobs to avoid large payload during checks
		activeJobs, _ := s.jobSvc.GetAll(&sch.ConfigID, "", models.UserRoleAdmin, 10, 0)
		hasActive := false
		for _, j := range activeJobs {
			if j.Status == models.JobStatusPending || j.Status == models.JobStatusRunning {
				hasActive = true
				break
			}
		}

		if hasActive {
			log.Printf("Schedule %d skipped: job for config %s is already pending/running\n", sch.ID, sch.ConfigID)
		} else {
			// Dispatch job creation with internal executor bypass
			req := dto.CreateScrapingJobRequest{ConfigID: sch.ConfigID}
			_, err = s.jobSvc.Create(req, "", models.UserRoleAdmin)
			if err != nil {
				log.Printf("Failed to dispatch scheduled job for schedule %d: %v\n", sch.ID, err)
			} else {
				log.Printf("Successfully dispatched job for schedule %d\n", sch.ID)
			}
		}

		// Calculate and update next_run
		s.updateNextRunInternal(sch.ID)
	}

	// Robfig cron supports "TZ=Asia/Makassar 0 * * * *" format
	cronExpr := "TZ=" + loc.String() + " " + sch.CronExpression

	entryID, err := s.cronRunner.AddFunc(cronExpr, jobFunc)
	if err != nil {
		log.Printf("Failed to register cron for schedule %d: %v\n", sch.ID, err)
		return
	}

	s.entryIDs[sch.ID] = entryID
	log.Printf("Registered schedule %d with cron expression %s\n", sch.ID, cronExpr)
}

func (s *ScheduleService) updateNextRunInternal(scheduleID int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	entryID, exists := s.entryIDs[scheduleID]
	if !exists {
		return
	}

	entry := s.cronRunner.Entry(entryID)
	nextRun := entry.Next

	// Update DB (using admin access)
	sch, err := s.scheduleRepo.GetByID(scheduleID, "", models.UserRoleAdmin)
	if err == nil {
		sch.NextRun = &nextRun
		_ = s.scheduleRepo.Update(sch)
	}
}

// Create validates and creates a new schedule.
func (s *ScheduleService) Create(req dto.CreateScheduleRequest, userID string, userRole string) (*dto.ScheduleResponse, error) {
	// Validate config exists and user owns it
	config, err := s.configRepo.GetByID(req.ConfigID, userID, userRole)
	if err != nil {
		return nil, errors.New("scraping config not found or unauthorized")
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

	s.mu.Lock()
	if schedule.Enabled && config.Status == models.ScrapingConfigStatusActive && config.ScheduleEnabled {
		s.registerJobInternal(*schedule)
		s.mu.Unlock()
		s.updateNextRunInternal(schedule.ID)
	} else {
		s.mu.Unlock()
	}

	// Fetch updated object for accurate NextRun
	sch, _ := s.scheduleRepo.GetByID(schedule.ID, "", models.UserRoleAdmin)
	resp := dto.ToScheduleResponse(*sch)
	return &resp, nil
}

// GetAll retrieves all schedules, optionally filtered by config_id.
func (s *ScheduleService) GetAll(configID *string, userID string, userRole string) ([]dto.ScheduleResponse, error) {
	schedules, err := s.scheduleRepo.GetAll(configID, userID, userRole)
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
func (s *ScheduleService) GetByID(id int, userID string, userRole string) (*dto.ScheduleResponse, error) {
	schedule, err := s.scheduleRepo.GetByID(id, userID, userRole)
	if err != nil {
		return nil, errors.New("schedule not found")
	}
	resp := dto.ToScheduleResponse(*schedule)
	return &resp, nil
}

// Update validates and updates a schedule.
func (s *ScheduleService) Update(id int, req dto.UpdateScheduleRequest, userID string, userRole string) (*dto.ScheduleResponse, error) {
	schedule, err := s.scheduleRepo.GetByID(id, userID, userRole)
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

	s.mu.Lock()
	if !schedule.Enabled {
		// Remove from cron if disabled
		if oldEntry, exists := s.entryIDs[schedule.ID]; exists {
			s.cronRunner.Remove(oldEntry)
			delete(s.entryIDs, schedule.ID)
		}
		// Reset next_run
		schedule.NextRun = nil
		_ = s.scheduleRepo.Update(schedule)
		s.mu.Unlock()
	} else {
		// Re-register if enabled
		s.registerJobInternal(*schedule)
		s.mu.Unlock()
		s.updateNextRunInternal(schedule.ID)
	}

	sch, _ := s.scheduleRepo.GetByID(schedule.ID, "", models.UserRoleAdmin)
	resp := dto.ToScheduleResponse(*sch)
	return &resp, nil
}

// Delete removes a schedule by ID.
func (s *ScheduleService) Delete(id int, userID string, userRole string) error {
	_, err := s.scheduleRepo.GetByID(id, userID, userRole)
	if err != nil {
		return errors.New("schedule not found")
	}

	s.mu.Lock()
	if entryID, exists := s.entryIDs[id]; exists {
		s.cronRunner.Remove(entryID)
		delete(s.entryIDs, id)
	}
	s.mu.Unlock()

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
