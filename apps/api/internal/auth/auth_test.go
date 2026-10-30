package auth

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

var secret = []byte("test-secret-test-secret-test-secret!!")

func newTestService(t *testing.T) (*Service, *memStore, *clock) {
	t.Helper()
	st := newMemStore()
	clk := &clock{t: time.Date(2026, 10, 30, 12, 0, 0, 0, time.UTC)}
	svc, err := NewService(Options{
		Store:    st,
		Verifier: fakeVerifier{id: GoogleIdentity{Subject: "g-1", Email: "a@example.com", Name: "A"}},
		Secret:   secret,
		Now:      clk.now,
	})
	if err != nil {
		t.Fatal(err)
	}
	return svc, st, clk
}

func TestNewServiceRejectsShortSecret(t *testing.T) {
	if _, err := NewService(Options{Store: newMemStore(), Verifier: fakeVerifier{}, Secret: []byte("short")}); err == nil {
		t.Fatal("expected error for a secret shorter than 32 bytes")
	}
}

func TestLoginWithGoogleIssuesSession(t *testing.T) {
	svc, st, clk := newTestService(t)
	ctx := context.Background()

	u, s, err := svc.LoginWithGoogle(ctx, "id-token")
	if err != nil {
		t.Fatal(err)
	}
	if u.Email != "a@example.com" || u.GoogleSub != "g-1" {
		t.Errorf("user = %+v", u)
	}
	if !s.AccessExpiresAt.Equal(clk.t.Add(15 * time.Minute)) {
		t.Errorf("access expiry = %v, want +15m", s.AccessExpiresAt)
	}
	if !s.RefreshExpiresAt.Equal(clk.t.Add(30 * 24 * time.Hour)) {
		t.Errorf("refresh expiry = %v, want +30d", s.RefreshExpiresAt)
	}
	if got, err := svc.ParseAccessToken(s.AccessToken); err != nil || got != u.ID {
		t.Errorf("ParseAccessToken = %v, %v; want %v", got, err, u.ID)
	}
	if st.activeTokens(u.ID) != 1 {
		t.Errorf("want 1 stored refresh token")
	}
	// Only the hash is stored, never the raw token.
	if st.find([]byte(s.RefreshToken)) != nil || st.find(HashRefreshToken(s.RefreshToken)) == nil {
		t.Error("refresh token must be stored as a hash")
	}
}

func TestLoginRejectsInvalidGoogleToken(t *testing.T) {
	svc, _, _ := newTestService(t)
	svc.verifier = fakeVerifier{err: errors.New("bad signature")}
	if _, _, err := svc.LoginWithGoogle(context.Background(), "x"); !errors.Is(err, ErrInvalidGoogleToken) {
		t.Fatalf("err = %v, want ErrInvalidGoogleToken", err)
	}
}

func TestAccessTokenExpiresAfter15Minutes(t *testing.T) {
	svc, _, clk := newTestService(t)
	_, s, _ := svc.LoginWithGoogle(context.Background(), "x")

	clk.advance(14 * time.Minute)
	if _, err := svc.ParseAccessToken(s.AccessToken); err != nil {
		t.Fatalf("token should still be valid: %v", err)
	}
	clk.advance(2 * time.Minute)
	if _, err := svc.ParseAccessToken(s.AccessToken); !errors.Is(err, ErrInvalidAccessToken) {
		t.Fatalf("err = %v, want ErrInvalidAccessToken", err)
	}
}

