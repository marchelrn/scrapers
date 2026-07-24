package dto

// CreateWebsiteRequest is the payload for creating a new website target
type CreateWebsiteRequest struct {
	ProjectID     int    `json:"project_id" binding:"required"`
	Name          string `json:"name" binding:"required"`
	BaseURL       string `json:"base_url" binding:"required,url"`
	LoginRequired bool   `json:"login_required"`
}

// UpdateWebsiteRequest is the payload for updating a website target
type UpdateWebsiteRequest struct {
	ProjectID     int    `json:"project_id" binding:"required"`
	Name          string `json:"name" binding:"required"`
	BaseURL       string `json:"base_url" binding:"required,url"`
	LoginRequired bool   `json:"login_required"`
}

// ResponseCreateWebsiteRequest is the response when user successfully create a website target
type ResponseCreateWebsiteRequest struct {
	Code    int                 `json:"code"`
	Message string              `json:"message"`
	Data    CreateConfigRequest `json:"create_data"`
}

// ResponseUpdateWebsiteRequest is the response when user update a website target
type ResponseUpdateWebsiteRequest struct {
	Code    int                 `json:"code"`
	Message string              `json:"message"`
	Data    UpdateConfigRequest `json:"updated_data"`
}
