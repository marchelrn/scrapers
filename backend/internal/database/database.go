package database

import (
	"database/sql"
	"log"
	"os"
	"time"

	"github.com/marchelrn/scrapers/config"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func ConnectDB(cfg *config.Config) (*gorm.DB, *sql.DB) {

	var loggerLevel logger.LogLevel
	if cfg.GinMode != "debug" {
		loggerLevel = logger.Error
	} else {
		loggerLevel = logger.Info
	}

	sqlLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  loggerLevel,
			IgnoreRecordNotFoundError: true,
			ParameterizedQueries:      true,
			Colorful:                  false,
		})
	log.Println("connecting to databases")

	if cfg.GinMode == "test" || cfg.GinMode == "release" {
		log.Println("using external database")
	} else if cfg.DevMode == "true" {
		log.Println("using supabase")
	} else {
		log.Println("using local database")
	}

	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  cfg.DB.DBurl,
		PreferSimpleProtocol: true, // PgBouncer / Connection Pooler for Supabase/Render
	}), &gorm.Config{
		Logger:                 sqlLogger,
		SkipDefaultTransaction: true,
		AllowGlobalUpdate:      false,
		TranslateError:         true,
	})

	if err != nil {
		log.Fatalf("error connect sql. error : %v", err)
	}
	log.Println("success connect database")

	log.Println("set database connection configuration")
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("error set database connection config. error : %v", err)
	}
	sqlDB.SetMaxIdleConns(10)

	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return db, sqlDB
}
