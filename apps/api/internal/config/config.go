// Package config loads service configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"
)

type Config struct {
	Env             string // "development" or "production"
	Port            string
	DatabaseURL     string
	AllowedOrigins  []string
	LogLevel        string
	ShutdownTimeout time.Duration
}

// Load reads configuration from the environment and fails fast when a
// required value is missing.
func Load() (Config, error) {
	cfg := Config{
		Env:             getenv("APP_ENV", "development"),
		Port:            getenv("PORT", "8080"),
		DatabaseURL:     os.Getenv("DATABASE_URL"),
		AllowedOrigins:  splitList(getenv("ALLOWED_ORIGINS", "http://localhost:3000")),
		LogLevel:        getenv("LOG_LEVEL", "info"),
		ShutdownTimeout: 10 * time.Second,
	}

	var errs []error
	if cfg.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL is required"))
	}
	if cfg.Env != "development" && cfg.Env != "production" {
		errs = append(errs, fmt.Errorf("APP_ENV must be development or production, got %q", cfg.Env))
	}
	if err := errors.Join(errs...); err != nil {
		return Config{}, fmt.Errorf("config: %w", err)
	}
	return cfg, nil
}

func (c Config) IsProduction() bool { return c.Env == "production" }

func getenv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func splitList(s string) []string {
	var out []string
	for _, part := range strings.Split(s, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
