package store

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/thakornt/rep-right/apps/api/internal/auth"
)

type stubVerifier struct{ id auth.GoogleIdentity }

func (s stubVerifier) Verify(context.Context, string) (auth.GoogleIdentity, error) { return s.id, nil }

// TestAuthStoreWithService runs the real auth flow against Postgres, which is
// what proves the row lock and the reuse revocation commit as intended.
func TestAuthStoreWithService(t *testing.T) {
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

	now := time.Now()
	var clockMu sync.Mutex
	svc, err := auth.NewService(auth.Options{
		Store:    NewAuthStore(pool),
		Verifier: stubVerifier{auth.GoogleIdentity{Subject: "store-auth-" + now.Format(time.RFC3339Nano), Email: "s@example.com", Name: "S"}},
		Secret:   []byte("0123456789abcdef0123456789abcdef"),
		Now:      func() time.Time { clockMu.Lock(); defer clockMu.Unlock(); return now },
	})
	if err != nil {
		t.Fatal(err)
	}
	advance := func(d time.Duration) { clockMu.Lock(); now = now.Add(d); clockMu.Unlock() }

	u, s1, err := svc.LoginWithGoogle(ctx, "x")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = svc.DeleteAccount(context.Background(), u.ID) })

	if me, err := svc.Me(ctx, u.ID); err != nil || me.Email != "s@example.com" {
		t.Fatalf("Me = %+v, %v", me, err)
	}

	// Concurrent refreshes of one token: the row lock lets exactly one win.
	var wins atomic.Int32
	var wg sync.WaitGroup
	results := make(chan auth.Session, 8)
	for range 8 {
		wg.Go(func() {
			if s, err := svc.Refresh(ctx, s1.RefreshToken); err == nil {
				wins.Add(1)
				results <- s
			}
		})
	}
	wg.Wait()
	close(results)
	if wins.Load() != 1 {
		t.Fatalf("%d concurrent refreshes succeeded, want 1", wins.Load())
	}
	s2 := <-results

	// Replaying the rotated token after the grace window revokes everything,
	// and that revocation must survive the transaction.
	advance(time.Minute)
	if _, err := svc.Refresh(ctx, s1.RefreshToken); !errors.Is(err, auth.ErrInvalidRefreshToken) {
		t.Fatalf("reuse: err = %v", err)
	}
	if _, err := svc.Refresh(ctx, s2.RefreshToken); !errors.Is(err, auth.ErrInvalidRefreshToken) {
		t.Fatalf("successor still valid after reuse detection: %v", err)
	}

	// Logout revokes; a fresh login works again.
	_, s3, err := svc.LoginWithGoogle(ctx, "x")
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Logout(ctx, s3.RefreshToken); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Refresh(ctx, s3.RefreshToken); !errors.Is(err, auth.ErrInvalidRefreshToken) {
		t.Fatalf("refresh after logout: err = %v", err)
	}

	if err := svc.DeleteAccount(ctx, u.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Me(ctx, u.ID); !errors.Is(err, auth.ErrUserNotFound) {
		t.Fatalf("Me after delete: err = %v", err)
	}
}
