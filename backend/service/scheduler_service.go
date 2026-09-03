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
			config, err := s.configRepo.GetByID(sch.ConfigID, "", models.UserRoleAdmin)
			if err == nil && config.Status == models.ScrapingConfigStatusActive {
				if !config.ScheduleEnabled {
					config.ScheduleEnabled = true
					_ = s.configRepo.Update(config)
				}
				s.registerJobInternal(sch)
			}
		}
	}

	s.cronRunner.Start()

	// Calculate and update next_run for all enabled schedules upon start
	for _, sch := range schedules {
		if sch.Enabled {
			entryID, exists := s.entryIDs[sch.ID]
			if exists {
				entry := s.cronRunner.Entry(entryID)
				loc, err := time.LoadLocation(sch.Timezone)
				if err != nil {
					loc = time.Local
				}
				nextRun := entry.Next
				if nextRun.IsZero() && entry.Schedule != nil {
					nextRun = entry.Schedule.Next(time.Now().In(loc))
				}
				if !nextRun.IsZero() {
					schModel, err := s.scheduleRepo.GetByID(sch.ID, "", models.UserRoleAdmin)
					if err == nil {
						schModel.NextRun = &nextRun
						_ = s.scheduleRepo.Update(schModel)
					}
				}
			}
		}
	}

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
		if err != nil || config.Status != models.ScrapingConfigStatusActive {
			log.Printf("Schedule %d skipped: config %s is missing or not active\n", sch.ID, sch.ConfigID)
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

		dispatched := false
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
				dispatched = true
			}
		}

		// Follow up in a separate goroutine so it doesn't block job creation
		// Also avoids potential deadlock if the helper needs a lock that cron runner holds during job execution
		if sch.RunOnce && dispatched {
			// One-shot schedule: retire it now that its job is queued. When the
			// dispatch was skipped or failed, it stays armed for the next match.
			go s.completeRunOnce(sch.ID)
		} else {
			go s.updateNextRunInternal(sch.ID)
		}
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

	sch, err := s.scheduleRepo.GetByID(scheduleID, "", models.UserRoleAdmin)
	if err != nil {
		return
	}

	if nextRun.IsZero() && entry.Schedule != nil {
		loc, err := time.LoadLocation(sch.Timezone)
		if err != nil {
			loc = time.Local
		}
		nextRun = entry.Schedule.Next(time.Now().In(loc))
	}

	if !nextRun.IsZero() {
		sch.NextRun = &nextRun
		_ = s.scheduleRepo.Update(sch)
	}
}

// completeRunOnce retires a one-shot schedule after its single execution.
func (s *ScheduleService) completeRunOnce(scheduleID int) {
	closed, configID := s.closeRunOnceInternal(scheduleID)
	if !closed {
		// Schedule is not (or no longer) one-shot: keep it armed as usual.
		s.updateNextRunInternal(scheduleID)
		return
	}

	log.Printf("Schedule %d executed once and is now disabled\n", scheduleID)
	s.syncConfigScheduleFlag(configID)
}

// closeRunOnceInternal unregisters a one-shot schedule from the cron runtime and
// marks the row as consumed. It reports whether the schedule was really closed.
func (s *ScheduleService) closeRunOnceInternal(scheduleID int) (bool, string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	sch, err := s.scheduleRepo.GetByID(scheduleID, "", models.UserRoleAdmin)
	if err != nil {
		return false, ""
	}

	// The stored row wins over the snapshot captured when the cron entry was
	// registered: the schedule may have been switched back to recurring since.
	if !sch.RunOnce {
		return false, sch.ConfigID
	}

	if entryID, exists := s.entryIDs[scheduleID]; exists {
		s.cronRunner.Remove(entryID)
		delete(s.entryIDs, scheduleID)
	}

	now := time.Now()
	sch.Enabled = false
	sch.NextRun = nil
	sch.LastRun = &now
	if err := s.scheduleRepo.Update(sch); err != nil {
		log.Printf("Failed to close one-shot schedule %d: %v\n", scheduleID, err)
		return false, sch.ConfigID
	}

	return true, sch.ConfigID
}

