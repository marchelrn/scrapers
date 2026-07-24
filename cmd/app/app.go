package app

import (
	"github.com/marchelrn/scrapers/config"
	"github.com/marchelrn/scrapers/internal/server"
)

func Run() {
	config.Load()
	server.Run()
}
