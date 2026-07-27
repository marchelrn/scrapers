package models

import "time"

const (
	UserRoleAdmin    = "admin"
	UserRoleOperator = "operator"
)

// User represents the users table.
type User struct {
	ID        int       `json:"id" gorm:"column:id;primaryKey;autoIncrement"`
	Name      string    `json:"name" gorm:"column:name;not null"`
	Email     string    `json:"email" gorm:"column:email;not null;uniqueIndex"`
	Password  string    `json:"-" gorm:"column:password;not null"`
	Role      string    `json:"role" gorm:"column:role;not null;default:operator"`
	CreatedAt time.Time `json:"created_at" gorm:"column:created_at;autoCreateTime"`
}

func (User) TableName() string { return "users" }