// syncConfigScheduleFlag clears config.ScheduleEnabled once a config has no
// enabled schedule left.
func (s *ScheduleService) syncConfigScheduleFlag(configID string) {
	if configID == "" {
		return
	}

	remaining, err := s.scheduleRepo.GetAll(&configID, "", models.UserRoleAdmin)
	hasActive := false
	if err == nil {
		for _, rem := range remaining {
			if rem.Enabled {
				hasActive = true
				break
			}
		}
	}
	if hasActive {
		return
	}

	config, err := s.configRepo.GetByID(configID, "", models.UserRoleAdmin)
	if err == nil && config.ScheduleEnabled {
		config.ScheduleEnabled = false
		_ = s.configRepo.Update(config)
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

	// Default: keep repeating on every cron match.
	runOnce := false
	if req.RunOnce != nil {
		runOnce = *req.RunOnce
	}

	schedule := &models.Schedule{
		ConfigID:       req.ConfigID,
		CronExpression: req.CronExpression,
		Timezone:       timezone,
		Enabled:        enabled,
		RunOnce:        runOnce,
	}

	if err := s.scheduleRepo.Create(schedule); err != nil {
		return nil, errors.New("failed to create schedule")
	}

	if schedule.Enabled && config.Status == models.ScrapingConfigStatusActive {
		if !config.ScheduleEnabled {
			config.ScheduleEnabled = true
			_ = s.configRepo.Update(config)
		}
	}

	s.mu.Lock()
	if schedule.Enabled && config.Status == models.ScrapingConfigStatusActive {
		s.registerJobInternal(*schedule)
	}
	s.mu.Unlock()

	// Update NextRun outside of lock to prevent deadlock
	if schedule.Enabled && config.Status == models.ScrapingConfigStatusActive {
		s.updateNextRunInternal(schedule.ID)
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
		if sch.Enabled && sch.NextRun == nil {
			s.mu.Lock()
			if entryID, exists := s.entryIDs[sch.ID]; exists {
				entry := s.cronRunner.Entry(entryID)
				if entry.Schedule != nil {
					loc, err := time.LoadLocation(sch.Timezone)
					if err != nil {
						loc = time.Local
					}
					nextRun := entry.Schedule.Next(time.Now().In(loc))
					sch.NextRun = &nextRun
					_ = s.scheduleRepo.Update(&sch)
				}
			}
			s.mu.Unlock()
		}
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

	if req.RunOnce != nil {
		schedule.RunOnce = *req.RunOnce
	}

	if req.Enabled != nil {
		// Re-enabling a consumed one-shot schedule arms it for the next matching
		// time, so the recorded run no longer describes its state.
		if *req.Enabled && !schedule.Enabled && schedule.RunOnce {
			schedule.LastRun = nil
		}
		schedule.Enabled = *req.Enabled
	}

	if err := s.scheduleRepo.Update(schedule); err != nil {
		return nil, errors.New("failed to update schedule")
	}

	config, _ := s.configRepo.GetByID(schedule.ConfigID, "", models.UserRoleAdmin)

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
	} else {
		if config != nil && config.Status == models.ScrapingConfigStatusActive {
			if !config.ScheduleEnabled {
				config.ScheduleEnabled = true
				_ = s.configRepo.Update(config)
			}
			s.registerJobInternal(*schedule)
		}
	}
	s.mu.Unlock()

	if schedule.Enabled && config != nil && config.Status == models.ScrapingConfigStatusActive {
		s.updateNextRunInternal(schedule.ID)
	}

	sch, _ := s.scheduleRepo.GetByID(schedule.ID, "", models.UserRoleAdmin)
	resp := dto.ToScheduleResponse(*sch)
	return &resp, nil
}

// Delete removes a schedule by ID.
func (s *ScheduleService) Delete(id int, userID string, userRole string) error {
	schedule, err := s.scheduleRepo.GetByID(id, userID, userRole)
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

	// Synchronize config.ScheduleEnabled if no more enabled schedules exist for this config
	s.syncConfigScheduleFlag(schedule.ConfigID)

	return nil
}

// validateCronExpression checks if a cron expression is valid using robfig/cron.
func (s *ScheduleService) validateCronExpression(expression string) error {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow | cron.Descriptor)
	_, err := parser.Parse(expression)
	if err != nil {
		return errors.New("invalid cron expression: " + err.Error())
	}
	return nil
}
