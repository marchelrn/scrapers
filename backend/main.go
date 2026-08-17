package main

import (
	"github.com/marchelrn/scrapers/cmd/app"
	_ "github.com/marchelrn/scrapers/docs"
)

// @title Scrapers API
// @version 1.0
// @description This is a sample server for Scrapers.
// @host localhost:8080
// @BasePath /
func main() {
	app.Run()
}
