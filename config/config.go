package config

import "os"

type Config struct {
	Port   string
	IsProd bool
}

func Load() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	isProd := false
	if os.Getenv("IS_PROD") == "true" {
		isProd = true
	}

	return Config{Port: port, IsProd: isProd}
}
