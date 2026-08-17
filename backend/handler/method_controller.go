package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/marchelrn/scrapers/pkg/registry"
	"github.com/marchelrn/scrapers/pkg/response"
)

// MethodController handles HTTP requests for scraping methods from the registry.
type MethodController struct{}

func NewMethodController() *MethodController {
	return &MethodController{}
}

// GetAll retrieves all registered scraping methods.
func (h *MethodController) GetAll(c *gin.Context) {
	methods := registry.Get().GetAllMethods()

	// Map to response format
	var res []map[string]interface{}
	for _, m := range methods {
		res = append(res, map[string]interface{}{
			"code":              m.Code(),
			"name":              m.Name(),
			"description":       m.Description(),
			"version":           m.Version(),
			"parameters":        m.ParameterDefinitions(),
			"auth_capabilities": m.AuthenticationCapabilities(),
		})
	}

	response.OK(c, "Methods retrieved successfully", res)
}
