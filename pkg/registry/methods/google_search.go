package methods

import (
	"context"
	"encoding/json"
	"errors"
	"os/exec"
	"time"

	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/pkg/registry"
)

type GoogleSearchMethod struct{}

func NewGoogleSearchMethod() registry.ScrapingMethod {
	return &GoogleSearchMethod{}
}

func (m *GoogleSearchMethod) Code() string {
	return "google_search"
}

func (m *GoogleSearchMethod) Name() string {
	return "Web Search (News)"
}

func (m *GoogleSearchMethod) Description() string {
	return "Mencari artikel berita via DuckDuckGo Search (Tanpa Kunci API) dan mengekstrak teks halamannya."
}

func (m *GoogleSearchMethod) Version() string {
	return "1.1.0"
}

func (m *GoogleSearchMethod) ParameterDefinitions() []registry.ParameterDefinition {
	return []registry.ParameterDefinition{
		{
			Name:        "query",
			Label:       "Search Query",
			Type:        "text",
			Required:    true,
			Placeholder: "e.g. Tanaman Pangan Sulawesi Utara",
		},
		{
			Name:        "domain_filter",
			Label:       "Domain Filter (Optional)",
			Type:        "text",
			Required:    false,
			Placeholder: "e.g. bps.go.id, antaranews.com",
		},
		{
			Name:     "max_results",
			Label:    "Max Results",
			Type:     "number",
			Required: false,
			Default:  10,
		},
		{
			Name:     "auth_type",
			Label:    "Authentication Type",
			Type:     "text",
			Required: true,
			Default:  "none",
		},
	}
}

func (m *GoogleSearchMethod) AuthenticationCapabilities() []string {
	return []string{"none"}
}

func (m *GoogleSearchMethod) Validate(params map[string]interface{}) error {
	query, ok := params["query"]
	if !ok || query == "" {
		return errors.New("parameter 'query' is required")
	}

	authType, ok := params["auth_type"]
	if !ok || authType != "none" {
		return errors.New("parameter 'auth_type' must be 'none'")
	}

	return nil
}

func (m *GoogleSearchMethod) Execute(ctx context.Context, params map[string]interface{}) (*dto.WorkerResult, error) {
	pythonFile := "google_search_scraper.py"

	paramsJSONBytes, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	paramsJSON := string(paramsJSONBytes)

	var output []byte
	var lastErr error

	// We don't implement retry on the overall Python process for Google Search,
	// because the Python script itself will handle API retries,
	// and we want to avoid double-burning Google Search API quota.
	cmd := exec.CommandContext(ctx, "workers/python/venv/bin/python", "workers/python/worker.py", pythonFile, paramsJSON)
	output, lastErr = cmd.CombinedOutput()

	// 5MB Max Output limit
	if len(output) > 5*1024*1024 {
		nowISO := time.Now().UTC().Format(time.RFC3339)
		return &dto.WorkerResult{
			Status:  "failed",
			Method:  m.Code(),
			Results: []interface{}{},
			Metadata: dto.WorkerMetadata{
				Source:    "google_search",
				FetchedAt: nowISO,
				ItemCount: 0,
			},
			Error: &dto.WorkerError{
				Code:    "OUTPUT_LIMIT_EXCEEDED",
				Message: "Worker output exceeded 5MB limit",
			},
		}, nil
	}

	var workerResult dto.WorkerResult
	parseErr := json.Unmarshal(output, &workerResult)

	if parseErr != nil {
		nowISO := time.Now().UTC().Format(time.RFC3339)
		msg := "Invalid worker output contract: " + parseErr.Error()
		if lastErr != nil {
			msg += " | Error: " + lastErr.Error()
		}

		return &dto.WorkerResult{
			Status:  "failed",
			Method:  m.Code(),
			Results: []interface{}{},
			Metadata: dto.WorkerMetadata{
				Source:    "google_search",
				FetchedAt: nowISO,
				ItemCount: 0,
			},
			Error: &dto.WorkerError{
				Code:    "EXECUTION_ERROR",
				Message: msg + "\nOutput: " + string(output),
			},
		}, nil
	}

	return &workerResult, nil
}
