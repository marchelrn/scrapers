package methods

import (
	"testing"
)

func TestGoogleNewsMethod_Validate(t *testing.T) {
	m := NewGoogleNewsMethod()

	tests := []struct {
		name    string
		params  map[string]interface{}
		wantErr bool
	}{
		{
			name: "valid query without dates",
			params: map[string]interface{}{
				"query": "pertanian",
			},
			wantErr: false,
		},
		{
			name: "missing query",
			params: map[string]interface{}{
				"start_date": "2026-01-01",
			},
			wantErr: true,
		},
		{
			name: "valid dates YYYY-MM-DD",
			params: map[string]interface{}{
				"query":      "pertanian",
				"start_date": "2026-01-01",
				"end_date":   "2026-09-16",
			},
			wantErr: false,
		},
		{
			name: "invalid start_date format",
			params: map[string]interface{}{
				"query":      "pertanian",
				"start_date": "01-01-2026",
			},
			wantErr: true,
		},
		{
			name: "invalid end_date format",
			params: map[string]interface{}{
				"query":    "pertanian",
				"end_date": "2026/09/16",
			},
			wantErr: true,
		},
		{
			name: "start_date after end_date",
			params: map[string]interface{}{
				"query":      "pertanian",
				"start_date": "2026-10-01",
				"end_date":   "2026-09-01",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := m.Validate(tt.params)
			if (err != nil) != tt.wantErr {
				t.Errorf("Validate() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
