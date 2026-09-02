package service

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

const testConfigID = "11111111-1111-4111-8111-111111111111"

// ── Fakes ────────────────────────────────────────────────────────────────────

// fakeScheduleRepo mimics a database: reads hand out copies, so a caller that
// mutates a returned row does not silently change stored state.
type fakeScheduleRepo struct {
	mu     sync.Mutex
	rows   map[int]models.Schedule
	nextID int
}

func newFakeScheduleRepo() *fakeScheduleRepo {
	return &fakeScheduleRepo{rows: make(map[int]models.Schedule), nextID: 1}
}

func (r *fakeScheduleRepo) Create(schedule *models.Schedule) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	schedule.ID = r.nextID
	r.nextID++
	r.rows[schedule.ID] = *schedule
	return nil
}

func (r *fakeScheduleRepo) GetAll(configID *string, _ string, _ string) ([]models.Schedule, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]models.Schedule, 0, len(r.rows))
	for _, row := range r.rows {
		if configID != nil && row.ConfigID != *configID {
			continue
		}
		out = append(out, row)
	}
	return out, nil
}

func (r *fakeScheduleRepo) GetByID(id int, _ string, _ string) (*models.Schedule, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	row, ok := r.rows[id]
	if !ok {
		return nil, errors.New("schedule not found")
	}
	copied := row
	return &copied, nil
}

func (r *fakeScheduleRepo) Update(schedule *models.Schedule) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.rows[schedule.ID]; !ok {
		return errors.New("schedule not found")
	}
	r.rows[schedule.ID] = *schedule
	return nil
}

func (r *fakeScheduleRepo) Delete(id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.rows, id)
	return nil
}

func (r *fakeScheduleRepo) row(t *testing.T, id int) models.Schedule {
	t.Helper()
	r.mu.Lock()
	defer r.mu.Unlock()
	row, ok := r.rows[id]
	if !ok {
		t.Fatalf("schedule %d is missing from the repository", id)
	}
	return row
}

type fakeConfigRepo struct {
	mu   sync.Mutex
	rows map[string]models.ScrapingConfig
}

func newFakeConfigRepo() *fakeConfigRepo {
	return &fakeConfigRepo{rows: make(map[string]models.ScrapingConfig)}
}

func (r *fakeConfigRepo) Create(config *models.ScrapingConfig) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rows[config.ID] = *config
	return nil
}

func (r *fakeConfigRepo) CreateWithParams(config *models.ScrapingConfig, _ []models.ConfigParameter) error {
	return r.Create(config)
}

func (r *fakeConfigRepo) GetAll(_ string, _ string) ([]models.ScrapingConfig, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]models.ScrapingConfig, 0, len(r.rows))
	for _, row := range r.rows {
		out = append(out, row)
	}
	return out, nil
}

func (r *fakeConfigRepo) GetByID(id string, _ string, _ string) (*models.ScrapingConfig, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	row, ok := r.rows[id]
	if !ok {
		return nil, errors.New("config not found")
	}
	copied := row
	return &copied, nil
}

func (r *fakeConfigRepo) Update(config *models.ScrapingConfig) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.rows[config.ID] = *config
	return nil
}

func (r *fakeConfigRepo) Delete(id string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.rows, id)
	return nil
}

func (r *fakeConfigRepo) scheduleEnabled(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.rows[id].ScheduleEnabled
}

// fakeJobService records dispatches and can be told to fail, so we can check
// that a one-shot schedule is only retired after a job really got queued.
type fakeJobService struct {
	mu         sync.Mutex
	dispatched int
	createErr  error
	active     []dto.ScrapingJobResponse
}

func (j *fakeJobService) RecoverStuckJobs() error { return nil }

func (j *fakeJobService) Create(req dto.CreateScrapingJobRequest, _ string, _ string) (*dto.ScrapingJobResponse, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.createErr != nil {
		return nil, j.createErr
	}
	j.dispatched++
	return &dto.ScrapingJobResponse{ConfigID: req.ConfigID, Status: models.JobStatusPending}, nil
}

func (j *fakeJobService) RunShortcut(_ string, _ dto.RunConfigShortcutRequest, _ string, _ string) (*dto.ScrapingJobResponse, error) {
	return nil, errors.New("not used in tests")
}

func (j *fakeJobService) GetAll(_ *string, _ string, _ string, _ int, _ int) ([]dto.ScrapingJobResponse, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	out := make([]dto.ScrapingJobResponse, len(j.active))
	copy(out, j.active)
	return out, nil
}

