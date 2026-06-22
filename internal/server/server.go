package server

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/marchelrn/scrapers/config"
	"github.com/marchelrn/scrapers/repository"
	"github.com/marchelrn/scrapers/routes"
	"github.com/marchelrn/scrapers/service"
)

func Run() {
	log.SetFlags(log.Ldate | log.Ltime)
	log.SetOutput(os.Stdout)

	cfg := config.Load()

	repo := repository.New()
	svc, err := service.New(repo)
	if err != nil {
		log.Fatal(err)
	}

	r := routes.NewRouter(svc)

	serv := &http.Server{
		Addr:    fmt.Sprintf(":%s", cfg.Port),
		Handler: r,
	}

	log.Fatal(serv.ListenAndServe())
}
