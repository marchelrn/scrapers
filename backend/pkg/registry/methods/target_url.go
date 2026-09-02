package methods

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/pkg/registry"
	"github.com/marchelrn/scrapers/pkg/urlvalidator"
)

// TargetURLMethod implements the target_url business method.
type TargetURLMethod struct{}

func NewTargetURLMethod() registry.ScrapingMethod {
	return &TargetURLMethod{}
}

func (m *TargetURLMethod) Code() string {
	return "target_url"
}

func (m *TargetURLMethod) Name() string {
	return "Target URL"
}

func (m *TargetURLMethod) Description() string {
	return "Scrapes data from a specified URL using various extraction techniques."
}

func (m *TargetURLMethod) Version() string {
	return "1.0.0"
}

func (m *TargetURLMethod) ParameterDefinitions() []registry.ParameterDefinition {
	return []registry.ParameterDefinition{
		{
			Name:        "url",
			Label:       "Target URL",
			Type:        "text",
			Required:    true,
			Placeholder: "https://example.com",
		},
		{
			Name:     "technique",
			Label:    "Extraction Technique",
			Type:     "text", // Should ideally be an enum/select: css, xpath, regex, api, headless, keyword_find
			Required: true,
			Default:  "css",
		},
		{
			Name:        "selector",
			Label:       "CSS Selector",
			Type:        "text",
			Required:    false,
			Placeholder: ".class-name",
		},
		{
			Name:        "xpath",
			Label:       "XPath",
			Type:        "text",
			Required:    false,
			Placeholder: "//div",
		},
		{
			Name:     "pattern",
			Label:    "Regex Pattern",
			Type:     "text",
			Required: false,
		},
		{
			Name:     "json_path",
			Label:    "JSON Path (API)",
			Type:     "text",
			Required: false,
		},
		{
			Name:        "keyword",
			Label:       "Keyword to Find",
			Type:        "text",
			Required:    false,
			Placeholder: "e.g. Inflasi",
		},
		{
			Name:     "auth_type",
			Label:    "Authentication Type",
			Type:     "text",
			Required: true,
			Default:  "none",
		},
		{
			Name:     "secret_reference",
			Label:    "Secret ID",
			Type:     "text",
			Required: false,
		},
	}
}

func (m *TargetURLMethod) AuthenticationCapabilities() []string {
	return []string{"none", "api_key", "bearer_token"}
}

func (m *TargetURLMethod) Validate(params map[string]interface{}) error {
	// Validate URL
	urlVal, ok := params["url"]
	if !ok || urlVal == "" {
		return errors.New("parameter 'url' is required")
	}

	urlStr, ok := urlVal.(string)
	if !ok {
		return errors.New("parameter 'url' must be a string")
	}

	if err := urlvalidator.Validate(urlStr); err != nil {
		return errors.New("invalid url: " + err.Error())
	}

	// Validate Technique
	techniqueVal, ok := params["technique"]
	if !ok || techniqueVal == "" {
		return errors.New("parameter 'technique' is required")
	}
	technique := techniqueVal.(string)

	// Validate Auth Type
	authTypeVal, ok := params["auth_type"]
	authType := "none"
	if ok && authTypeVal != "" {
		authType = authTypeVal.(string)
	}

	if authType != "none" {
		secretRef, hasRef := params["secret_reference"]
		if !hasRef || secretRef == "" {
			return errors.New("parameter 'secret_reference' is required when auth_type is not none")
		}
	}

	// Validate Technique specific parameters
	switch technique {
	case "css":
		if sel, ok := params["selector"]; !ok || sel == "" {
			return errors.New("parameter 'selector' is required for css technique")
		}
	case "xpath":
		if xp, ok := params["xpath"]; !ok || xp == "" {
			return errors.New("parameter 'xpath' is required for xpath technique")
		}
	case "regex":
		if pat, ok := params["pattern"]; !ok || pat == "" {
			return errors.New("parameter 'pattern' is required for regex technique")
		}
	case "api":
		// no specific strict reqs for now (json_path is optional)
	case "headless":
		if sel, ok := params["selector"]; !ok || sel == "" {
			return errors.New("parameter 'selector' is required for headless technique")
		}
	case "keyword_find":
		if kw, ok := params["keyword"]; !ok || kw == "" {
			return errors.New("parameter 'keyword' is required for keyword_find technique")
		}
	default:
		return errors.New("unknown technique: " + technique)
	}

	return nil
}

func (m *TargetURLMethod) Execute(ctx context.Context, params map[string]interface{}) (*dto.WorkerResult, error) {
	technique, _ := params["technique"].(string)

	pythonFile := ""
	switch technique {
	case "css":
		pythonFile = "css_scraper.py"
	case "xpath":
		pythonFile = "xpath_scraper.py"
	case "regex":
		pythonFile = "regex_scraper.py"
	case "api":
		pythonFile = "api_scraper.py"
	case "headless":
		pythonFile = "headless_scraper.py"
	case "keyword_find":
		pythonFile = "keyword_scraper.py"
	default:
		return nil, errors.New("unknown technique: " + technique)
	}

	paramsJSONBytes, err := json.Marshal(params)
	if err != nil {
		return nil, err
	}

	source, _ := params["url"].(string)

	return runWorker(ctx, m.Code(), pythonFile, string(paramsJSONBytes), source)
}
