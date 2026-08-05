package methods

import (
	"testing"

	"github.com/marchelrn/scrapers/pkg/registry"
)

func TestTargetURLMethod_Validate(t *testing.T) {
	method := NewTargetURLMethod()

	tests := []struct {
		name        string
		params      map[string]interface{}
		expectError bool
	}{
		{
			name:        "missing url",
			params:      map[string]interface{}{"technique": "css", "selector": "h1"},
			expectError: true,
		},
		{
			name:        "missing technique",
			params:      map[string]interface{}{"url": "http://example.com"},
			expectError: true,
		},
		{
			name:        "css missing selector",
			params:      map[string]interface{}{"url": "http://example.com", "technique": "css"},
			expectError: true,
		},
		{
			name:        "css valid",
			params:      map[string]interface{}{"url": "http://example.com", "technique": "css", "selector": "h1"},
			expectError: false,
		},
		{
			name:        "xpath valid",
			params:      map[string]interface{}{"url": "http://example.com", "technique": "xpath", "xpath": "//h1"},
			expectError: false,
		},
		{
			name:        "api valid",
			params:      map[string]interface{}{"url": "http://api.example.com", "technique": "api"},
			expectError: false,
		},
		{
			name:        "keyword missing keyword",
			params:      map[string]interface{}{"url": "http://example.com", "technique": "keyword_find"},
			expectError: true,
		},
		{
			name:        "keyword valid",
			params:      map[string]interface{}{"url": "http://example.com", "technique": "keyword_find", "keyword": "Inflasi"},
			expectError: false,
		},
		{
			name:        "unknown technique",
			params:      map[string]interface{}{"url": "http://example.com", "technique": "invalid_tech"},
			expectError: true,
		},
		{
			name:        "ssrf localhost blocked",
			params:      map[string]interface{}{"url": "http://localhost:8080/admin", "technique": "css", "selector": "h1"},
			expectError: true,
		},
		{
			name:        "ssrf loopback blocked",
			params:      map[string]interface{}{"url": "http://127.0.0.1/secret", "technique": "api"},
			expectError: true,
		},
		{
			name:        "ssrf private 10.x blocked",
			params:      map[string]interface{}{"url": "http://10.0.0.1/internal", "technique": "css", "selector": "h1"},
			expectError: true,
		},
		{
			name:        "ssrf metadata blocked",
			params:      map[string]interface{}{"url": "http://169.254.169.254/latest", "technique": "api"},
			expectError: true,
		},
		{
			name:        "auth missing secret",
			params:      map[string]interface{}{"url": "http://api.example.com", "technique": "api", "auth_type": "api_key"},
			expectError: true,
		},
		{
			name:        "auth valid secret",
			params:      map[string]interface{}{"url": "http://api.example.com", "technique": "api", "auth_type": "api_key", "secret_reference": "sec-123"},
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := method.Validate(tt.params)
			if tt.expectError && err == nil {
				t.Errorf("expected error, got nil")
			}
			if !tt.expectError && err != nil {
				t.Errorf("expected no error, got %v", err)
			}
		})
	}
}

func TestTargetURLMethod_Registry(t *testing.T) {
	reg := registry.NewRegistry()
	method := NewTargetURLMethod()

	if err := reg.Register(method); err != nil {
		t.Fatalf("failed to register method: %v", err)
	}

	if m, err := reg.GetMethod("target_url"); err != nil || m.Code() != "target_url" {
		t.Fatalf("failed to retrieve method from registry")
	}

	if len(reg.GetAllMethods()) != 1 {
		t.Fatalf("expected 1 method, got %d", len(reg.GetAllMethods()))
	}
}
