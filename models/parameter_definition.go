package models

const (
	ParameterDataTypeText   = "text"
	ParameterDataTypeJSON   = "json"
	ParameterDataTypeNumber = "number"
	ParameterDataTypeDate   = "date"
)

// ParameterDefinition describes a parameter accepted by a scraper type.
type ParameterDefinition struct {
	ID            int `json:"id" gorm:"column:id;primaryKey;autoIncrement"`
	ScraperTypeID int `json:"scraper_type_id" gorm:"column:scraper_type_id;not null;index"`
	ParameterName string `json:"parameter_name" gorm:"column:parameter_name;not null"`
	Label         string `json:"label" gorm:"column:label;not null"`
	DataType      string `json:"data_type" gorm:"column:data_type;not null;default:text"`
	Required      bool `json:"required" gorm:"column:required;default:false"`
	DefaultValue  *string `json:"default_value,omitempty" gorm:"column:default_value"`
	Placeholder   *string `json:"placeholder,omitempty" gorm:"column:placeholder"`

	ScraperType ScraperType `json:"scraper_type,omitempty" gorm:"foreignKey:ScraperTypeID;constraint:OnDelete:CASCADE"`
}

func (ParameterDefinition) TableName() string { return "parameter_definitions" }
