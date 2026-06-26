package app

import (
	"log"

	"github.com/marchelrn/scrapers/internal/server"
)

func Run() {
	if err := server.Run(); err != nil {
		log.Fatal("Server failed", err)
	}
}
