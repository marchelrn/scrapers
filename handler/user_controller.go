package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/marchelrn/scrapers/contract"
	"github.com/marchelrn/scrapers/dto"
	errs "github.com/marchelrn/scrapers/pkg/error"
	"github.com/marchelrn/scrapers/pkg/response"
)

type UserController struct {
	userService contract.UserService
}

func (ctrl *UserController) InitService(s *contract.Service) {
	ctrl.userService = s.User
}

func (ctrl *UserController) GetAll(c *gin.Context) {
	user, err := ctrl.userService.GetAll()
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "Users retrieved successfully", user)
}

func (ctrl *UserController) GetByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "user ID is required")
		return
	}

	user, err := ctrl.userService.GetUserByID(id)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "User retrieved successfully", user)
}

func (ctrl *UserController) UpdateProfile(c *gin.Context) {
	id, exists := c.Get("user_id")
	if !exists {
		response.Unauthorized(c, "user not authenticated")
		return
	}

	var req dto.UpdateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "Invalid request: "+err.Error())
		return
	}

	user, err := ctrl.userService.UpdateProfile(id.(string), req)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "Profile updated successfully", user)
}

func (ctrl *UserController) UpdateAsAdmin(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "user ID is required")
		return
	}

	var req dto.UpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errs.OneOf(err, c)
		return
	}

	user, err := ctrl.userService.UpdateAsAdmin(id, req)
	if err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "User updated successfully", user)
}

func (ctrl *UserController) Delete(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "user ID is required")
		return
	}
	if err := ctrl.userService.Delete(id); err != nil {
		response.InternalServerError(c, err.Error())
		return
	}
	response.OK(c, "User deleted successfully", nil)
}
