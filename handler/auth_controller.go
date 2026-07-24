package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/pkg/response"
)

// AuthController handles authentication HTTP requests
type AuthController struct {
	service contract.AuthService
}

// NewAuthController creates a new AuthController
func (c *AuthController) InitService(s *contract.Service) {
	c.service = s.Auth
}

// Register handles user registration
// @Summary Register a new user
// @Description Create a new user account
// @Tags Auth
// @Accept JSON
// @Produce JSON
// @Param request body dto.RegisterRequest true "Registration data"
// @Success 201 {object} response.APIResponse{data=dto.UserResponse}
// @Failure 400 {object} response.APIResponse
// @Router /api/v1/auth/register [post]
func (h *AuthController) Register(c *gin.Context) {
	var req dto.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	user, err := h.service.Register(req)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "User registered successfully", dto.ToUserResponse(*user))
}

// Login handles user authentication
// @Summary Login
// @Description Authenticate user and return JWT token
// @Tags Auth
// @Accept JSON
// @Produce JSON
// @Param request body dto.LoginRequest true "Login credentials"
// @Success 200 {object} response.APIResponse{data=dto.LoginResponse}
// @Failure 401 {object} response.APIResponse
// @Router /api/v1/auth/login [post]
func (h *AuthController) Login(c *gin.Context) {
	var req dto.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	loginResp, err := h.service.Login(req)
	if err != nil {
		response.Unauthorized(c, err.Error())
		return
	}

	response.OK(c, "Login successful", loginResp)
}

// returns the current authenticated user info
// @Summary Get current user
// @Description Get information about the currently authenticated user
// @Tags Auth
// @Produce JSON
// @Security BearerAuth
// @Success 200 {object} response.APIResponse{data=dto.UserResponse}
// @Failure 401 {object} response.APIResponse
// @Router /api/v1/auth/me [get]
func (h *AuthController) Me(c *gin.Context) {
	userID, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "user not authenticated")
		return
	}

	user, err := h.service.GetUserByID(userID.(int))
	if err != nil {
		response.NotFound(c, err.Error())
		return
	}

	response.OK(c, "User retrieved successfully", dto.ToUserResponse(*user))
}
