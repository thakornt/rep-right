package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

const (
	issuer   = "rep-right"
	audience = "rep-right-api"
)

func (s *Service) signAccessToken(userID uuid.UUID, now time.Time) (string, time.Time, error) {
	exp := now.Add(AccessTokenTTL)
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.RegisteredClaims{
		Subject:   userID.String(),
		Issuer:    issuer,
		Audience:  jwt.ClaimStrings{audience},
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(exp),
	}).SignedString(s.secret)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("sign access token: %w", err)
	}
	return tok, exp, nil
}

// ParseAccessToken validates an access token and returns its user ID.
func (s *Service) ParseAccessToken(raw string) (uuid.UUID, error) {
	var claims jwt.RegisteredClaims
	_, err := jwt.ParseWithClaims(raw, &claims,
		func(*jwt.Token) (any, error) { return s.secret, nil },
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithIssuer(issuer),
		jwt.WithAudience(audience),
		jwt.WithExpirationRequired(),
		jwt.WithTimeFunc(s.now),
	)
	if err != nil {
		return uuid.Nil, fmt.Errorf("%w: %w", ErrInvalidAccessToken, err)
	}
	id, err := uuid.Parse(claims.Subject)
	if err != nil {
		return uuid.Nil, fmt.Errorf("%w: bad subject", ErrInvalidAccessToken)
	}
	return id, nil
}

// newRefreshToken returns a random opaque token and its SHA-256 hash.
func newRefreshToken() (raw string, hash []byte, err error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", nil, fmt.Errorf("generate refresh token: %w", err)
	}
	raw = base64.RawURLEncoding.EncodeToString(b)
	return raw, HashRefreshToken(raw), nil
}

// HashRefreshToken is the value stored in refresh_tokens.token_hash. A plain
// SHA-256 is enough because the token itself has 256 bits of entropy.
func HashRefreshToken(raw string) []byte {
	sum := sha256.Sum256([]byte(raw))
	return sum[:]
}
