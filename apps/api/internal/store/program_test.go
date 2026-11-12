package store

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"

	"github.com/thakornt/rep-right/apps/api/internal/auth"
	"github.com/thakornt/rep-right/apps/api/internal/store/dbgen"
)

// TestProgramStore runs against a real Postgres, like TestMigrationsAndUserQueries.
func TestProgramStore(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := Migrate(ctx, pool, "up", slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}

	users := NewAuthStore(pool)
	u, err := users.UpsertIdentity(ctx, auth.Identity{Provider: auth.ProviderGoogle, Subject: "program-sub", Email: "p@example.com", Name: "P"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = users.DeleteUser(context.Background(), u.ID) })

	st := NewProgramStore(pool)
	if got, err := st.Program(ctx, u.ID); err != nil || got != "" {
		t.Fatalf("new user program = %q, %v; want none", got, err)
	}
	if err := st.SetProgram(ctx, u.ID, "ppl-2"); err != nil {
		t.Fatal(err)
	}
	if got, _ := st.Program(ctx, u.ID); got != "ppl-2" {
		t.Errorf("after set = %q", got)
	}
	if err := st.SetProgram(ctx, u.ID, ""); err != nil {
		t.Fatal(err)
	}
	if got, _ := st.Program(ctx, u.ID); got != "" {
		t.Errorf("after clear = %q", got)
	}

	// PDPA: deleting the account must leave no trace of the choice.
	if err := st.SetProgram(ctx, u.ID, "upper-lower"); err != nil {
		t.Fatal(err)
	}
	if err := users.DeleteUser(ctx, u.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := dbgen.New(pool).GetUserProgram(ctx, u.ID); !errors.Is(err, pgx.ErrNoRows) {
		t.Errorf("program still readable after account deletion: %v", err)
	}
	var n int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM users WHERE program_id = 'upper-lower' AND id = $1`, u.ID).Scan(&n); err != nil || n != 0 {
		t.Errorf("rows left = %d, %v", n, err)
	}
}
