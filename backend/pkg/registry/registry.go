package registry

import (
	"context"
	"errors"

	"github.com/marchelrn/scrapers/dto"
)

// ScrapingMethod defines the contract for a business scraping method.
type ScrapingMethod interface {
	Code() string
	Name() string
	Description() string
	Version() string
	ParameterDefinitions() []ParameterDefinition
	AuthenticationCapabilities() []string

	// Validate checks if the provided configuration parameters are valid.
	Validate(params map[string]interface{}) error

	// Execute runs the scraping method. In MVP, this will call the Python worker.
	Execute(ctx context.Context, params map[string]interface{}) (*dto.WorkerResult, error)
}

// ParameterDefinition defines a parameter required by a scraping method.
type ParameterDefinition struct {
	Name        string
	Label       string
	Type        string // "text", "json", "number", "date", "boolean"
	Required    bool
	Default     interface{}
	Placeholder string
	Description string
}

// Registry manages available scraping methods.
type Registry interface {
	Register(method ScrapingMethod) error
	GetMethod(code string) (ScrapingMethod, error)
	GetAllMethods() []ScrapingMethod
}

type methodRegistry struct {
	methods map[string]ScrapingMethod
}

// NewRegistry creates a new in-memory method registry.
func NewRegistry() Registry {
	return &methodRegistry{
		methods: make(map[string]ScrapingMethod),
	}
}

func (r *methodRegistry) Register(method ScrapingMethod) error {
	if method == nil {
		return errors.New("method cannot be nil")
	}
	code := method.Code()
	// Simply overwrite if it exists for test idempotency
	r.methods[code] = method
	return nil
}

func (r *methodRegistry) GetMethod(code string) (ScrapingMethod, error) {
	method, exists := r.methods[code]
	if !exists {
		return nil, errors.New("method not found: " + code)
	}
	return method, nil
}

func (r *methodRegistry) GetAllMethods() []ScrapingMethod {
	methods := make([]ScrapingMethod, 0, len(r.methods))
	for _, m := range r.methods {
		methods = append(methods, m)
	}
	return methods
}

var defaultRegistry Registry

// Get returns the initialized global registry.
func Get() Registry {
	if defaultRegistry == nil {
		defaultRegistry = NewRegistry()
	}
	return defaultRegistry
}
