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

type stubVerifier struct{ id auth.Identity }

func (s stubVerifier) Verify(context.Context, string) (auth.Identity, error) { return s.id, nil }

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
		Verifier: stubVerifier{auth.Identity{Provider: auth.ProviderGoogle, Subject: "store-auth-" + now.Format(time.RFC3339Nano), Email: "s@example.com", Name: "S"}},
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

	live := func() int {
		var n int
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL`, u.ID).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}

	// Concurrent refreshes of one token (tabs racing): the row locks serialise
	// them, none signs the user out, and exactly one token stays live.
	var wins atomic.Int32
	var wg sync.WaitGroup
	for range 8 {
		wg.Go(func() {
			_, err := svc.Refresh(ctx, s1.RefreshToken)
			switch {
			case err == nil:
				wins.Add(1)
			case !errors.Is(err, auth.ErrRefreshRaced):
				t.Errorf("concurrent refresh: %v", err)
			}
		})
	}
	wg.Wait()
	if wins.Load() < 1 {
		t.Fatal("no concurrent refresh succeeded")
	}
	if n := live(); n != 1 {
		t.Fatalf("%d live tokens after racing refreshes, want 1", n)
	}

	// A lost response: the API rotated the token but the browser never got
	// the new cookie. Its next visit, with the old cookie, still works.
	advance(time.Hour)
	_, s2, err := svc.LoginWithGoogle(ctx, "x")
	if err != nil {
		t.Fatal(err)
	}
	lost, err := svc.Refresh(ctx, s2.RefreshToken)
	if err != nil {
		t.Fatal(err)
	}
	advance(24 * time.Hour)
	s3, err := svc.Refresh(ctx, s2.RefreshToken)
	if err != nil {
		t.Fatalf("old cookie after a lost response: %v", err)
	}
	if _, err := svc.Refresh(ctx, s3.RefreshToken); err != nil {
		t.Fatalf("recovered session: %v", err)
	}

	// Once the replacement has been used, the lost token turning up means
	// someone else has it: everything is revoked, and that survives the
	// transaction.
	advance(time.Hour)
	if _, err := svc.Refresh(ctx, lost.RefreshToken); !errors.Is(err, auth.ErrInvalidRefreshToken) {
		t.Fatalf("reuse: err = %v", err)
	}
	if n := live(); n != 0 {
		t.Fatalf("%d live tokens after reuse detection, want 0", n)
	}

	// Logout revokes; a fresh login works again.
	_, s4, err := svc.LoginWithGoogle(ctx, "x")
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.Logout(ctx, s4.RefreshToken); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Refresh(ctx, s4.RefreshToken); !errors.Is(err, auth.ErrInvalidRefreshToken) {
		t.Fatalf("refresh after logout: err = %v", err)
	}

	if err := svc.DeleteAccount(ctx, u.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Me(ctx, u.ID); !errors.Is(err, auth.ErrUserNotFound) {
		t.Fatalf("Me after delete: err = %v", err)
	}
}
