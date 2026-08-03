package dto

import "github.com/marchelrn/scrapers/models"

// ToUserResponse converts a user entity to a public response.
func ToUserResponse(user models.User) UserResponse {
	return UserResponse{
		ID:        user.ID,
		Name:      user.Name,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
	}
}

// ToConfigParameterResponse converts a parameter to response.
func ToConfigParameterResponse(parameter models.ConfigParameter) ConfigParameterResponse {
	return ConfigParameterResponse{
		ID:             parameter.ID,
		ParameterName:  parameter.ParameterName,
		ParameterValue: parameter.ParameterValue,
	}
}

func ToScrapingConfigResponse(config models.ScrapingConfig) ScrapingConfigResponse {
	response := ScrapingConfigResponse{
		ID:              config.ID,
		Name:            config.Name,
		Description:     config.Description,
		MethodCode:      config.MethodCode,
		CreatedBy:       config.CreatedBy,
		Status:          config.Status,
		ScheduleEnabled: config.ScheduleEnabled,
		CreatedAt:       config.CreatedAt,
	}

	if len(config.Parameters) > 0 {
		response.Parameters = make([]ConfigParameterResponse, 0, len(config.Parameters))
		for _, parameter := range config.Parameters {
			response.Parameters = append(response.Parameters, ToConfigParameterResponse(parameter))
		}
	}

	return response
}

func ToScheduleResponse(schedule models.Schedule) ScheduleResponse {
	return ScheduleResponse{
		ID:             schedule.ID,
		ConfigID:       schedule.ConfigID,
		CronExpression: schedule.CronExpression,
		Timezone:       schedule.Timezone,
		Enabled:        schedule.Enabled,
		NextRun:        schedule.NextRun,
	}
}

func ToScrapingLogResponse(log models.ScrapingLog) ScrapingLogResponse {
	return ScrapingLogResponse{
		ID:        log.ID,
		JobID:     log.JobID,
		Level:     log.Level,
		Message:   log.Message,
		CreatedAt: log.CreatedAt,
	}
}

func ToScrapingResultResponse(result models.ScrapingResult) ScrapingResultResponse {
	return ScrapingResultResponse{
		ID:         result.ID,
		JobID:      result.JobID,
		ResultJSON: result.ResultJSON,
		CreatedAt:  result.CreatedAt,
	}
}

func ToScrapingJobResponse(job models.ScrapingJob) ScrapingJobResponse {
	response := ScrapingJobResponse{
		ID:         job.ID,
		ConfigID:   job.ConfigID,
		Status:     job.Status,
		StartedAt:  job.StartedAt,
		FinishedAt: job.FinishedAt,
		WorkerName: job.WorkerName,
	}

	if len(job.Logs) > 0 {
		response.Logs = make([]ScrapingLogResponse, 0, len(job.Logs))
		for _, log := range job.Logs {
			response.Logs = append(response.Logs, ToScrapingLogResponse(log))
		}
	}

	if len(job.Results) > 0 {
		response.Results = make([]ScrapingResultResponse, 0, len(job.Results))
		for _, result := range job.Results {
			response.Results = append(response.Results, ToScrapingResultResponse(result))
		}
	}

	return response
}
