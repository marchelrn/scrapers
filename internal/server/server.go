package server

import (
	"fmt"
	"net/http"

	"github.com/marchelrn/scrapers/config"
	"github.com/marchelrn/scrapers/handler"
	"github.com/marchelrn/scrapers/repository"
	"github.com/marchelrn/scrapers/routes"
	"github.com/marchelrn/scrapers/service"
)

func Run(cfg config.Config) error {
	repo := repository.NewHealthRepository()
	svc := service.NewHealthService(repo)
	h := handler.NewHealthHandler(svc)

	r := routes.NewRouter(h)
	addr := fmt.Sprintf(":%s", cfg.Port)

	return http.ListenAndServe(addr, r)
}
