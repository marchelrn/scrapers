package app

import (
	"github.com/marchelrn/scrapers/config"
	"github.com/marchelrn/scrapers/internal/server"
	"github.com/marchelrn/scrapers/pkg/registry"
	"github.com/marchelrn/scrapers/pkg/registry/methods"
)

func Run() {
	config.Load()

	// Register scraping methods
	registry.Get().Register(methods.NewTargetURLMethod())
	registry.Get().Register(methods.NewGoogleSearchMethod())

	server.Run()
}
