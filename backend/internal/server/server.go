package server

import (
	"context"
	"database/sql"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

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
			log.Printf("Failed to close DB: %v", err)
		}
	}(sqlDB)

	// ─── Initialize Services ─────────────────────────────────────────
	repo := repository.New(db)
	svc := service.New(repo)

	// Recover stuck jobs before starting the scheduler
	if err := svc.ScrapingJob.RecoverStuckJobs(); err != nil {
		log.Printf("Warning: failed to recover stuck jobs: %v", err)
	}

	// Start Scheduler
	if err := svc.Schedule.StartScheduler(); err != nil {
		log.Printf("Warning: failed to start scheduler: %v", err)
	}
	defer svc.Schedule.StopScheduler()

	// ─── Start server ───────────────────────────────────────────────
	r := routes.SetupRoutes(svc)

	addr := ":" + cfg.Port
	srv := &http.Server{
		Addr:    addr,
		Handler: r,
	}

	// Run server in a goroutine so it doesn't block
	go func() {
		log.Printf("Scraping Platform API starting on http://localhost%s", addr)
		log.Printf("API Docs: http://localhost%s/swagger/index.html", addr)
		log.Printf("Health Check: http://localhost%s/health", addr)

		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// ─── Graceful Shutdown ─────────────────────────────────────────
	// Wait for interrupt signal to gracefully shut down the server
	quit := make(chan os.Signal, 1)
	// kill (no param) default send syscall.SIGTERM
	// kill -2 is syscall.SIGINT
	// kill -9 is syscall.SIGKILL but can't be caught, so don't need add it
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// The context is used to inform the server it has 5 seconds to finish
	// the request it is currently handling
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown: ", err)
	}

	log.Println("Server exiting")
}
