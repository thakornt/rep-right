// Command api runs the rep-right HTTP API.
//
// Usage:
//
//	api              start the HTTP server (same as "api serve")
//	api migrate up   apply migrations (also: down, status, version, ...)
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/thakornt/rep-right/apps/api/internal/auth"
	"github.com/thakornt/rep-right/apps/api/internal/config"
	apihttp "github.com/thakornt/rep-right/apps/api/internal/http"
	"github.com/thakornt/rep-right/apps/api/internal/store"
)

func main() {
	if err := run(os.Args[1:]); err != nil {
		slog.Error("fatal", slog.Any("error", err))
		os.Exit(1)
	}
}

func run(args []string) error {
	// Local development: pick up the repo-root .env (real env vars still win).
	if wd, err := os.Getwd(); err == nil {
		if _, err := config.LoadDotEnv(wd); err != nil {
			return fmt.Errorf("load .env: %w", err)
		}
	}
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log := newLogger(cfg)
	slog.SetDefault(log)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	connectCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	pool, err := store.Open(connectCtx, cfg.DatabaseURL)
	cancel()
	if err != nil {
		return err
	}
	defer pool.Close()

	cmd := "serve"
	if len(args) > 0 {
		cmd = args[0]
	}
	switch cmd {
	case "serve":
		if err := cfg.ValidateServe(); err != nil {
			return err
		}
		verifier, err := auth.NewGoogleVerifier(cfg.GoogleClientID)
		if err != nil {
			return err
		}
		authSvc, err := auth.NewService(auth.Options{
			Store:    store.NewAuthStore(pool),
			Verifier: verifier,
			Secret:   []byte(cfg.JWTSecret),
		})
		if err != nil {
			return err
		}
		return serve(ctx, cfg, log, apihttp.Deps{
			Log:            log,
			DB:             pool,
			AllowedOrigins: cfg.AllowedOrigins,
			Version:        cfg.Version,
			Auth:           authSvc,
			Cookie:         apihttp.CookieConfig{Domain: cfg.CookieDomain, Secure: cfg.IsProduction()},
			Workouts:       store.NewWorkoutStore(pool),
		})
	case "migrate":
		if len(args) < 2 {
			return errors.New("usage: api migrate <up|down|status|version>")
		}
		return store.Migrate(ctx, pool, args[1], log)
	default:
		return fmt.Errorf("unknown command %q", cmd)
	}
}

func serve(ctx context.Context, cfg config.Config, log *slog.Logger, deps apihttp.Deps) error {
	if cfg.IsProduction() {
		gin.SetMode(gin.ReleaseMode)
	}
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           apihttp.NewRouter(deps), //nolint:contextcheck // handlers use each request's own context
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Info("listening", slog.String("addr", srv.Addr), slog.String("env", cfg.Env))
		errCh <- srv.ListenAndServe()
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), cfg.ShutdownTimeout)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}

func newLogger(cfg config.Config) *slog.Logger {
	var level slog.Level
	if err := level.UnmarshalText([]byte(cfg.LogLevel)); err != nil {
		level = slog.LevelInfo
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
}
