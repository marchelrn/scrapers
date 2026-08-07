package urlvalidator

import "testing"

func TestValidate(t *testing.T) {
	tests := []struct {
		name        string
		url         string
		expectError bool
	}{
		{"valid https", "https://www.bps.go.id/data", false},
		{"valid http", "http://example.com", false},
		{"empty url", "", true},
		{"no scheme", "example.com", true},
		{"ftp scheme", "ftp://example.com", true},
		{"localhost", "http://localhost:8080", true},
		{"loopback ip4", "http://127.0.0.1/admin", true},
		{"loopback ip6", "http://[::1]/admin", true},
		{"private 10.x", "http://10.0.0.1/secret", true},
		{"private 172.16.x", "http://172.16.0.1/secret", true},
		{"private 192.168.x", "http://192.168.1.1/secret", true},
		{"link-local", "http://169.254.169.254/latest/meta-data", true},
		{"metadata google", "http://metadata.google.com/computeMetadata", true},
		{"public ip", "http://8.8.8.8/dns", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := Validate(tt.url)
			if tt.expectError && err == nil {
				t.Errorf("expected error for url %q, got nil", tt.url)
			}
			if !tt.expectError && err != nil {
				t.Errorf("expected no error for url %q, got %v", tt.url, err)
			}
		})
	}
}
