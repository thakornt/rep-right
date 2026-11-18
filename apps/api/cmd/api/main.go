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
		authStore := store.NewAuthStore(pool)
		opts := auth.Options{
			Store:    authStore,
			Verifier: verifier,
			Secret:   []byte(cfg.JWTSecret),
		}
		if cfg.GoogleClientSecret != "" {
			opts.GoogleCode = auth.NewGoogleCodeExchanger(cfg.GoogleClientID, cfg.GoogleClientSecret)
		}
		if cfg.LineChannelID != "" {
			opts.Line = auth.NewLineClient(cfg.LineChannelID, cfg.LineChannelSecret)
		}
		lim := limits(cfg.Limits)
		log.Info("limits",
			slog.String("per_ip", fmt.Sprintf("%d/min burst %d", lim.PerIP.PerMinute, lim.PerIP.Burst)),
			slog.String("auth", fmt.Sprintf("%d/min burst %d", lim.Auth.PerMinute, lim.Auth.Burst)),
			slog.String("per_user", fmt.Sprintf("%d/min burst %d", lim.PerUser.PerMinute, lim.PerUser.Burst)),
			slog.Int("max_in_flight", lim.MaxInFlight))
		log.Info("sign-in providers",
			slog.Bool("google_code", opts.GoogleCode != nil), slog.Bool("line", opts.Line != nil))
		authSvc, err := auth.NewService(opts)
		if err != nil {
			return err
		}
		go purgeRefreshTokens(ctx, authStore, log)
		return serve(ctx, cfg, log, apihttp.Deps{
			Log:            log,
			DB:             pool,
			AllowedOrigins: cfg.AllowedOrigins,
			Version:        cfg.Version,
			Auth:           authSvc,
			Cookie:         apihttp.CookieConfig{Domain: cfg.CookieDomain, Secure: cfg.IsProduction()},
			Workouts:       store.NewWorkoutStore(pool),
			Programs:       store.NewProgramStore(pool),
			ProxySecret:    cfg.ProxySecret,
			Limits:         lim,
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

// limits starts from the API's defaults and applies what the environment set.
func limits(c config.Limits) apihttp.Limits {
	l := apihttp.DefaultLimits()
	set := func(dst *int, v int) {
		if v > 0 {
			*dst = v
		}
	}
	set(&l.PerIP.PerMinute, c.IPPerMinute)
	set(&l.PerIP.Burst, c.IPBurst)
	set(&l.Auth.PerMinute, c.AuthPerMinute)
	set(&l.Auth.Burst, c.AuthBurst)
	set(&l.PerUser.PerMinute, c.UserPerMinute)
	set(&l.PerUser.Burst, c.UserBurst)
	set(&l.MaxInFlight, c.MaxInFlight)
	return l
}

// purgeRefreshTokens deletes dead refresh tokens now and then every hour.
// Every instance may run it; the DELETE is idempotent.
func purgeRefreshTokens(ctx context.Context, s *store.AuthStore, log *slog.Logger) {
	t := time.NewTicker(time.Hour)
	defer t.Stop()
	for {
		runCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
		n, err := s.PurgeRefreshTokens(runCtx, time.Now())
		cancel()
		if err != nil && ctx.Err() == nil {
			log.Warn("purge refresh tokens", slog.Any("error", err))
		} else if n > 0 {
			log.Info("purged refresh tokens", slog.Int64("rows", n))
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

func newLogger(cfg config.Config) *slog.Logger {
	var level slog.Level
	if err := level.UnmarshalText([]byte(cfg.LogLevel)); err != nil {
		level = slog.LevelInfo
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level}))
}
