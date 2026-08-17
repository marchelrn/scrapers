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
	DevMode   string
}

// DBConfig holds database connection parameters
type DBConfig struct {
	DBurl string
}

// GetDBUrl returns the connection string based on GinMode
func GetDBUrl(ginMode string) string {
	devMode := getEnv("DEBUG_TESTING", "true")

	if devMode == "true" || ginMode == "release" || ginMode == "test" {
		dbUrl := getEnv("DB_URL", getEnv("DB_URL_PROD", ""))
		if dbUrl == "" {
			log.Fatal("FATAL: DB_URL or DB_URL_PROD variable is required for DB cloud services")
		}
		return dbUrl
	}

	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5431")
	user := getEnv("DB_USER", "postgres")
	password := getEnv("DB_PASSWORD", "postgres")
	dbName := getEnv("DB_NAME", "scrapers")
	sslMode := getEnv("DB_SSL_MODE", "disable")

	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s", host, port, user, password, dbName, sslMode)
}

// Load reads environment variables and returns a Config struct
func Load() *Config {
	// Load .env file if it exists
	envFiles := []string{".env", "../.env", "../../.env"}
	loaded := false
	for _, file := range envFiles {
		if _, err := os.Stat(file); err == nil {
			if loadErr := godotenv.Load(file); loadErr != nil {
				log.Fatalf("FATAL: Found '%s' file but failed to parse it: %v", file, loadErr)
			}
			loaded = true
			fmt.Printf("Loaded env file: %s\n", file)
			break
		}
	}

	if !loaded {
		fmt.Println("INFO: No .env file found in searched paths (.env, ../.env, ../../.env). Falling back to system environment variables.")
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
		DevMode:   getEnv("DEBUG_TESTING", "true"),
	}
}

// getEnv returns environment variable value or a default
func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return defaultVal
}
