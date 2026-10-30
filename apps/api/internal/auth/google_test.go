package auth

import (
	"errors"
	"testing"

	"google.golang.org/api/idtoken"
)

func TestIdentityFromPayload(t *testing.T) {
	valid := func() *idtoken.Payload {
		return &idtoken.Payload{
			Issuer:  "https://accounts.google.com",
			Subject: "1234",
			Claims: map[string]any{
				"email":          "a@example.com",
				"email_verified": true,
				"name":           "A",
			},
		}
	}

	id, err := identityFromPayload(valid())
	if err != nil {
		t.Fatal(err)
	}
	if id != (GoogleIdentity{Subject: "1234", Email: "a@example.com", Name: "A"}) {
		t.Errorf("identity = %+v", id)
	}

	p := valid()
	p.Issuer = "accounts.google.com"
	if _, err := identityFromPayload(p); err != nil {
		t.Errorf("issuer without scheme is also valid: %v", err)
	}

	bad := map[string]func(*idtoken.Payload){
		"wrong issuer":     func(p *idtoken.Payload) { p.Issuer = "https://evil.example.com" },
		"no subject":       func(p *idtoken.Payload) { p.Subject = "" },
		"no email":         func(p *idtoken.Payload) { delete(p.Claims, "email") },
		"email unverified": func(p *idtoken.Payload) { p.Claims["email_verified"] = false },
		"verified missing": func(p *idtoken.Payload) { delete(p.Claims, "email_verified") },
	}
	for name, mutate := range bad {
		p := valid()
		mutate(p)
		if _, err := identityFromPayload(p); !errors.Is(err, ErrInvalidGoogleToken) {
			t.Errorf("%s: err = %v, want ErrInvalidGoogleToken", name, err)
		}
	}
}

func TestNewGoogleVerifierRequiresClientID(t *testing.T) {
	if _, err := NewGoogleVerifier(""); err == nil {
		t.Fatal("an empty client ID would skip the audience check")
	}
}
