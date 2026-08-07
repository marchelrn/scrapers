package dto

import "time"

type CreateSecretRequest struct {
	Name        string  `json:"name" binding:"required,max=255"`
	Description *string `json:"description"`
	SecretType  string  `json:"secret_type" binding:"required,oneof=api_key bearer_token basic_auth cookie"`
	SecretValue string  `json:"secret_value" binding:"required"`
}

type UpdateSecretRequest struct {
	Name        *string `json:"name" binding:"omitempty,max=255"`
	Description *string `json:"description"`
	SecretType  *string `json:"secret_type" binding:"omitempty,oneof=api_key bearer_token basic_auth cookie"`
	SecretValue *string `json:"secret_value"`
}

type SecretResponse struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	SecretType  string    `json:"secret_type"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
