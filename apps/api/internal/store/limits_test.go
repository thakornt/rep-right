package store

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/thakornt/rep-right/apps/api/internal/auth"
	"github.com/thakornt/rep-right/apps/api/internal/domain/workout"
	"github.com/thakornt/rep-right/apps/api/internal/store/dbgen"
)

func openTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
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
	return pool
}

func TestDailySessionLimit(t *testing.T) {
	pool := openTestDB(t)
	ctx := context.Background()
	q := dbgen.New(pool)
	u, err := q.CreateUser(ctx, dbgen.CreateUserParams{Email: "cap@example.com"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = q.DeleteUser(ctx, u.ID) })
	s := NewWorkoutStore(pool)
	squat, err := s.ExerciseBySlug(ctx, "barbell-squat")
	if err != nil {
		t.Fatal(err)
	}
	in := workout.Session{
		PerformedAt: time.Now().UTC().Truncate(24 * time.Hour),
		Sets:        []workout.Set{{ExerciseID: squat.ID, WeightKg: 60, Reps: 5}},
	}
	for i := range workout.MaxSessionsPerDay {
		if _, err := s.CreateSession(ctx, u.ID, in); err != nil {
			t.Fatalf("session %d: %v", i+1, err)
		}
	}
	if _, err := s.CreateSession(ctx, u.ID, in); !errors.Is(err, workout.ErrDailyLimit) {
		t.Fatalf("session past the cap: %v, want ErrDailyLimit", err)
	}
}

func TestPurgeRefreshTokens(t *testing.T) {
	pool := openTestDB(t)
	ctx := context.Background()
	q := dbgen.New(pool)
	u, err := q.CreateUser(ctx, dbgen.CreateUserParams{Email: "purge@example.com"})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = q.DeleteUser(ctx, u.ID) })
	s := NewAuthStore(pool)
	now := time.Now()

	insert := func(name string, expires time.Time) []byte {
		h := auth.HashRefreshToken(name + u.ID.String())
		if err := s.InsertRefreshToken(ctx, u.ID, h, expires); err != nil {
			t.Fatal(err)
		}
		return h
	}
	live := insert("live", now.Add(time.Hour))
	insert("expired", now.Add(-time.Hour))
	recent := insert("recently-revoked", now.Add(time.Hour))
	old := insert("long-revoked", now.Add(time.Hour))
	if err := s.RevokeRefreshToken(ctx, recent, now.Add(-time.Hour)); err != nil {
		t.Fatal(err)
	}
	if err := s.RevokeRefreshToken(ctx, old, now.Add(-RevokedTokenRetention-time.Hour)); err != nil {
		t.Fatal(err)
	}

	if _, err := s.PurgeRefreshTokens(ctx, now); err != nil {
		t.Fatal(err)
	}
	var left int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM refresh_tokens WHERE user_id = $1`, u.ID).Scan(&left); err != nil {
		t.Fatal(err)
	}
	if left != 2 {
		t.Errorf("tokens left = %d, want 2 (live and recently revoked)", left)
	}
	for _, h := range [][]byte{live, recent} {
		var n int
		_ = pool.QueryRow(ctx, `SELECT count(*) FROM refresh_tokens WHERE token_hash = $1`, h).Scan(&n)
		if n != 1 {
			t.Error("a token that should be kept was purged")
		}
	}
}
