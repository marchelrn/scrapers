package methods

import (
	"context"
	"encoding/json"
	"errors"
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
			Name:        "start_date",
			Label:       "Start Date (Tanggal Awal)",
			Type:        "date",
			Required:    false,
			Placeholder: "YYYY-MM-DD",
			Description: "Tanggal awal publikasi berita (contoh: 2026-01-01).",
		},
		{
			Name:        "end_date",
			Label:       "End Date (Tanggal Akhir)",
			Type:        "date",
			Required:    false,
			Placeholder: "YYYY-MM-DD",
			Description: "Tanggal akhir publikasi berita (contoh: 2026-09-16).",
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
			Label:       "AI Instruction",
			Type:        "textarea",
			Required:    false,
			Placeholder: "e.g. Ringkas dan ekstrak hanya data mengenai komoditas Pertanian",
		},
		{
			Name:     "deduplicate",
			Label:    "Hindari Duplikasi",
			Type:     "boolean",
			Required: false,
			Default:  true,
		},
	}
}

func (m *GoogleNewsMethod) Validate(params map[string]interface{}) error {
	query, ok := params["query"]
	if !ok || query == "" {
		return errors.New("parameter 'query' is required")
	}

	var startDate, endDate time.Time
	var hasStart, hasEnd bool

	if sVal, ok := params["start_date"]; ok && sVal != nil && sVal != "" {
		sStr, ok := sVal.(string)
		if !ok {
			return errors.New("parameter 'start_date' must be a string formatted YYYY-MM-DD")
		}
		t, err := time.Parse("2006-01-02", sStr)
		if err != nil {
			return errors.New("invalid 'start_date' format, must be YYYY-MM-DD")
		}
		startDate = t
		hasStart = true
	}

	if eVal, ok := params["end_date"]; ok && eVal != nil && eVal != "" {
		eStr, ok := eVal.(string)
		if !ok {
			return errors.New("parameter 'end_date' must be a string formatted YYYY-MM-DD")
		}
		t, err := time.Parse("2006-01-02", eStr)
		if err != nil {
			return errors.New("invalid 'end_date' format, must be YYYY-MM-DD")
		}
		endDate = t
		hasEnd = true
	}

	if hasStart && hasEnd && startDate.After(endDate) {
		return errors.New("'start_date' cannot be after 'end_date'")
	}

	return nil
}

func (m *GoogleNewsMethod) Execute(ctx context.Context, params map[string]interface{}) (*dto.WorkerResult, error) {
	paramsJSONBytes, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}

	return runWorker(ctx, m.Code(), "google_news_scraper.py", string(paramsJSONBytes), "google_news")
}
