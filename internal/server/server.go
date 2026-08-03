package server

import (
	"database/sql"
	"log"
	"os"

	"github.com/gin-gonic/gin"

	"github.com/marchelrn/scrapers/config"
	"github.com/marchelrn/scrapers/internal/database"
	"github.com/marchelrn/scrapers/repository"
	"github.com/marchelrn/scrapers/routes"
	"github.com/marchelrn/scrapers/service"
)

func Run() {
	log.SetFlags(log.Ldate | log.Ltime)
	log.SetOutput(os.Stdout)
	cfg := config.Load()
	gin.SetMode(cfg.GinMode)

	// ─── Connect to database ────────────────────────────────────────
	db, _ := database.ConnectDB(cfg)
	sqlDB, _ := db.DB()
	defer func(sqlDB *sql.DB) {
		err := sqlDB.Close()
		if err != nil {

		}
	}(sqlDB)

	// ─── Start server ───────────────────────────────────────────────
	addr := ":" + cfg.Port
	log.Printf("Scraping Platform API starting on http://localhost%s", addr)
	log.Printf("API Docs: http://localhost%s/swagger/index.html", addr)
	log.Printf("Health Check: http://localhost%s/health", addr)

	repo := repository.New(db)
	svc := service.New(repo)

	// Start Scheduler
	if err := svc.Schedule.StartScheduler(); err != nil {
		log.Printf("Warning: failed to start scheduler: %v", err)
	}

	r := routes.SetupRoutes(svc)

	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
