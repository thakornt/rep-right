// Package config loads service configuration from environment variables.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
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
	// GoogleClientSecret enables our own Google button (GIS code client);
	// without it the web falls back to Google's rendered button.
	GoogleClientSecret string
	// LINE Login channel; both empty = LINE sign-in off (button hidden).
	LineChannelID     string
	LineChannelSecret string
	JWTSecret         string
	CookieDomain      string // empty = host-only cookie (recommended)
	// ProxySecret is shared with the web's /api proxy; the API refuses
	// requests without it. Required in production, optional locally.
	ProxySecret string
	// Limits overrides the API's flood protection; 0 = the built-in default.
	Limits Limits
}

// Limits are the RATE_LIMIT_* and MAX_IN_FLIGHT variables. Rates are requests
// per minute; bursts are how many may arrive at once. Every value is optional.
type Limits struct {
	IPPerMinute   int // RATE_LIMIT_IP_PER_MIN    every request, per client IP
	IPBurst       int // RATE_LIMIT_IP_BURST
	AuthPerMinute int // RATE_LIMIT_AUTH_PER_MIN  sign-in and refresh, per client IP
	AuthBurst     int // RATE_LIMIT_AUTH_BURST
	UserPerMinute int // RATE_LIMIT_USER_PER_MIN  signed-in routes, per user
	UserBurst     int // RATE_LIMIT_USER_BURST
	MaxInFlight   int // MAX_IN_FLIGHT            concurrent requests before 503
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

		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		LineChannelID:      os.Getenv("LINE_CHANNEL_ID"),
		LineChannelSecret:  os.Getenv("LINE_CHANNEL_SECRET"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
		CookieDomain:       os.Getenv("COOKIE_DOMAIN"),
		ProxySecret:        os.Getenv("PROXY_SECRET"),
	}

	var errs []error
	for _, v := range []struct {
		key string
		dst *int
	}{
		{"RATE_LIMIT_IP_PER_MIN", &cfg.Limits.IPPerMinute},
		{"RATE_LIMIT_IP_BURST", &cfg.Limits.IPBurst},
		{"RATE_LIMIT_AUTH_PER_MIN", &cfg.Limits.AuthPerMinute},
		{"RATE_LIMIT_AUTH_BURST", &cfg.Limits.AuthBurst},
		{"RATE_LIMIT_USER_PER_MIN", &cfg.Limits.UserPerMinute},
		{"RATE_LIMIT_USER_BURST", &cfg.Limits.UserBurst},
		{"MAX_IN_FLIGHT", &cfg.Limits.MaxInFlight},
	} {
		raw := strings.TrimSpace(os.Getenv(v.key))
		if raw == "" {
			continue
		}
		n, err := strconv.Atoi(raw)
		if err != nil || n <= 0 {
			errs = append(errs, fmt.Errorf("%s must be a positive whole number, got %q", v.key, raw))
			continue
		}
		*v.dst = n
	}
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
	if (c.LineChannelID == "") != (c.LineChannelSecret == "") {
		errs = append(errs, errors.New("set both LINE_CHANNEL_ID and LINE_CHANNEL_SECRET, or neither"))
	}
	if len(c.JWTSecret) < 32 {
		errs = append(errs, errors.New("JWT_SECRET must be at least 32 characters (openssl rand -base64 48)"))
	}
	if (c.IsProduction() || c.ProxySecret != "") && len(c.ProxySecret) < 32 {
		errs = append(errs, errors.New("PROXY_SECRET must be at least 32 characters in production (openssl rand -base64 48), the same value as on the web"))
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
