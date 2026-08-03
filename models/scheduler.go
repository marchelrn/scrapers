package models

import "time"

// Schedule represents the schedules table.
type Schedule struct {
	ID             int        `json:"id" gorm:"column:id;primaryKey;autoIncrement"`
	ConfigID       string     `json:"config_id" gorm:"column:config_id;type:uuid;not null;index"`
	CronExpression string     `json:"cron_expression" gorm:"column:cron_expression;not null"`
	Timezone       string     `json:"timezone" gorm:"column:timezone;default:Asia/Makassar"`
	Enabled        bool       `json:"enabled" gorm:"column:enabled;default:true"`
	NextRun        *time.Time `json:"next_run,omitempty" gorm:"column:next_run"`

	Config ScrapingConfig `json:"config,omitempty" gorm:"foreignKey:ConfigID;constraint:OnDelete:CASCADE"`
}

func (Schedule) TableName() string { return "schedules" }
