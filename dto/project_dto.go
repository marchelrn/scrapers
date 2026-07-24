package dto

type ProjectData struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

// CreateProjectRequest is the payload for creating a new project
type CreateProjectRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

// UpdateProjectRequest is the payload for updating a project
type UpdateProjectRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

// ResponseCreateProjectRequest is the response when user successfully create a Project
type ResponseCreateProjectRequest struct {
	Code    int                  `json:"code"`
	Message string               `json:"message"`
	Data    CreateProjectRequest `json:"create_data"`
}

// ResponseUpdateProjectRequest is the response when user updating a Project
type ResponseUpdateProjectRequest struct {
	Code    int                  `json:"code"`
	Message string               `json:"message"`
	Data    UpdateProjectRequest `json:"updated_data"`
}

type ResponseGetAllProject struct {
	Code    int           `json:"code"`
	Message string        `json:"message"`
	Data    []ProjectData `json:"projects"`
}

type ResponseProject struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    ProjectData `json:"project"`
}
