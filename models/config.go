package models

import "time"

const (
	ScrapingConfigStatusActive   = "active"
	ScrapingConfigStatusInactive = "inactive"
)

// ScrapingConfig represents the scraping_configs table.
type ScrapingConfig struct {
	ID              string `json:"id" gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey"`
	Name            string `json:"name" gorm:"column:name;not null"`
	Description     *string `json:"description,omitempty" gorm:"column:description"`
	ScraperTypeID   int `json:"scraper_type_id" gorm:"column:scraper_type_id;not null;index"`
	CreatedBy       *int `json:"created_by,omitempty" gorm:"column:created_by;index"`
	Status          string `json:"status" gorm:"column:status;not null;default:active"`
	ScheduleEnabled bool `json:"schedule_enabled" gorm:"column:schedule_enabled;default:false"`
	CreatedAt       time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`

	ScraperType ScraperType       `json:"scraper_type,omitempty" gorm:"foreignKey:ScraperTypeID;constraint:OnDelete:RESTRICT"`
	Creator     *User             `json:"creator,omitempty" gorm:"foreignKey:CreatedBy;constraint:OnDelete:SET NULL"`
	Schedules   []Schedule        `json:"schedules,omitempty" gorm:"foreignKey:ConfigID"`
	Parameters  []ConfigParameter `json:"parameters,omitempty" gorm:"foreignKey:ConfigID"`
}

func (ScrapingConfig) TableName() string { return "scraping_configs" }
