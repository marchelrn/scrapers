package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/pkg/response"
)

// AuthController handles authentication HTTP requests.
type AuthController struct {
	authService contract.AuthService
	userSerivce contract.UserService
}

func (c *AuthController) InitService(s *contract.Service) {
	c.authService = s.Auth
	c.userSerivce = s.User
}

// Register handles user registration.
func (h *AuthController) Register(c *gin.Context) {
	var req dto.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	user, err := h.authService.Register(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "User registered successfully", user)
}

// Login handles user authentication.
func (h *AuthController) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	loginResp, err := h.authService.Login(req)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	response.OK(c, "Login successful", loginResp)
}

// Me returns the current authenticated user info.
func (h *AuthController) Me(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "user not authenticated")
		return
	}

	user, err := h.userSerivce.GetUserByID(userID.(string))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "User retrieved successfully", user)
}
