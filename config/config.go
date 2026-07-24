package config

import (
	"fmt"
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all application configuration
type Config struct {
	Port      string
	GinMode   string
	DB        *DBConfig
	JWTSecret string
	JWTExpiry time.Duration
	URL       string
}

// DBConfig holds database connection parameters
type DBConfig struct {
	DBurl string
}

// GetDBUrl returns the connection string based on GinMode
func GetDBUrl(ginMode string) string {
	if ginMode == "release" || ginMode == "production" {
		dbURL := os.Getenv("DB_URL")
		if dbURL == "" {
			log.Fatal("FATAL: DB_URL environment variable is required in production mode!")
		}
		return dbURL
	}

	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "postgres")
	password := getEnv("DB_PASSWORD", "postgres")
	dbname := getEnv("DB_NAME", "scrapers")
	sslmode := getEnv("DB_SSLMODE", "disable")

	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode)
}

// Load reads environment variables and returns a Config struct
func Load() *Config {
	// Load .env file if it exists (ignore error if missing)
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	expiry, err := time.ParseDuration(getEnv("JWT_EXPIRY", "24h"))
	if err != nil {
		expiry = 24 * time.Hour
	}

	ginMode := getEnv("GIN_MODE", "debug")

	return &Config{
		Port:      getEnv("PORT", "8080"),
		GinMode:   ginMode,
		DB:        &DBConfig{DBurl: GetDBUrl(ginMode)},
		JWTSecret: getEnv("JWT_SECRET", "default-secret"),
		JWTExpiry: expiry,
		URL:       getEnv("URL", "http://localhost:8080"),
	}
}

// getEnv returns environment variable value or a default
func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}

