package handler

import (
	"github.com/gin-gonic/gin"
	errs "github.com/marchelrn/scrapers/pkg/error"
)

type ErrorResponse struct {
	StatusCode int    `json:"status_code"`
	Error      string `json:"error"`
}

func HandleError(ctx *gin.Context, err error) {
	statusCode := errs.GetStatusCode(err)
	ctx.JSON(statusCode, ErrorResponse{
		StatusCode: statusCode,
		Error:      err.Error(),
	})
}
