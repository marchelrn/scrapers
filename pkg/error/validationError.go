package errs

import (
	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"github.com/marchelrn/scrapers/pkg/response"
)

func OneOf(err error, c *gin.Context) {
	if validationsError, ok := err.(validator.ValidationErrors); ok {
		for _, fieldError := range validationsError {
			if fieldError.Field() == "Role" && fieldError.Tag() == "oneof" {
				response.BadRequest(c, "Role must be admin or operator")
				return
			}
		}
	}
	response.BadRequest(c, "Not a valid request format")
}