func (j *fakeJobService) GetByID(_ string, _ string, _ string) (*dto.ScrapingJobResponse, error) {
	return nil, errors.New("not used in tests")
}

func (j *fakeJobService) UpdateStatus(_ string, _ dto.UpdateScrapingJobRequest) (*dto.ScrapingJobResponse, error) {
	return nil, errors.New("not used in tests")
}

func (j *fakeJobService) AddLog(_ string, _ dto.CreateScrapingLogRequest) (*dto.ScrapingLogResponse, error) {
	return nil, errors.New("not used in tests")
}

func (j *fakeJobService) AddResult(_ string, _ dto.CreateScrapingResultRequest) (*dto.ScrapingResultResponse, error) {
	return nil, errors.New("not used in tests")
}

func (j *fakeJobService) dispatchCount() int {
	j.mu.Lock()
	defer j.mu.Unlock()
	return j.dispatched
}

func (j *fakeJobService) setCreateErr(err error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.createErr = err
}

func (j *fakeJobService) setActive(jobs []dto.ScrapingJobResponse) {
	j.mu.Lock()
	defer j.mu.Unlock()
	j.active = jobs
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func newTestScheduleService(t *testing.T) (*ScheduleService, *fakeScheduleRepo, *fakeConfigRepo, *fakeJobService) {
	t.Helper()

	scheduleRepo := newFakeScheduleRepo()
	configRepo := newFakeConfigRepo()
	configRepo.rows[testConfigID] = models.ScrapingConfig{
		ID:     testConfigID,
		Status: models.ScrapingConfigStatusActive,
	}
	jobSvc := &fakeJobService{}

	svc, ok := ImplScheduleService(scheduleRepo, configRepo, jobSvc).(*ScheduleService)
	if !ok {
		t.Fatal("ImplScheduleService did not return *ScheduleService")
	}
	return svc, scheduleRepo, configRepo, jobSvc
}

func boolPtr(b bool) *bool { return &b }

// isRegistered reports whether the schedule still owns a cron entry.
func isRegistered(svc *ScheduleService, scheduleID int) bool {
	svc.mu.Lock()
	defer svc.mu.Unlock()
	_, exists := svc.entryIDs[scheduleID]
	return exists
}

// fireSchedule runs the registered cron job body synchronously, the same way
// the cron runtime would when the expression matches.
func fireSchedule(t *testing.T, svc *ScheduleService, scheduleID int) {
	t.Helper()

	svc.mu.Lock()
	entryID, exists := svc.entryIDs[scheduleID]
	svc.mu.Unlock()
	if !exists {
		t.Fatalf("schedule %d has no cron entry registered", scheduleID)
	}

	entry := svc.cronRunner.Entry(entryID)
	if entry.Job == nil {
		t.Fatalf("cron entry for schedule %d has no job", scheduleID)
	}
	entry.Job.Run()
}

// waitFor polls until cond holds, because the job body finishes its bookkeeping
// in a separate goroutine.
func waitFor(t *testing.T, what string, cond func() bool) {
	t.Helper()

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("timed out waiting for %s", what)
}

func createSchedule(t *testing.T, svc *ScheduleService, runOnce bool) *dto.ScheduleResponse {
	t.Helper()

	req := dto.CreateScheduleRequest{
		ConfigID:       testConfigID,
		CronExpression: "0 8 * * *",
		Timezone:       "Asia/Makassar",
		RunOnce:        boolPtr(runOnce),
	}
	resp, err := svc.Create(req, "", models.UserRoleAdmin)
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}
	return resp
}

// ── Tests ────────────────────────────────────────────────────────────────────

func TestCreateDefaultsToRecurring(t *testing.T) {
	svc, repo, _, _ := newTestScheduleService(t)

	resp, err := svc.Create(dto.CreateScheduleRequest{
		ConfigID:       testConfigID,
		CronExpression: "0 8 * * *",
	}, "", models.UserRoleAdmin)
	if err != nil {
		t.Fatalf("Create returned error: %v", err)
	}

	if resp.RunOnce {
		t.Error("a schedule created without run_once should repeat, got run_once=true")
	}
	if row := repo.row(t, resp.ID); row.RunOnce {
		t.Error("stored row should have run_once=false")
	}
}

