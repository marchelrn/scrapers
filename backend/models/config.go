package models

import "time"

const (
	ScrapingConfigStatusActive   = "active"
	ScrapingConfigStatusInactive = "inactive"
)

// ScrapingConfig represents the scraping_configs table.
type ScrapingConfig struct {
	ID              string    `json:"id" gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey"`
	Name            string    `json:"name" gorm:"column:name;not null"`
	Description     *string   `json:"description,omitempty" gorm:"column:description"`
	MethodCode      string    `json:"method_code" gorm:"column:method_code;not null;default:target_url"`
	CreatedBy       *string   `json:"created_by,omitempty" gorm:"column:created_by;type:uuid;index"`
	Status          string    `json:"status" gorm:"column:status;not null;default:active"`
	ScheduleEnabled bool      `json:"schedule_enabled" gorm:"column:schedule_enabled;default:false"`
	CreatedAt       time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`

	Creator    *User             `json:"creator,omitempty" gorm:"foreignKey:CreatedBy;constraint:OnDelete:SET NULL"`
	Schedules  []Schedule        `json:"schedules,omitempty" gorm:"foreignKey:ConfigID"`
	Parameters []ConfigParameter `json:"parameters,omitempty" gorm:"foreignKey:ConfigID"`
}

func (ScrapingConfig) TableName() string { return "scraping_configs" }
