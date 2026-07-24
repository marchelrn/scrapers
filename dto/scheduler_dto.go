package dto

// CreateSchedulerRequest is the payload for creating a new scheduler
type CreateSchedulerRequest struct {
	ConfigID       int    `json:"config_id" binding:"required"`
	CronExpression string `json:"cron_expression" binding:"required"`
	Timezone       string `json:"timezone"`
	Enabled        *bool  `json:"enabled"`
}

// UpdateSchedulerRequest is the payload for updating a scheduler
type UpdateSchedulerRequest struct {
	ConfigID       int    `json:"config_id" binding:"required"`
	CronExpression string `json:"cron_expression" binding:"required"`
	Timezone       string `json:"timezone"`
	Enabled        *bool  `json:"enabled"`
}

// ResponseCreateSchedulerRequest is the response when user successfully create a Scheduler
type ResponseCreateSchedulerRequest struct {
	Code    int                    `json:"code"`
	Message string                 `json:"message"`
	Data    CreateSchedulerRequest `json:"create_data"`
}

// ResponseUpdateSchedulerRequest is the response when user Update a Scheduler
type ResponseUpdateSchedulerRequest struct {
	Code    int                    `json:"code"`
	Message string                 `json:"message"`
	Data    UpdateSchedulerRequest `json:"update_data"`
}
