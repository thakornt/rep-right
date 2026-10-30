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
	// Version identifies the running build (commit SHA); "dev" locally.
	Version string

	GoogleClientID string
	JWTSecret      string
	CookieDomain   string // empty = host-only cookie (recommended)
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
		// Render sets RENDER_GIT_COMMIT; APP_VERSION works on any other host.
		Version: getenv("APP_VERSION", getenv("RENDER_GIT_COMMIT", "dev")),

		GoogleClientID: os.Getenv("GOOGLE_CLIENT_ID"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		CookieDomain:   os.Getenv("COOKIE_DOMAIN"),
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

// ValidateServe checks what only the HTTP server needs, so `api migrate`
// can run in CI with just DATABASE_URL.
func (c Config) ValidateServe() error {
	var errs []error
	if c.GoogleClientID == "" {
		errs = append(errs, errors.New("GOOGLE_CLIENT_ID is required"))
	}
	if len(c.JWTSecret) < 32 {
		errs = append(errs, errors.New("JWT_SECRET must be at least 32 characters (openssl rand -base64 48)"))
	}
	if err := errors.Join(errs...); err != nil {
		return fmt.Errorf("config: %w", err)
	}
	return nil
}

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
