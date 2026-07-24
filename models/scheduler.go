package models

import "time"

// Scheduler represents a cron-based schedule for a scraping config
type Scheduler struct {
	ID             int       `json:"id" gorm:"primaryKey;autoIncrement"`
	ConfigID       int       `json:"config_id" gorm:\"column:config_id\"`
	CronExpression string    `json:"cron_expression" gorm:\"column:cron_expression\"`
	Timezone       string    `json:"timezone" gorm:\"column:timezone\"`
	Enabled        bool      `json:"enabled" gorm:\"column:enabled\"`
	CreatedAt      time.Time `json:"created_at" gorm:\"column:created_at\"`
	UpdatedAt      time.Time `json:"updated_at" gorm:\"column:updated_at\"`
}
