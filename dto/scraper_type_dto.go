package dto

// CreateScraperTypeRequest creates a scraper implementation definition.
type CreateScraperTypeRequest struct {
	Name        string  `json:"name" binding:"required,max=255"`
	PythonFile  string  `json:"python_file" binding:"required,max=255"`
	Description *string `json:"description"`
	IsActive    *bool   `json:"is_active"`
}

// UpdateScraperTypeRequest updates a scraper type. Nil fields are not changed.
type UpdateScraperTypeRequest struct {
	Name        *string `json:"name" binding:"omitempty,max=255"`
	PythonFile  *string `json:"python_file" binding:"omitempty,max=255"`
	Description *string `json:"description"`
	IsActive    *bool   `json:"is_active"`
}

// ScraperTypeResponse is the public scraper type representation.
type ScraperTypeResponse struct {
	ID          int     `json:"id"`
	Name        string  `json:"name"`
	PythonFile  string  `json:"python_file"`
	Description *string `json:"description,omitempty"`
	IsActive    bool    `json:"is_active"`
}
