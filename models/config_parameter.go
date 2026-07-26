package models

import "encoding/json"

// ConfigParameter stores a JSONB value for a scraping configuration parameter.
type ConfigParameter struct {
	ID             int `json:"id" gorm:"column:id;primaryKey;autoIncrement"`
	ConfigID       string `json:"config_id" gorm:"column:config_id;type:uuid;not null;index"`
	ParameterName  string `json:"parameter_name" gorm:"column:parameter_name;not null"`
	ParameterValue json.RawMessage `json:"parameter_value,omitempty" gorm:"column:parameter_value;type:jsonb"`

	Config ScrapingConfig `json:"config,omitempty" gorm:"foreignKey:ConfigID;constraint:OnDelete:CASCADE"`
}

func (ConfigParameter) TableName() string { return "config_parameters" }
