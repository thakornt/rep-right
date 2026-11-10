package store

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/thakornt/rep-right/apps/api/internal/auth"
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
	st := NewAuthStore(pool)
	au, err := st.UpsertIdentity(ctx, auth.Identity{Provider: auth.ProviderGoogle, Subject: "sub-123", Email: "a@example.com", Name: "A"})
	if err != nil {
		t.Fatal(err)
	}
	au2, err := st.UpsertIdentity(ctx, auth.Identity{Provider: auth.ProviderGoogle, Subject: "sub-123", Email: "b@example.com", Name: "B"})
	if err != nil {
		t.Fatal(err)
	}
	if au2.ID != au.ID || au2.Email != "b@example.com" || au2.DisplayName != "A" {
		t.Errorf("upsert should update the same user's email but keep its name, got %+v", au2)
	}
	if len(au2.Providers) != 1 || au2.Providers[0] != auth.ProviderGoogle {
		t.Errorf("providers = %v", au2.Providers)
	}
	named, err := st.SetDisplayName(ctx, au.ID, "ต้น")
	if err != nil || named.DisplayName != "ต้น" {
		t.Errorf("SetDisplayName = %+v, %v", named, err)
	}
	if _, err := st.SetDisplayName(ctx, uuid.New(), "x"); !errors.Is(err, auth.ErrUserNotFound) {
		t.Errorf("SetDisplayName unknown user err = %v", err)
	}
	pic, err := st.UpsertIdentity(ctx, auth.Identity{Provider: auth.ProviderGoogle, Subject: "sub-123", Email: "b@example.com", Name: "B",
		Picture: "https://lh3.googleusercontent.com/a/p"})
	if err != nil || pic.PictureURL != "https://lh3.googleusercontent.com/a/p" || pic.DisplayName != "ต้น" {
		t.Errorf("picture refresh = %+v, %v", pic, err)
	}
	// Same subject from another provider is another person.
	line, err := st.UpsertIdentity(ctx, auth.Identity{Provider: auth.ProviderLine, Subject: "sub-123", Name: "L"})
	if err != nil {
		t.Fatal(err)
	}
	if line.ID == au.ID || line.Email != "" {
		t.Errorf("LINE identity with the same subject attached to %v (email %q)", line.ID, line.Email)
	}
	// LINE without email permission must not blank the email we have.
	au3, err := st.UpsertIdentity(ctx, auth.Identity{Provider: auth.ProviderGoogle, Subject: "sub-123", Email: "", Name: "B"})
	if err != nil || au3.Email != "b@example.com" {
		t.Errorf("empty email overwrote the stored one: %+v, %v", au3, err)
	}
	u, err := q.GetUserByID(ctx, au.ID)
	if err != nil {
		t.Fatal(err)
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

// TestIdentityMigrationKeepsGoogleUsers checks 00006 against data shaped like
// production before it: users keyed by google_sub.
func TestIdentityMigrationKeepsGoogleUsers(t *testing.T) {
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
	t.Cleanup(func() { _ = Migrate(context.Background(), pool, "up", log) })

	if err := Migrate(ctx, pool, "up", log); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, pool, "down-to", log, "5"); err != nil {
		t.Fatal(err)
	}
	var id string
	if err := pool.QueryRow(ctx,
		`INSERT INTO users (google_sub, email, display_name) VALUES ('legacy-sub', 'old@example.com', 'Old') RETURNING id`,
	).Scan(&id); err != nil {
		t.Fatal(err)
	}
	if err := Migrate(ctx, pool, "up", log); err != nil {
		t.Fatal(err)
	}
	u, err := NewAuthStore(pool).UpsertIdentity(ctx, auth.Identity{Provider: auth.ProviderGoogle, Subject: "legacy-sub", Email: "old@example.com", Name: "Old"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = dbgen.New(pool).DeleteUser(context.Background(), u.ID) })
	if u.ID.String() != id {
		t.Errorf("existing Google user got a new account %v, want %v", u.ID, id)
	}
}
