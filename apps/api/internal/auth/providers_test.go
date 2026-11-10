package auth

import (
	"context"
	"errors"
	"net/url"
	"testing"
)

func newProviderService(t *testing.T, st *memStore) *Service {
	t.Helper()
	svc, err := NewService(Options{
		Store:      st,
		Verifier:   fakeVerifier{id: Identity{Provider: ProviderGoogle, Subject: "g-1", Email: "a@example.com", Name: "A"}},
		GoogleCode: fakeCode{},
		Line:       fakeLine{id: Identity{Provider: ProviderLine, Subject: "U-1", Email: "a@example.com", Name: "LINE A"}},
		Secret:     secret,
	})
	if err != nil {
		t.Fatal(err)
	}
	return svc
}

func TestProvidersReflectsOptions(t *testing.T) {
	off, _, _ := newTestService(t)
	if p := off.Providers(); p.GoogleCode || p.Line {
		t.Errorf("no exchanger and no LINE client: Providers = %+v", p)
	}
	on := newProviderService(t, newMemStore())
	if p := on.Providers(); !p.GoogleCode || !p.Line {
		t.Errorf("both configured: Providers = %+v", p)
	}
}

func TestDisabledProvidersAreRejected(t *testing.T) {
	svc, _, _ := newTestService(t)
	ctx := context.Background()
	if _, _, err := svc.LoginWithGoogleCode(ctx, "c1"); !errors.Is(err, ErrProviderDisabled) {
		t.Errorf("LoginWithGoogleCode err = %v, want ErrProviderDisabled", err)
	}
	if _, err := svc.StartLine("https://app/cb"); !errors.Is(err, ErrProviderDisabled) {
		t.Errorf("StartLine err = %v, want ErrProviderDisabled", err)
	}
	if _, _, err := svc.LoginWithLine(ctx, "l1", "https://app/cb", "n1"); !errors.Is(err, ErrProviderDisabled) {
		t.Errorf("LoginWithLine err = %v, want ErrProviderDisabled", err)
	}
}

func TestGoogleCodeSignsInSameUserAsIDToken(t *testing.T) {
	st := newMemStore()
	svc := newProviderService(t, st)
	ctx := context.Background()

	byToken, _, err := svc.LoginWithGoogle(ctx, "id-token")
	if err != nil {
		t.Fatal(err)
	}
	byCode, s, err := svc.LoginWithGoogleCode(ctx, "c1")
	if err != nil {
		t.Fatal(err)
	}
	if byCode.ID != byToken.ID {
		t.Errorf("code sign-in made a new user %v, want existing %v", byCode.ID, byToken.ID)
	}
	if st.activeTokens(byCode.ID) != 2 || s.RefreshToken == "" {
		t.Errorf("code sign-in should start its own session")
	}
	if _, _, err := svc.LoginWithGoogleCode(ctx, "bad"); !errors.Is(err, ErrInvalidGoogleToken) {
		t.Errorf("bad code err = %v, want ErrInvalidGoogleToken", err)
	}
}

func TestStartLineGivesFreshStateAndNonce(t *testing.T) {
	svc := newProviderService(t, newMemStore())
	a, err := svc.StartLine("https://app/cb")
	if err != nil {
		t.Fatal(err)
	}
	b, _ := svc.StartLine("https://app/cb")
	if len(a.State) < 40 || len(a.Nonce) < 40 || a.State == a.Nonce {
		t.Errorf("state/nonce too short or equal: %+v", a)
	}
	if a.State == b.State || a.Nonce == b.Nonce {
		t.Error("state and nonce must differ per start")
	}
	u, err := url.Parse(a.URL)
	if err != nil {
		t.Fatal(err)
	}
	if q := u.Query(); q.Get("state") != a.State || q.Get("nonce") != a.Nonce || q.Get("redirect_uri") != "https://app/cb" {
		t.Errorf("auth URL %q does not carry state, nonce and redirect", a.URL)
	}
}

func TestLineUserIsSeparateFromGoogleUserWithSameEmail(t *testing.T) {
	st := newMemStore()
	svc := newProviderService(t, st)
	ctx := context.Background()

	g, _, err := svc.LoginWithGoogle(ctx, "id-token")
	if err != nil {
		t.Fatal(err)
	}
	l, s, err := svc.LoginWithLine(ctx, "l1", "https://app/cb", "n1")
	if err != nil {
		t.Fatal(err)
	}
	// Linking by email would let whoever controls a LINE account with that
	// address into the Google user's data.
	if l.ID == g.ID {
		t.Fatal("LINE sign-in must not attach to a Google user by email")
	}
	if got, err := svc.ParseAccessToken(s.AccessToken); err != nil || got != l.ID {
		t.Errorf("LINE session belongs to %v (%v), want %v", got, err, l.ID)
	}
	again, _, err := svc.LoginWithLine(ctx, "l1", "https://app/cb", "n1")
	if err != nil || again.ID != l.ID {
		t.Errorf("second LINE sign-in = %v, %v; want same user %v", again.ID, err, l.ID)
	}
}

func TestLineLoginRejectsWrongNonce(t *testing.T) {
	svc := newProviderService(t, newMemStore())
	_, _, err := svc.LoginWithLine(context.Background(), "l1", "https://app/cb", "other")
	if !errors.Is(err, ErrInvalidLineLogin) {
		t.Errorf("err = %v, want ErrInvalidLineLogin", err)
	}
}
