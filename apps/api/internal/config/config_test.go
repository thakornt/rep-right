package config

import (
	"slices"
	"testing"
)

func TestLoadRequiresDatabaseURL(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	if _, err := Load(); err == nil {
		t.Fatal("expected error when DATABASE_URL is empty")
	}
}

func TestLoadDefaultsAndOrigins(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("APP_ENV", "")
	t.Setenv("ALLOWED_ORIGINS", " http://a.test , ,http://b.test")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.Port != "8080" || cfg.Env != "development" {
		t.Errorf("unexpected defaults: port=%q env=%q", cfg.Port, cfg.Env)
	}
	if want := []string{"http://a.test", "http://b.test"}; !slices.Equal(cfg.AllowedOrigins, want) {
		t.Errorf("AllowedOrigins = %v, want %v", cfg.AllowedOrigins, want)
	}
}

func TestLoadRejectsUnknownEnv(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("APP_ENV", "staging-ish")
	if _, err := Load(); err == nil {
		t.Fatal("expected error for unknown APP_ENV")
	}
}