func TestParseAccessTokenRejectsTampering(t *testing.T) {
	svc, _, clk := newTestService(t)
	sign := func(method jwt.SigningMethod, key any, claims jwt.RegisteredClaims) string {
		s, err := jwt.NewWithClaims(method, claims).SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	good := jwt.RegisteredClaims{
		Subject:   uuid.NewString(),
		Issuer:    issuer,
		Audience:  jwt.ClaimStrings{audience},
		ExpiresAt: jwt.NewNumericDate(clk.t.Add(time.Minute)),
	}
	wrongAud := good
	wrongAud.Audience = jwt.ClaimStrings{"someone-else"}
	badSub := good
	badSub.Subject = "not-a-uuid"

	cases := map[string]string{
		"other secret":   sign(jwt.SigningMethodHS256, []byte(strings.Repeat("x", 40)), good),
		"alg none":       sign(jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, good),
		"wrong audience": sign(jwt.SigningMethodHS256, secret, wrongAud),
		"bad subject":    sign(jwt.SigningMethodHS256, secret, badSub),
		"garbage":        "a.b.c",
	}
	for name, tok := range cases {
		if _, err := svc.ParseAccessToken(tok); !errors.Is(err, ErrInvalidAccessToken) {
			t.Errorf("%s: err = %v, want ErrInvalidAccessToken", name, err)
		}
	}
	if _, err := svc.ParseAccessToken(sign(jwt.SigningMethodHS256, secret, good)); err != nil {
		t.Errorf("valid token rejected: %v", err)
	}
}

func TestRefreshRotatesToken(t *testing.T) {
	svc, st, clk := newTestService(t)
	ctx := context.Background()
	u, s1, _ := svc.LoginWithGoogle(ctx, "x")

	clk.advance(time.Hour)
	s2, err := svc.Refresh(ctx, s1.RefreshToken)
	if err != nil {
		t.Fatal(err)
	}
	if s2.RefreshToken == s1.RefreshToken {
		t.Fatal("refresh must issue a new refresh token")
	}
	if got, err := svc.ParseAccessToken(s2.AccessToken); err != nil || got != u.ID {
		t.Errorf("new access token: %v, %v", got, err)
	}
	if !s2.RefreshExpiresAt.Equal(clk.t.Add(30 * 24 * time.Hour)) {
		t.Errorf("rotated refresh expiry = %v", s2.RefreshExpiresAt)
	}
	if st.activeTokens(u.ID) != 1 {
		t.Errorf("old token must be revoked after rotation; active = %d", st.activeTokens(u.ID))
	}
}

func TestRefreshUnknownOrExpired(t *testing.T) {
	svc, _, clk := newTestService(t)
	ctx := context.Background()

	if _, err := svc.Refresh(ctx, "never-issued"); !errors.Is(err, ErrInvalidRefreshToken) {
		t.Errorf("unknown token: err = %v", err)
	}
	if _, err := svc.Refresh(ctx, ""); !errors.Is(err, ErrInvalidRefreshToken) {
		t.Errorf("empty token: err = %v", err)
	}

	_, s, _ := svc.LoginWithGoogle(ctx, "x")
	clk.advance(30*24*time.Hour + time.Second)
	if _, err := svc.Refresh(ctx, s.RefreshToken); !errors.Is(err, ErrInvalidRefreshToken) {
		t.Errorf("expired token: err = %v", err)
	}
}

func TestRefreshReuseRevokesAllSessions(t *testing.T) {
	svc, st, clk := newTestService(t)
	ctx := context.Background()
	u, s1, _ := svc.LoginWithGoogle(ctx, "x")
	_, other, _ := svc.LoginWithGoogle(ctx, "x") // a second device

	s2, err := svc.Refresh(ctx, s1.RefreshToken)
	if err != nil {
		t.Fatal(err)
	}

	// An attacker replays the stolen, already-rotated token later.
	clk.advance(time.Hour)
	if _, err := svc.Refresh(ctx, s1.RefreshToken); !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("reuse: err = %v, want ErrInvalidRefreshToken", err)
	}
	if n := st.activeTokens(u.ID); n != 0 {
		t.Errorf("reuse must revoke every session of the user; %d still active", n)
	}
	for _, tok := range []string{s2.RefreshToken, other.RefreshToken} {
		if _, err := svc.Refresh(ctx, tok); !errors.Is(err, ErrInvalidRefreshToken) {
			t.Errorf("token still usable after reuse detection: %v", err)
		}
	}
}

