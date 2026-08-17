package handler

import (
	"github.com/gin-gonic/gin"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/pkg/response"
)

type SecretController struct {
	service contract.SecretService
}

func (ctrl *SecretController) InitService(s *contract.Service) {
	ctrl.service = s.Secret
}

func (h *SecretController) GetAll(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")

	secrets, err := h.service.GetAll(userID.(string), userRole.(string))
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "Secrets retrieved successfully", secrets)
}

func (h *SecretController) Create(c *gin.Context) {
	var req dto.CreateSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	userID, _ := c.Get("user_id")

	secret, err := h.service.Create(req, userID.(string))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Secret created successfully", secret)
}

func (h *SecretController) GetByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Secret ID is required")
		return
	}

	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")

	secret, err := h.service.GetByID(id, userID.(string), userRole.(string))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Secret retrieved successfully", secret)
}

func (h *SecretController) Update(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Secret ID is required")
		return
	}

	var req dto.UpdateSecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")

	secret, err := h.service.Update(id, req, userID.(string), userRole.(string))
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.OK(c, "Secret updated successfully", secret)
}

func (h *SecretController) Delete(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "Secret ID is required")
		return
	}

	userID, _ := c.Get("user_id")
	userRole, _ := c.Get("user_role")

	if err := h.service.Delete(id, userID.(string), userRole.(string)); err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "Secret deleted successfully", nil)
}
