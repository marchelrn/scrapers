package service

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/marchelrn/scrapers/config"
	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	"github.com/marchelrn/scrapers/models"
	errs "github.com/marchelrn/scrapers/pkg/error"
)

// AuthService handles authentication business logic
type AuthService struct {
	UserRepo  contract.UserRepository
	JwtSecret string
	JwtExpiry time.Duration
}

// ImplAuthService creates a new AuthService
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
	exists, err := s.UserRepo.GetByEmail(req.Email)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	if exists != nil {
		return nil, errs.Conflict("user already registered, please login")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	// Set default role if empty
	role := req.Role
	if role == "" {
		role = models.UserRoleOperator
	}

	user := &models.User{
		Name:     req.Name,
		Email:    req.Email,
		Password: string(hashedPassword),
		Role:     role,
	}

	if err := s.UserRepo.Create(user); err != nil {
		return nil, errors.New("failed to create user: " + err.Error())
	}

	resp := dto.ToUserResponse(*user)
	return &resp, nil
}

// Login authenticates a user and returns a JWT token
func (s *AuthService) Login(req dto.LoginRequest) (*dto.LoginResponse, error) {
	user, err := s.UserRepo.GetByEmail(req.Email)
	if err != nil || user == nil {
		return nil, errors.New("invalid email or password")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, errors.New("failed to generate token")
	}

	return &dto.LoginResponse{
		Token: dto.Token{
			Token:   token,
			Expires: time.Now().Add(s.JwtExpiry),
		},
		User: dto.ToUserResponse(*user),
	}, nil
}

// GetserByID retrieves a user by UUID string
func (s *AuthService) GetUserByID(id string) (*dto.UserResponse, error) {
	user, err := s.UserRepo.GetByID(id)
	if err != nil {
		return nil, errors.New("user not found")
	}
	resp := dto.ToUserResponse(*user)
	return &resp, nil
}

// ValidateToken parses a JWT token, returning (userID string, role string, error)
func (s *AuthService) ValidateToken(tokenString string) (string, string, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.JwtSecret), nil
	})

	if err != nil || !token.Valid {
		return "", "", errors.New("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", "", errors.New("invalid token claims")
	}

	userID, ok := claims["user_id"].(string)
	if !ok {
		return "", "", errors.New("invalid user_id in token")
	}
	role, _ := claims["role"].(string)

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
