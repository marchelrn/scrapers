package service

import (
	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	errs "github.com/marchelrn/scrapers/pkg/error"
	"golang.org/x/crypto/bcrypt"
)

type UserService struct {
	UserRepo contract.UserRepository
}

func ImplUserService(userRepo contract.UserRepository) contract.UserService {
	return &UserService{
		UserRepo: userRepo,
	}
}

func (s *UserService) GetAll() ([]dto.UserResponse, error) {
	users, err := s.UserRepo.GetAll()
	if err != nil {
		return nil, err
	}

	var responses []dto.UserResponse
	for _, user := range users {
		responses = append(responses, dto.UserResponse{
			ID:        user.ID,
			Name:      user.Name,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt,
			UpdatedAt: user.UpdatedAt,
		})
	}

	return responses, nil
}

func (s *UserService) GetUserByID(id string) (*dto.UserResponse, error) {
	user, err := s.UserRepo.GetByID(id)
	if err != nil {
		return nil, err
	}

	return &dto.UserResponse{
		ID:        user.ID,
		Name:      user.Name,
		Email:     user.Email,
		Role:      user.Role,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	}, nil
}

func (s *UserService) UpdateProfile(id string, req dto.UpdateProfileRequest) (*dto.UserResponse, error) {
	user, err := s.UserRepo.GetByID(id)
	if err != nil {
		return nil, err
	}

	if req.Name == nil && req.Email == nil && req.Password == nil {
		return &dto.UserResponse{
			ID:        user.ID,
			Name:      user.Name,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt,
			UpdatedAt: user.UpdatedAt,
		}, nil
	}

	if req.Name != nil {
		user.Name = *req.Name
	}
	if req.Email != nil {
		user.Email = *req.Email
	}
	if req.Password != nil {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(*req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, errs.BadRequest("failed to hash password")
		}
		user.Password = string(hashedPassword)
	}

	userUpdated, err := s.UserRepo.Update(id, user)
	if err != nil {
		return nil, errs.BadRequest("Error Updating data")
	}

	return &dto.UserResponse{
		ID:        userUpdated.ID,
		Name:      userUpdated.Name,
		Email:     userUpdated.Email,
		Role:      userUpdated.Role,
		CreatedAt: userUpdated.CreatedAt,
		UpdatedAt: userUpdated.UpdatedAt,
	}, nil
}

func (s *UserService) UpdateAsAdmin(id string, req dto.UpdateRequest) (*dto.UserResponse, error) {
	user, err := s.UserRepo.GetByID(id)
	if err != nil {
		return nil, err
	}

	if req.Name == "" && req.Email == "" && req.Password == "" && req.Role == "" {
		return &dto.UserResponse{
			ID:        user.ID,
			Name:      user.Name,
			Email:     user.Email,
			Role:      user.Role,
			CreatedAt: user.CreatedAt,
			UpdatedAt: user.UpdatedAt,
		}, nil
	}

	if req.Name != "" {
		user.Name = req.Name
	}
	if req.Email != "" {
		user.Email = req.Email
	}
	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, errs.BadRequest("failed to hash password")
		}
		user.Password = string(hashedPassword)
	}
	if req.Role != "" {
		user.Role = req.Role
	}

	userUpdated, err := s.UserRepo.Update(id, user)
	if err != nil {
		return nil, errs.BadRequest("Error Updating data")
	}

	return &dto.UserResponse{
		ID:        userUpdated.ID,
		Name:      userUpdated.Name,
		Email:     userUpdated.Email,
		Role:      userUpdated.Role,
		CreatedAt: userUpdated.CreatedAt,
		UpdatedAt: userUpdated.UpdatedAt,
	}, nil
}

func (s *UserService) Delete(id string) error {
	return s.UserRepo.Delete(id)
}
