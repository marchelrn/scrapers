package repository

type HealthRepository struct{}

func ImplHealthRepository() *HealthRepository {
	return &HealthRepository{}
}

func (r *HealthRepository) GetStatus() string {
	return "I am healthy"
}