func TestCreateOneShotIsArmed(t *testing.T) {
	svc, repo, configRepo, _ := newTestScheduleService(t)

	resp := createSchedule(t, svc, true)

	if !resp.RunOnce {
		t.Error("expected run_once=true in the response")
	}
	if !resp.Enabled {
		t.Error("a freshly created one-shot schedule should be enabled")
	}
	if resp.NextRun == nil {
		t.Error("expected next_run to be computed for an armed schedule")
	}
	if resp.LastRun != nil {
		t.Error("a schedule that never fired should have no last_run")
	}
	if !isRegistered(svc, resp.ID) {
		t.Error("expected the schedule to own a cron entry")
	}
	if !configRepo.scheduleEnabled(testConfigID) {
		t.Error("expected config.schedule_enabled to be turned on")
	}
	if row := repo.row(t, resp.ID); !row.RunOnce || !row.Enabled {
		t.Errorf("stored row mismatch: run_once=%v enabled=%v", row.RunOnce, row.Enabled)
	}
}

func TestOneShotRetiresAfterDispatch(t *testing.T) {
	svc, repo, configRepo, jobSvc := newTestScheduleService(t)
	sch := createSchedule(t, svc, true)

	fireSchedule(t, svc, sch.ID)

	waitFor(t, "the one-shot schedule to be retired", func() bool {
		return !repo.row(t, sch.ID).Enabled
	})

	if got := jobSvc.dispatchCount(); got != 1 {
		t.Errorf("expected exactly 1 dispatched job, got %d", got)
	}

	row := repo.row(t, sch.ID)
	if row.Enabled {
		t.Error("a consumed one-shot schedule should be disabled")
	}
	if !row.RunOnce {
		t.Error("run_once should stay true so the UI can explain why it stopped")
	}
	if row.NextRun != nil {
		t.Errorf("expected next_run to be cleared, got %v", row.NextRun)
	}
	if row.LastRun == nil {
		t.Error("expected last_run to record the single execution")
	}
	if isRegistered(svc, sch.ID) {
		t.Error("expected the cron entry to be removed")
	}
	waitFor(t, "config.schedule_enabled to be cleared", func() bool {
		return !configRepo.scheduleEnabled(testConfigID)
	})
}

func TestRecurringScheduleStaysArmedAfterDispatch(t *testing.T) {
	svc, repo, _, jobSvc := newTestScheduleService(t)
	sch := createSchedule(t, svc, false)

	// Clearing next_run first proves the value below was recomputed by this run.
	repo.mutate(t, sch.ID, func(s *models.Schedule) { s.NextRun = nil })

	fireSchedule(t, svc, sch.ID)

	waitFor(t, "next_run to be recalculated", func() bool {
		return repo.row(t, sch.ID).NextRun != nil
	})

	if got := jobSvc.dispatchCount(); got != 1 {
		t.Errorf("expected exactly 1 dispatched job, got %d", got)
	}

	row := repo.row(t, sch.ID)
	if !row.Enabled {
		t.Error("a recurring schedule must stay enabled after firing")
	}
	if row.LastRun != nil {
		t.Error("last_run only describes one-shot schedules")
	}
	if row.NextRun == nil {
		t.Error("expected next_run to be refreshed for the next match")
	}
	if !isRegistered(svc, sch.ID) {
		t.Error("expected the cron entry to stay registered")
	}
}

// mutate edits a stored row directly, standing in for a change made elsewhere
// that the already-registered cron closure never saw.
func (r *fakeScheduleRepo) mutate(t *testing.T, id int, fn func(*models.Schedule)) {
	t.Helper()
	r.mu.Lock()
	defer r.mu.Unlock()
	row, ok := r.rows[id]
	if !ok {
		t.Fatalf("schedule %d is missing from the repository", id)
	}
	fn(&row)
	r.rows[id] = row
}

func TestOneShotStaysArmedWhenDispatchFails(t *testing.T) {
	svc, repo, _, jobSvc := newTestScheduleService(t)
	sch := createSchedule(t, svc, true)
	jobSvc.setCreateErr(errors.New("worker queue unavailable"))

	// Clearing next_run gives the recurring bookkeeping something observable to
	// restore, so we can tell the follow-up goroutine has finished.
	repo.mutate(t, sch.ID, func(s *models.Schedule) { s.NextRun = nil })

	fireSchedule(t, svc, sch.ID)

	waitFor(t, "next_run to be recalculated", func() bool {
		return repo.row(t, sch.ID).NextRun != nil
	})

	if got := jobSvc.dispatchCount(); got != 0 {
		t.Errorf("expected no successful dispatch, got %d", got)
	}

	row := repo.row(t, sch.ID)
	if !row.Enabled {
		t.Error("a one-shot schedule whose dispatch failed must stay armed")
	}
	if row.LastRun != nil {
		t.Error("last_run must not be set when nothing was queued")
	}
	if !isRegistered(svc, sch.ID) {
		t.Error("expected the cron entry to stay registered")
	}
}

