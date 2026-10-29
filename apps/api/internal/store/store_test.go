package store

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/thakornt/rep-right/apps/api/internal/store/dbgen"
)

// TestMigrationsAndUserQueries runs against a real Postgres. It is skipped
// unless TEST_DATABASE_URL is set (CI and `make test-db` set it).
func TestMigrationsAndUserQueries(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	pool, err := Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)

	// Down then up proves both directions of every migration work.
	if err := Migrate(ctx, pool, "up", log); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, pool, "reset", log); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, pool, "up", log); err != nil {
		t.Fatal(err)
	}

	q := dbgen.New(pool)
	u, err := q.UpsertUserByGoogleSub(ctx, dbgen.UpsertUserByGoogleSubParams{
		GoogleSub: "sub-123", Email: "a@example.com", DisplayName: "A",
	})
	if err != nil {
		t.Fatal(err)
	}
	u2, err := q.UpsertUserByGoogleSub(ctx, dbgen.UpsertUserByGoogleSubParams{
		GoogleSub: "sub-123", Email: "b@example.com", DisplayName: "B",
	})
	if err != nil {
		t.Fatal(err)
	}
	if u2.ID != u.ID || u2.Email != "b@example.com" {
		t.Errorf("upsert should update the same user, got %+v", u2)
	}

	if _, err := pool.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, 'x', now() + interval '1 day')`,
		u.ID); err != nil {
		t.Fatal(err)
	}
	if err := q.DeleteUser(ctx, u.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := q.GetUserByID(ctx, u.ID); !errors.Is(err, pgx.ErrNoRows) {
		t.Errorf("GetUserByID after delete: err = %v, want ErrNoRows", err)
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM refresh_tokens WHERE user_id = $1`, u.ID).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 0 {
		t.Errorf("refresh tokens not cascaded on user delete: %d left", n)
	}
}
