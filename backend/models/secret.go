package models

import "time"

const (
	SecretTypeAPIKey      = "api_key"
	SecretTypeBearerToken = "bearer_token"
	SecretTypeBasicAuth   = "basic_auth"
	SecretTypeCookie      = "cookie"
)

// Secret represents a stored credential.
type Secret struct {
	ID          string    `json:"id" gorm:"column:id;type:uuid;default:gen_random_uuid();primaryKey"`
	Name        string    `json:"name" gorm:"column:name;not null"`
	Description *string   `json:"description,omitempty" gorm:"column:description"`
	SecretType  string    `json:"secret_type" gorm:"column:secret_type;not null"`
	SecretValue string    `json:"secret_value" gorm:"column:secret_value;not null"`
	CreatedBy   string    `json:"created_by" gorm:"column:created_by;type:uuid;index;not null"`
	CreatedAt   time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`
	UpdatedAt   time.Time `json:"updated_at" gorm:"column:updated_at;autoUpdateTime"`

	Creator *User `json:"creator,omitempty" gorm:"foreignKey:CreatedBy;constraint:OnDelete:CASCADE"`
}

func (Secret) TableName() string { return "secrets" }
