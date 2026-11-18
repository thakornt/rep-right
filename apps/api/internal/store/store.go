// Package store owns database access: the pgx pool, migrations and the
// sqlc-generated queries in dbgen.
package store

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/thakornt/rep-right/apps/api/db"
)

// defaultMaxConns replaces pgx's default (4 on a small container), which made
// requests queue for a connection under load. pool_max_conns in the URL wins.
const defaultMaxConns = 10

// Open creates a pgx connection pool and verifies it can reach the database.
func Open(ctx context.Context, databaseURL string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse database url: %w", err)
	}
	if !strings.Contains(databaseURL, "pool_max_conns") {
		cfg.MaxConns = defaultMaxConns
	}
	cfg.MaxConnIdleTime = 5 * time.Minute
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("open pool: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return pool, nil
}

// Migrate runs a goose command ("up", "down", "status", ...) against the
// embedded migrations.
func Migrate(ctx context.Context, pool *pgxpool.Pool, command string, log *slog.Logger, args ...string) error {
	sqlDB := stdlib.OpenDBFromPool(pool)
	defer func(d *sql.DB) { _ = d.Close() }(sqlDB)

	goose.SetBaseFS(db.Migrations)
	goose.SetLogger(gooseLogger{log})
	if err := goose.SetDialect("postgres"); err != nil {
		return err
	}
	if err := goose.RunContext(ctx, command, sqlDB, "migrations", args...); err != nil {
		return fmt.Errorf("goose %s: %w", command, err)
	}
	return nil
}

type gooseLogger struct{ log *slog.Logger }

func (g gooseLogger) Fatalf(format string, v ...any) { g.log.Error(fmt.Sprintf(format, v...)) }
func (g gooseLogger) Printf(format string, v ...any) { g.log.Info(fmt.Sprintf(format, v...)) }
