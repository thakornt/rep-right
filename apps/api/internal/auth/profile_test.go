package auth

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestCleanDisplayName(t *testing.T) {
	ok := map[string]string{
		"  สมชาย ใจดี  ":        "สมชาย ใจดี",
		"A":                     "A",
		strings.Repeat("ก", 50): strings.Repeat("ก", 50),
	}
	for in, want := range ok {
		if got, err := CleanDisplayName(in); err != nil || got != want {
			t.Errorf("CleanDisplayName(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, in := range []string{"", "   ", strings.Repeat("ก", 51), "a\nb", "tab\there", "\x00", string([]byte{0xff})} {
		if _, err := CleanDisplayName(in); !errors.Is(err, ErrInvalidDisplayName) {
			t.Errorf("CleanDisplayName(%q) err = %v, want ErrInvalidDisplayName", in, err)
		}
	}
}

func TestCleanPictureURL(t *testing.T) {
	keep := []string{
		"https://lh3.googleusercontent.com/a/abc=s96-c",
		"https://profile.line-scdn.net/0h1234",
	}
	for _, u := range keep {
		if got := cleanPictureURL(u); got != u {
			t.Errorf("cleanPictureURL(%q) = %q", u, got)
		}
	}
	for _, u := range []string{"", "http://example.com/a.png", "javascript:alert(1)", "data:image/png;base64,AAAA",
		"https://user:pw@example.com/a.png", "https:///nohost", "https://x.example/" + strings.Repeat("a", 2100)} {
		if got := cleanPictureURL(u); got != "" {
			t.Errorf("cleanPictureURL(%q) = %q, want empty", u, got)
		}
	}
}

func TestLoginStoresPictureAndKeepsEditedName(t *testing.T) {
	st := newMemStore()
	verifier := &switchVerifier{id: Identity{Provider: ProviderGoogle, Subject: "g-9", Email: "p@example.com", Name: "Google Name",
		Picture: "https://lh3.googleusercontent.com/a/1"}}
	svc, err := NewService(Options{Store: st, Verifier: verifier, Secret: secret})
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	u, _, err := svc.LoginWithGoogle(ctx, "x")
	if err != nil {
		t.Fatal(err)
	}
	if u.PictureURL != "https://lh3.googleusercontent.com/a/1" || u.DisplayName != "Google Name" {
		t.Fatalf("first sign-in: %+v", u)
	}
	if _, err := svc.UpdateDisplayName(ctx, u.ID, "  ต้น  "); err != nil {
		t.Fatal(err)
	}
	// Next sign-in: Google has a new picture and name; the user's own name stays.
	verifier.id.Picture = "https://lh3.googleusercontent.com/a/2"
	verifier.id.Name = "Renamed At Google"
	u, _, err = svc.LoginWithGoogle(ctx, "x")
	if err != nil {
		t.Fatal(err)
	}
	if u.DisplayName != "ต้น" || u.PictureURL != "https://lh3.googleusercontent.com/a/2" {
		t.Errorf("second sign-in: %+v", u)
	}
	// A provider picture that is not https is dropped, not stored.
	verifier.id.Picture = "javascript:alert(1)"
	u, _, _ = svc.LoginWithGoogle(ctx, "x")
	if u.PictureURL != "" {
		t.Errorf("unsafe picture stored: %q", u.PictureURL)
	}
}

func TestUpdateDisplayNameRejectsInvalid(t *testing.T) {
	svc, _, _ := newTestService(t)
	u, _, err := svc.LoginWithGoogle(context.Background(), "x")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.UpdateDisplayName(context.Background(), u.ID, " "); !errors.Is(err, ErrInvalidDisplayName) {
		t.Errorf("err = %v, want ErrInvalidDisplayName", err)
	}
}

type switchVerifier struct{ id Identity }

func (v *switchVerifier) Verify(context.Context, string) (Identity, error) { return v.id, nil }
