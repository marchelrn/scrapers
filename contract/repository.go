package contract

type HealthRepository interface {
	GetStatus() string
}