func TestOneShotStaysArmedWhenJobAlreadyRunning(t *testing.T) {
	svc, repo, _, jobSvc := newTestScheduleService(t)
	sch := createSchedule(t, svc, true)
	jobSvc.setActive([]dto.ScrapingJobResponse{{ConfigID: testConfigID, Status: models.JobStatusRunning}})

	repo.mutate(t, sch.ID, func(s *models.Schedule) { s.NextRun = nil })

	fireSchedule(t, svc, sch.ID)

	waitFor(t, "next_run to be recalculated", func() bool {
		return repo.row(t, sch.ID).NextRun != nil
	})

	if got := jobSvc.dispatchCount(); got != 0 {
		t.Errorf("expected the duplicate dispatch to be skipped, got %d", got)
	}
	if row := repo.row(t, sch.ID); !row.Enabled || row.LastRun != nil {
		t.Errorf("skipped run should leave the schedule armed: enabled=%v last_run=%v", row.Enabled, row.LastRun)
	}
	if !isRegistered(svc, sch.ID) {
		t.Error("expected the cron entry to stay registered")
	}
}

func TestCompleteRunOnceRespectsStoredRunOnceFlag(t *testing.T) {
	svc, repo, _, _ := newTestScheduleService(t)
	sch := createSchedule(t, svc, true)

	// The schedule was switched back to recurring after the cron entry was
	// registered, so the stored row must win over the captured snapshot.
	repo.mutate(t, sch.ID, func(s *models.Schedule) {
		s.RunOnce = false
		s.NextRun = nil
	})

	svc.completeRunOnce(sch.ID)

	row := repo.row(t, sch.ID)
	if !row.Enabled {
		t.Error("a schedule that is no longer one-shot must not be retired")
	}
	if row.LastRun != nil {
		t.Error("expected last_run to stay empty")
	}
	if row.NextRun == nil {
		t.Error("expected next_run to be recalculated instead")
	}
	if !isRegistered(svc, sch.ID) {
		t.Error("expected the cron entry to stay registered")
	}
}

func TestUpdateReenablesConsumedOneShot(t *testing.T) {
	svc, repo, configRepo, _ := newTestScheduleService(t)
	sch := createSchedule(t, svc, true)

	fireSchedule(t, svc, sch.ID)
	waitFor(t, "the one-shot schedule to be retired", func() bool {
		return !repo.row(t, sch.ID).Enabled
	})

	resp, err := svc.Update(sch.ID, dto.UpdateScheduleRequest{Enabled: boolPtr(true)}, "", models.UserRoleAdmin)
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}

	if !resp.Enabled {
		t.Error("expected the schedule to be enabled again")
	}
	if !resp.RunOnce {
		t.Error("re-enabling should keep it a one-shot schedule")
	}
	if resp.LastRun != nil {
		t.Errorf("last_run should be cleared when a spent one-shot is re-armed, got %v", resp.LastRun)
	}
	if resp.NextRun == nil {
		t.Error("expected next_run to be computed for the re-armed schedule")
	}
	if !isRegistered(svc, sch.ID) {
		t.Error("expected a fresh cron entry after re-enabling")
	}
	if !configRepo.scheduleEnabled(testConfigID) {
		t.Error("expected config.schedule_enabled to be turned back on")
	}
}

func TestUpdateSwitchingToRecurringKeepsScheduleRunning(t *testing.T) {
	svc, repo, _, jobSvc := newTestScheduleService(t)
	sch := createSchedule(t, svc, true)

	if _, err := svc.Update(sch.ID, dto.UpdateScheduleRequest{RunOnce: boolPtr(false)}, "", models.UserRoleAdmin); err != nil {
		t.Fatalf("Update returned error: %v", err)
	}

	fireSchedule(t, svc, sch.ID)
	waitFor(t, "the job to be dispatched", func() bool {
		return jobSvc.dispatchCount() == 1
	})

	if row := repo.row(t, sch.ID); !row.Enabled || row.RunOnce {
		t.Errorf("expected a recurring, still enabled schedule: enabled=%v run_once=%v", row.Enabled, row.RunOnce)
	}
	if !isRegistered(svc, sch.ID) {
		t.Error("expected the cron entry to stay registered")
	}
}
