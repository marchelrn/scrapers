package models

import "time"

// User represents a system user (administrator or operator)
type User struct {
	ID        int       `json:"id" gorm:"primaryKey;autoIncrement"`
	Name      string    `json:"name" gorm:\"column:name\"`
	Email     string    `json:"email" gorm:\"column:email\"`
	Password  string    `json:"-" gorm:\"column:password\"` // Never expose password in JSON
	Role      string    `json:"role" gorm:\"column:role\"`
	CreatedAt time.Time `json:"created_at" gorm:\"column:created_at\"`
	UpdatedAt time.Time `json:"updated_at" gorm:\"column:updated_at\"`
}
