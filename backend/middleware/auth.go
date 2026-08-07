package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/pkg/response"
)

// AuthMiddleware creates a JWT authentication middleware
func AuthMiddleware(auth contract.AuthService) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "authorization header is required")
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			response.Unauthorized(c, "authorization header must be in format: Bearer <token>")
			c.Abort()
			return
		}

		tokenString := parts[1]

		// Validate token
		userID, role, err := auth.ValidateToken(tokenString)
		if err != nil {
			response.Unauthorized(c, "invalid or expired token")
			c.Abort()
			return
		}

		// Store user info in context for downstream handlers
		c.Set("user_id", userID)
		c.Set("user_role", role)

		c.Next()
	}
}

// AdminOnly restricts access to admin users only
func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("user_role")
		if !exists || role.(string) != "admin" {
			response.Forbidden(c, "admin access required")
			c.Abort()
			return
		}
		c.Next()
	}
}
