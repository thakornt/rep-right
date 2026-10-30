// Package auth implements Google sign-in and our own sessions: a short-lived
// JWT access token plus a rotating refresh token whose hash is stored so it
// can be revoked.
package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

const (
	AccessTokenTTL  = 15 * time.Minute
	RefreshTokenTTL = 30 * 24 * time.Hour
	// ReuseGrace tolerates two tabs refreshing with the same cookie at once:
	// replaying a rotated token within this window is rejected but does not
	// count as theft.
	ReuseGrace = 30 * time.Second
)

var (
	ErrInvalidGoogleToken  = errors.New("invalid google id token")
	ErrInvalidAccessToken  = errors.New("invalid access token")
	ErrInvalidRefreshToken = errors.New("invalid refresh token")
	ErrUserNotFound        = errors.New("user not found")
	// ErrTokenNotFound is returned by TxStore.LockRefreshToken.
	ErrTokenNotFound = errors.New("refresh token not found")
)

type User struct {
	ID          uuid.UUID
	GoogleSub   string
	Email       string
	DisplayName string
	CreatedAt   time.Time
}

// GoogleIdentity is what we keep from a verified Google ID token.
type GoogleIdentity struct {
	Subject string
	Email   string
	Name    string
}

type Session struct {
	AccessToken      string
	AccessExpiresAt  time.Time
	RefreshToken     string // raw value; only its hash is stored
	RefreshExpiresAt time.Time
}

type RefreshRecord struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	ExpiresAt time.Time
	RevokedAt *time.Time
	Replaced  bool // revoked by rotation, as opposed to logout
}

type GoogleVerifier interface {
	Verify(ctx context.Context, idToken string) (GoogleIdentity, error)
}

type Store interface {
	UpsertGoogleUser(ctx context.Context, id GoogleIdentity) (User, error)
	GetUser(ctx context.Context, id uuid.UUID) (User, error) // ErrUserNotFound
	DeleteUser(ctx context.Context, id uuid.UUID) error      // cascades to tokens
	InsertRefreshToken(ctx context.Context, userID uuid.UUID, hash []byte, expiresAt time.Time) error
	RevokeRefreshToken(ctx context.Context, hash []byte, now time.Time) error
	// InTx runs fn in one transaction, committing when fn returns nil.
	InTx(ctx context.Context, fn func(TxStore) error) error
}

// TxStore is the part of Store used inside a refresh-token rotation.
type TxStore interface {
	// LockRefreshToken returns the token with this hash and locks it until
	// the transaction ends, or ErrTokenNotFound.
	LockRefreshToken(ctx context.Context, hash []byte) (RefreshRecord, error)
	InsertRefreshToken(ctx context.Context, userID uuid.UUID, hash []byte, expiresAt time.Time) (uuid.UUID, error)
	MarkRotated(ctx context.Context, oldID, newID uuid.UUID, now time.Time) error
	RevokeAllForUser(ctx context.Context, userID uuid.UUID, now time.Time) error
}

type Options struct {
	Store    Store
	Verifier GoogleVerifier
	Secret   []byte           // HMAC key for access tokens, at least 32 bytes
	Now      func() time.Time // defaults to time.Now
}

type Service struct {
	store    Store
	verifier GoogleVerifier
	secret   []byte
	now      func() time.Time
}

func NewService(o Options) (*Service, error) {
	if len(o.Secret) < 32 {
		return nil, errors.New("auth: secret must be at least 32 bytes")
	}
	if o.Store == nil || o.Verifier == nil {
		return nil, errors.New("auth: store and verifier are required")
	}
	if o.Now == nil {
		o.Now = time.Now
	}
	return &Service{store: o.Store, verifier: o.Verifier, secret: o.Secret, now: o.Now}, nil
}

// LoginWithGoogle verifies a Google ID token, finds or creates the user by
// Google subject and starts a new session.
func (s *Service) LoginWithGoogle(ctx context.Context, idToken string) (User, Session, error) {
	id, err := s.verifier.Verify(ctx, idToken)
	if err != nil {
		return User{}, Session{}, fmt.Errorf("%w: %w", ErrInvalidGoogleToken, err)
	}
	u, err := s.store.UpsertGoogleUser(ctx, id)
	if err != nil {
		return User{}, Session{}, fmt.Errorf("upsert user: %w", err)
	}
	now := s.now()
	raw, hash, err := newRefreshToken()
	if err != nil {
		return User{}, Session{}, err
	}
	if err := s.store.InsertRefreshToken(ctx, u.ID, hash, now.Add(RefreshTokenTTL)); err != nil {
		return User{}, Session{}, fmt.Errorf("store refresh token: %w", err)
	}
	sess, err := s.session(u.ID, raw, now)
	return u, sess, err
}

// Refresh exchanges a refresh token for a new session and revokes the old
// token (rotation). Presenting a token that was already rotated means it
// leaked, so every session of that user is revoked.
func (s *Service) Refresh(ctx context.Context, raw string) (Session, error) {
	if raw == "" {
		return Session{}, ErrInvalidRefreshToken
	}
	now := s.now()
	newRaw, newHash, err := newRefreshToken()
	if err != nil {
		return Session{}, err
	}

	var userID uuid.UUID
	// rejected is set instead of returning an error so that a reuse
	// revocation inside the transaction still commits.
	rejected := false
	err = s.store.InTx(ctx, func(tx TxStore) error {
		rec, err := tx.LockRefreshToken(ctx, HashRefreshToken(raw))
		if errors.Is(err, ErrTokenNotFound) {
			rejected = true
			return nil
		}
		if err != nil {
			return err
		}
		if rec.RevokedAt != nil {
			rejected = true
			if rec.Replaced && now.Sub(*rec.RevokedAt) > ReuseGrace {
				return tx.RevokeAllForUser(ctx, rec.UserID, now)
			}
			return nil
		}
		if !now.Before(rec.ExpiresAt) {
			rejected = true
			return nil
		}
		newID, err := tx.InsertRefreshToken(ctx, rec.UserID, newHash, now.Add(RefreshTokenTTL))
		if err != nil {
			return err
		}
		userID = rec.UserID
		return tx.MarkRotated(ctx, rec.ID, newID, now)
	})
	if err != nil {
		return Session{}, fmt.Errorf("rotate refresh token: %w", err)
	}
	if rejected {
		return Session{}, ErrInvalidRefreshToken
	}
	return s.session(userID, newRaw, now)
}

// Logout revokes the refresh token. Unknown or empty tokens are ignored.
func (s *Service) Logout(ctx context.Context, raw string) error {
	if raw == "" {
		return nil
	}
	return s.store.RevokeRefreshToken(ctx, HashRefreshToken(raw), s.now())
}

func (s *Service) Me(ctx context.Context, userID uuid.UUID) (User, error) {
	return s.store.GetUser(ctx, userID)
}

// DeleteAccount hard-deletes the user and, by cascade, all of their data (PDPA).
func (s *Service) DeleteAccount(ctx context.Context, userID uuid.UUID) error {
	return s.store.DeleteUser(ctx, userID)
}

func (s *Service) session(userID uuid.UUID, refresh string, now time.Time) (Session, error) {
	access, exp, err := s.signAccessToken(userID, now)
	if err != nil {
		return Session{}, err
	}
	return Session{
		AccessToken:      access,
		AccessExpiresAt:  exp,
		RefreshToken:     refresh,
		RefreshExpiresAt: now.Add(RefreshTokenTTL),
	}, nil
}
