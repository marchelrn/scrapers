package models

// ScraperType represents a scraper implementation available to configurations.
type ScraperType struct {
	ID          int `json:"id" gorm:"column:id;primaryKey;autoIncrement"`
	Name        string `json:"name" gorm:"column:name;not null"`
	PythonFile  string `json:"python_file" gorm:"column:python_file;not null"`
	Description *string `json:"description,omitempty" gorm:"column:description"`
	IsActive    bool `json:"is_active" gorm:"column:is_active;default:true"`
	Parameters  []ParameterDefinition `json:"parameters,omitempty" gorm:"foreignKey:ScraperTypeID"`
}

func (ScraperType) TableName() string { return "scraper_types" }
