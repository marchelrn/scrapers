package contract

type Repository struct {
	Health HealthRepository
}

type HealthRepository interface {
	GetStatus() string
}