func TestRefreshReuseWithinGraceDoesNotRevokeAll(t *testing.T) {
	svc, st, clk := newTestService(t)
	ctx := context.Background()
	u, s1, _ := svc.LoginWithGoogle(ctx, "x")

	s2, _ := svc.Refresh(ctx, s1.RefreshToken)
	// A second tab raced the first one with the same cookie.
	clk.advance(5 * time.Second)
	if _, err := svc.Refresh(ctx, s1.RefreshToken); !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("err = %v, want ErrInvalidRefreshToken", err)
	}
	if st.activeTokens(u.ID) != 1 {
		t.Fatal("a race inside the grace window must not log the user out everywhere")
	}
	if _, err := svc.Refresh(ctx, s2.RefreshToken); err != nil {
		t.Errorf("the winning token should still work: %v", err)
	}
}

func TestRefreshAfterLogoutIsNotTreatedAsReuse(t *testing.T) {
	svc, st, clk := newTestService(t)
	ctx := context.Background()
	u, s1, _ := svc.LoginWithGoogle(ctx, "x")
	_, other, _ := svc.LoginWithGoogle(ctx, "x")

	if err := svc.Logout(ctx, s1.RefreshToken); err != nil {
		t.Fatal(err)
	}
	clk.advance(time.Hour)
	if _, err := svc.Refresh(ctx, s1.RefreshToken); !errors.Is(err, ErrInvalidRefreshToken) {
		t.Fatalf("err = %v", err)
	}
	if st.activeTokens(u.ID) != 1 {
		t.Error("using a logged-out token must not revoke other devices")
	}
	if _, err := svc.Refresh(ctx, other.RefreshToken); err != nil {
		t.Errorf("other device should stay logged in: %v", err)
	}
}

func TestLogoutIsIdempotent(t *testing.T) {
	svc, _, _ := newTestService(t)
	ctx := context.Background()
	for _, tok := range []string{"", "unknown"} {
		if err := svc.Logout(ctx, tok); err != nil {
			t.Errorf("Logout(%q) = %v", tok, err)
		}
	}
}

func TestConcurrentRefreshOnlyOneWins(t *testing.T) {
	svc, _, _ := newTestService(t)
	ctx := context.Background()
	_, s, _ := svc.LoginWithGoogle(ctx, "x")

	const n = 8
	var wg sync.WaitGroup
	var mu sync.Mutex
	wins := 0
	for range n {
		wg.Go(func() {
			if _, err := svc.Refresh(ctx, s.RefreshToken); err == nil {
				mu.Lock()
				wins++
				mu.Unlock()
			}
		})
	}
	wg.Wait()
	if wins != 1 {
		t.Fatalf("%d concurrent refreshes succeeded, want exactly 1", wins)
	}
}

func TestDeleteAccountRemovesUserAndTokens(t *testing.T) {
	svc, st, _ := newTestService(t)
	ctx := context.Background()
	u, s, _ := svc.LoginWithGoogle(ctx, "x")

	if err := svc.DeleteAccount(ctx, u.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Me(ctx, u.ID); !errors.Is(err, ErrUserNotFound) {
		t.Errorf("Me after delete: err = %v", err)
	}
	if _, err := svc.Refresh(ctx, s.RefreshToken); !errors.Is(err, ErrInvalidRefreshToken) {
		t.Errorf("refresh after delete: err = %v", err)
	}
	if st.activeTokens(u.ID) != 0 {
		t.Error("tokens must be gone with the user")
	}
}

func TestNewRefreshTokenIsRandomAndHashed(t *testing.T) {
	a, ha, err := newRefreshToken()
	if err != nil {
		t.Fatal(err)
	}
	b, _, _ := newRefreshToken()
	if a == b || len(a) < 40 {
		t.Errorf("tokens should be long and unique: %q %q", a, b)
	}
	if string(ha) != string(HashRefreshToken(a)) || len(ha) != 32 {
		t.Error("hash must be the SHA-256 of the raw token")
	}
}
