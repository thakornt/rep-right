package auth

import (
	"context"
	"errors"
	"fmt"

	"google.golang.org/api/idtoken"
)

// googleVerifier checks ID tokens from Google Identity Services: signature,
// expiry and audience (our client ID) via idtoken, then issuer and claims here.
type googleVerifier struct {
	clientID  string
	validator *idtoken.Validator
}

func NewGoogleVerifier(clientID string) (GoogleVerifier, error) {
	if clientID == "" {
		return nil, errors.New("auth: google client id is required")
	}
	v, err := idtoken.NewValidator(context.Background())
	if err != nil {
		return nil, fmt.Errorf("auth: idtoken validator: %w", err)
	}
	return googleVerifier{clientID: clientID, validator: v}, nil
}

func (g googleVerifier) Verify(ctx context.Context, idToken string) (GoogleIdentity, error) {
	p, err := g.validator.Validate(ctx, idToken, g.clientID)
	if err != nil {
		return GoogleIdentity{}, fmt.Errorf("%w: %w", ErrInvalidGoogleToken, err)
	}
	return identityFromPayload(p)
}

// identityFromPayload checks what idtoken.Validate does not: the issuer and a
// verified email.
func identityFromPayload(p *idtoken.Payload) (GoogleIdentity, error) {
	if p.Issuer != "https://accounts.google.com" && p.Issuer != "accounts.google.com" {
		return GoogleIdentity{}, fmt.Errorf("%w: unexpected issuer %q", ErrInvalidGoogleToken, p.Issuer)
	}
	email, _ := p.Claims["email"].(string)
	verified, _ := p.Claims["email_verified"].(bool)
	if p.Subject == "" || email == "" || !verified {
		return GoogleIdentity{}, fmt.Errorf("%w: missing subject or verified email", ErrInvalidGoogleToken)
	}
	name, _ := p.Claims["name"].(string)
	return GoogleIdentity{Subject: p.Subject, Email: email, Name: name}, nil
}
