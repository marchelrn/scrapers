package service

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"github.com/marchelrn/scrapers/config"
	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
)

// AuthService handles authentication business logic
type AuthService struct {
	UserRepo  contract.UserRepository
	JwtSecret string
	JwtExpiry time.Duration
}

// ImplAuthService NewAuthService creates a new AuthService
func ImplAuthService(userRepo contract.UserRepository, cfg *config.Config) contract.AuthService {
	return &AuthService{
		UserRepo:  userRepo,
		JwtSecret: cfg.JWTSecret,
		JwtExpiry: cfg.JWTExpiry,
	}
}

// Register creates a new user account
func (s *AuthService) Register(req dto.RegisterRequest) (*dto.UserResponse, error) {
	// Check if email already exists
	existing, _ := s.UserRepo.GetByEmail(req.Email)
	if existing != nil {
		return nil, errors.New("email already registered")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	// Set default role if empty
	role := req.Role
	if role == "" {
		role = "operator"
	}

	user := &models.User{
		Name:     req.Name,
		Email:    req.Email,
		Password: string(hashedPassword),
		Role:     role,
	}

	if err := s.UserRepo.Create(user); err != nil {
		return nil, errors.New("failed to create user")
	}

	return &dto.UserResponse{
		ID:        user.ID,
		Name:      user.Name,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
	}, nil
}

// Login authenticates a user and returns a JWT token
func (s *AuthService) Login(req dto.LoginRequest) (*dto.LoginResponse, error) {
	// Find user by email
	user, err := s.UserRepo.GetByEmail(req.Email)
	if err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Generate JWT token
	token, err := s.generateToken(user)
	if err != nil {
		return nil, errors.New("failed to generate token")
	}

	return &dto.LoginResponse{
		Token: token,
		User:  *user,
	}, nil
}

// GetUserByID retrieves a user by ID (for /me endpoint)
func (s *AuthService) GetUserByID(id int) (*dto.UserResponse, error) {
	user, err := s.UserRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("user not found")
	}
	return &dto.UserResponse{
		ID:        user.ID,
		Name:      user.Name,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
	}, nil
}

// ValidateToken parses and validates a JWT token, returning the user ID
func (s *AuthService) ValidateToken(tokenString string) (int, string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.JwtSecret), nil
	})

	if err != nil || !token.Valid {
		return 0, "", errors.New("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return 0, "", errors.New("invalid token claims")
	}

	userID := int(claims["user_id"].(float64))
	role := claims["role"].(string)

	return userID, role, nil
}

// generateToken creates a new JWT token for a user
func (s *AuthService) generateToken(user *models.User) (string, error) {
	claims := jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"role":    user.Role,
		"exp":     time.Now().Add(s.JwtExpiry).Unix(),
		"iat":     time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.JwtSecret))
}
