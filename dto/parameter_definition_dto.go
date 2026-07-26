package dto

// CreateParameterDefinitionRequest creates one input definition for a scraper type.
type CreateParameterDefinitionRequest struct {
	ParameterName string  `json:"parameter_name" binding:"required,max=255"`
	Label         string  `json:"label" binding:"required,max=255"`
	DataType      string  `json:"data_type" binding:"omitempty,oneof=text json number date"`
	Required      *bool   `json:"required"`
	DefaultValue  *string `json:"default_value"`
	Placeholder   *string `json:"placeholder" binding:"omitempty,max=255"`
}

// UpdateParameterDefinitionRequest updates a parameter definition. Nil fields are not changed.
type UpdateParameterDefinitionRequest struct {
	ParameterName *string `json:"parameter_name" binding:"omitempty,max=255"`
	Label         *string `json:"label" binding:"omitempty,max=255"`
	DataType      *string `json:"data_type" binding:"omitempty,oneof=text json number date"`
	Required      *bool   `json:"required"`
	DefaultValue  *string `json:"default_value"`
	Placeholder   *string `json:"placeholder" binding:"omitempty,max=255"`
}

// ParameterDefinitionResponse is returned with scraper type metadata.
type ParameterDefinitionResponse struct {
	ID            int     `json:"id"`
	ScraperTypeID int     `json:"scraper_type_id"`
	ParameterName string  `json:"parameter_name"`
	Label         string  `json:"label"`
	DataType      string  `json:"data_type"`
	Required      bool    `json:"required"`
	DefaultValue  *string `json:"default_value,omitempty"`
	Placeholder   *string `json:"placeholder,omitempty"`
}
