package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/marchelrn/scrapers/contract"
)

type AccountHandler struct {
	svc contract.AccountService
}

func (c *AccountHandler) InitService(svc contract.AccountService) {
	c.svc = svc
}

// @Schemes http
// @Description Login with email and password
// @Tags account
// @Accept json
// @Produce json
// @Param email body string true "Email"
// @Param password body string true "Password"
// @Success 200 {object} dto.AccountResponse
// @Failure 400 {object} dto.ErrorResponse
// @Router /v1/login [post]
func (h *AccountHandler) PostLogin(ctx *gin.Context) {
	ctx.JSON(200, "test")
}

// @Schemes http
// @Description Register with name, email and password
// @Tags account
// @Accept json
// @Produce json
// @Param name body string true "Name"
// @Param email body string true "Email"
// @Param password body string true "Password"
// @Success 200 {object} dto.Response
// @Failure 400 {object} dto.ErrorResponse
// @Router /v1/register [post]
func (h *AccountHandler) PostRegister(ctx *gin.Context) {

}
