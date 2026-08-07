package methods

import (
	"testing"
)

func TestGoogleSearchMethod_Validate(t *testing.T) {
	method := NewGoogleSearchMethod()

	tests := []struct {
		name        string
		params      map[string]interface{}
		expectError bool
	}{
		{
			name: "valid params",
			params: map[string]interface{}{
				"query":     "Tanaman Pangan",
				"auth_type": "none",
			},
			expectError: false,
		},
		{
			name: "missing query",
			params: map[string]interface{}{
				"auth_type": "none",
			},
			expectError: true,
		},
		{
			name: "wrong auth type",
			params: map[string]interface{}{
				"query":     "Tanaman Pangan",
				"auth_type": "api_key",
			},
			expectError: true,
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
