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

type GoogleNewsMethod struct{}

func NewGoogleNewsMethod() registry.ScrapingMethod {
	return &GoogleNewsMethod{}
}

func (m *GoogleNewsMethod) Code() string {
	return "google_news"
}

func (m *GoogleNewsMethod) Name() string {
	return "Google News RSS Search"
}

func (m *GoogleNewsMethod) Description() string {
	return "Mencari berita via Google News RSS Feed, me-resolve URL penerbit asli, dan mengekstrak teks serta ringkasan berita."
}

func (m *GoogleNewsMethod) Version() string {
	return "1.0.0"
}

func (m *GoogleNewsMethod) ParameterDefinitions() []registry.ParameterDefinition {
	return []registry.ParameterDefinition{
		{
			Name:        "query",
			Label:       "Search Query",
			Type:        "text",
			Required:    true,
			Placeholder: "e.g. Tanaman Pangan Sulawesi Utara 2026",
		},
		{
			Name:        "domain_filter",
			Label:       "Domain Filter (Optional)",
			Type:        "text",
			Required:    false,
			Placeholder: "e.g. antaranews.com, bps.go.id",
		},
		{
			Name:     "max_results",
			Label:    "Max Results",
			Type:     "number",
			Required: false,
			Default:  10,
		},
		{
			Name:        "ai_instruction",
			Label:       "AI Instruction / Prompt",
			Type:        "textarea",
			Required:    false,
			Placeholder: "e.g. Ringkas dan saring berita mengenai produksi komoditas pangan",
			Description: "Gunakan LLM (Gemini) untuk meringkas dan menyaring teks hasil ekstraksi berdasarkan instruksi.",
		},
		{
			Name:        "deduplicate",
			Label:       "Hindari Duplikasi (Skip URL yang sudah pernah diambil)",
			Type:        "boolean",
			Required:    false,
			Default:     true,
			Description: "Jika aktif, URL yang sudah pernah diambil pada konfigurasi ini tidak akan diambil ulang.",
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

func (m *GoogleNewsMethod) AuthenticationCapabilities() []string {
	return []string{"none"}
}

func (m *GoogleNewsMethod) Validate(params map[string]interface{}) error {
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

func (m *GoogleNewsMethod) Execute(ctx context.Context, params map[string]interface{}) (*dto.WorkerResult, error) {
	pythonFile := "google_news_scraper.py"

	paramsJSONBytes, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}
	paramsJSON := string(paramsJSONBytes)

	var output []byte
	var lastErr error

	cmd := exec.CommandContext(ctx, GetPythonExecutable(), GetWorkerScriptPath(), pythonFile, paramsJSON)
	output, lastErr = cmd.CombinedOutput()

	if ctx.Err() != nil {
		nowISO := time.Now().UTC().Format(time.RFC3339)
		return &dto.WorkerResult{
			Status:  "failed",
			Method:  m.Code(),
			Results: []interface{}{},
			Metadata: dto.WorkerMetadata{
				Source:    "google_news",
				FetchedAt: nowISO,
				ItemCount: 0,
			},
			Error: &dto.WorkerError{
				Code:    "TIMEOUT",
				Message: "Worker process execution timed out or was terminated: " + ctx.Err().Error(),
			},
		}, nil
	}

	if len(output) > 5*1024*1024 {
		nowISO := time.Now().UTC().Format(time.RFC3339)
		return &dto.WorkerResult{
			Status:  "failed",
			Method:  m.Code(),
			Results: []interface{}{},
			Metadata: dto.WorkerMetadata{
				Source:    "google_news",
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
				Source:    "google_news",
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
