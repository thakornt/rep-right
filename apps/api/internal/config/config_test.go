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

func TestVersionPrefersAppVersion(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("RENDER_GIT_COMMIT", "render-sha")

	t.Setenv("APP_VERSION", "")
	if cfg, _ := Load(); cfg.Version != "render-sha" {
		t.Errorf("Version = %q, want render-sha", cfg.Version)
	}
	t.Setenv("APP_VERSION", "app-sha")
	if cfg, _ := Load(); cfg.Version != "app-sha" {
		t.Errorf("Version = %q, want app-sha", cfg.Version)
	}
}

func TestValidateServe(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("GOOGLE_CLIENT_ID", "")
	t.Setenv("JWT_SECRET", "too-short")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load must not need auth settings (migrate runs without them): %v", err)
	}
	if err := cfg.ValidateServe(); err == nil {
		t.Fatal("expected error for missing client ID and short secret")
	}

	t.Setenv("GOOGLE_CLIENT_ID", "id.apps.googleusercontent.com")
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	cfg, _ = Load()
	if err := cfg.ValidateServe(); err != nil {
		t.Fatalf("ValidateServe: %v", err)
	}
}
