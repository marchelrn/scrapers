package models

import "time"

// Schedule represents the schedules table.
type Schedule struct {
	ID             int    `json:"id" gorm:"column:id;primaryKey;autoIncrement"`
	ConfigID       string `json:"config_id" gorm:"column:config_id;type:uuid;not null;index"`
	CronExpression string `json:"cron_expression" gorm:"column:cron_expression;not null"`
	Timezone       string `json:"timezone" gorm:"column:timezone;default:Asia/Makassar"`
	Enabled        bool   `json:"enabled" gorm:"column:enabled;default:true"`
	// RunOnce marks a one-shot schedule: it fires at the next matching time,
	// then disables itself instead of repeating.
	RunOnce bool       `json:"run_once" gorm:"column:run_once;not null;default:false"`
	NextRun *time.Time `json:"next_run,omitempty" gorm:"column:next_run"`
	// LastRun records when a one-shot schedule was consumed.
	LastRun *time.Time `json:"last_run,omitempty" gorm:"column:last_run"`

	Config ScrapingConfig `json:"config,omitempty" gorm:"foreignKey:ConfigID;constraint:OnDelete:CASCADE"`
}

func (Schedule) TableName() string { return "schedules" }
