package app

import (
	"log"

	"github.com/marchelrn/scrapers/config"
	"github.com/marchelrn/scrapers/internal/server"
)

func Run() {
	cfg := config.Load()
	log.Println("Server started successfully on port ", "http://localhost:"+cfg.Port)
	server.Run()
}
