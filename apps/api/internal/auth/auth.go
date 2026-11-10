// Package auth implements sign-in with Google and LINE and our own sessions:
// a short-lived JWT access token plus a rotating refresh token whose hash is
// stored so it can be revoked. Whatever the provider, a sign-in ends in the
// same kind of session.
package auth

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

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
	ErrInvalidGoogleToken = errors.New("invalid google id token")
	ErrInvalidLineLogin   = errors.New("invalid line login")
	// ErrProviderDisabled means the server has no credentials for that
	// sign-in method (e.g. LINE_CHANNEL_ID unset).
	ErrProviderDisabled    = errors.New("sign-in provider not configured")
	ErrInvalidDisplayName  = errors.New("invalid display name")
	ErrInvalidAccessToken  = errors.New("invalid access token")
	ErrInvalidRefreshToken = errors.New("invalid refresh token")
	ErrUserNotFound        = errors.New("user not found")
	// ErrTokenNotFound is returned by TxStore.LockRefreshToken.
	ErrTokenNotFound = errors.New("refresh token not found")
)

type User struct {
	ID          uuid.UUID
	Email       string
	DisplayName string
	PictureURL  string   // from the provider at the last sign-in; "" = none
	Providers   []string // linked sign-in providers, oldest first
	CreatedAt   time.Time
}

// MaxDisplayNameLen is in characters (runes), not bytes: Thai names are
// three bytes per character.
const MaxDisplayNameLen = 50

const (
	ProviderGoogle = "google"
	ProviderLine   = "line"
)

// Identity is what we keep from a verified provider ID token. A user is found
// by (Provider, Subject) only, never by email, so a LINE account cannot take
// over a Google account that happens to share an address.
type Identity struct {
	Provider string
	Subject  string
	Email    string // may be empty for LINE
	Name     string
	Picture  string // profile picture URL; may be empty
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
	Verify(ctx context.Context, idToken string) (Identity, error)
}

// GoogleCodeExchanger turns an authorization code from the GIS code client
// (popup mode) into a Google ID token, which is then checked by GoogleVerifier.
type GoogleCodeExchanger interface {
	ExchangeCode(ctx context.Context, code string) (idToken string, err error)
}

// LineClient is LINE Login (OpenID Connect, authorization code flow).
type LineClient interface {
	AuthURL(redirectURI, state, nonce string) string
	// Login exchanges the code and verifies the ID token, including its nonce.
	Login(ctx context.Context, code, redirectURI, nonce string) (Identity, error)
}

type Store interface {
	// UpsertIdentity finds the user of this provider account, creating the
	// user on first sign-in, and refreshes email and picture from the
	// provider. The display name is only taken from the provider while empty.
	UpsertIdentity(ctx context.Context, id Identity) (User, error)
	GetUser(ctx context.Context, id uuid.UUID) (User, error)                     // ErrUserNotFound
	SetDisplayName(ctx context.Context, id uuid.UUID, name string) (User, error) // ErrUserNotFound
	DeleteUser(ctx context.Context, id uuid.UUID) error                          // cascades to tokens
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
	// GoogleCode enables sign-in with an authorization code (our own button);
	// nil leaves only ID tokens from Google's rendered button.
	GoogleCode GoogleCodeExchanger
	Line       LineClient       // nil = LINE Login off
	Secret     []byte           // HMAC key for access tokens, at least 32 bytes
	Now        func() time.Time // defaults to time.Now
}

type Service struct {
	store      Store
	verifier   GoogleVerifier
	googleCode GoogleCodeExchanger
	line       LineClient
	secret     []byte
	now        func() time.Time
}

// Providers says which sign-in methods this server can accept.
type Providers struct {
	GoogleCode bool
	Line       bool
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
	return &Service{
		store: o.Store, verifier: o.Verifier, googleCode: o.GoogleCode, line: o.Line,
		secret: o.Secret, now: o.Now,
	}, nil
}

func (s *Service) Providers() Providers {
	return Providers{GoogleCode: s.googleCode != nil, Line: s.line != nil}
}

// LoginWithGoogle verifies a Google ID token, finds or creates the user by
// Google subject and starts a new session.
func (s *Service) LoginWithGoogle(ctx context.Context, idToken string) (User, Session, error) {
	id, err := s.verifier.Verify(ctx, idToken)
	if err != nil {
		return User{}, Session{}, fmt.Errorf("%w: %w", ErrInvalidGoogleToken, err)
	}
	return s.login(ctx, id)
}

// LoginWithGoogleCode exchanges a GIS authorization code for an ID token and
// signs in with it exactly like LoginWithGoogle.
func (s *Service) LoginWithGoogleCode(ctx context.Context, code string) (User, Session, error) {
	if s.googleCode == nil {
		return User{}, Session{}, ErrProviderDisabled
	}
	idToken, err := s.googleCode.ExchangeCode(ctx, code)
	if err != nil {
		return User{}, Session{}, fmt.Errorf("%w: %w", ErrInvalidGoogleToken, err)
	}
	return s.LoginWithGoogle(ctx, idToken)
}

// LineStart is where to send the browser for LINE Login. State and Nonce must
// be kept (in a short-lived httpOnly cookie) to check the callback.
type LineStart struct {
	URL   string
	State string
	Nonce string
}

func (s *Service) StartLine(redirectURI string) (LineStart, error) {
	if s.line == nil {
		return LineStart{}, ErrProviderDisabled
	}
	state, err := randomToken()
	if err != nil {
		return LineStart{}, err
	}
	nonce, err := randomToken()
	if err != nil {
		return LineStart{}, err
	}
	return LineStart{URL: s.line.AuthURL(redirectURI, state, nonce), State: state, Nonce: nonce}, nil
}

// LoginWithLine finishes LINE Login: the caller has already matched the
// callback's state; nonce is the one StartLine returned.
func (s *Service) LoginWithLine(ctx context.Context, code, redirectURI, nonce string) (User, Session, error) {
	if s.line == nil {
		return User{}, Session{}, ErrProviderDisabled
	}
	id, err := s.line.Login(ctx, code, redirectURI, nonce)
	if err != nil {
		return User{}, Session{}, fmt.Errorf("%w: %w", ErrInvalidLineLogin, err)
	}
	return s.login(ctx, id)
}

func (s *Service) login(ctx context.Context, id Identity) (User, Session, error) {
	id.Picture = cleanPictureURL(id.Picture)
	id.Name = truncateRunes(strings.TrimSpace(id.Name), MaxDisplayNameLen)
	u, err := s.store.UpsertIdentity(ctx, id)
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

// UpdateDisplayName sets the name shown in the app. It is trimmed and must be
// 1-50 characters without control characters.
func (s *Service) UpdateDisplayName(ctx context.Context, userID uuid.UUID, name string) (User, error) {
	name, err := CleanDisplayName(name)
	if err != nil {
		return User{}, err
	}
	return s.store.SetDisplayName(ctx, userID, name)
}

func CleanDisplayName(name string) (string, error) {
	name = strings.TrimSpace(name)
	n := utf8.RuneCountInString(name)
	if !utf8.ValidString(name) || n == 0 || n > MaxDisplayNameLen {
		return "", ErrInvalidDisplayName
	}
	for _, r := range name {
		if unicode.IsControl(r) {
			return "", ErrInvalidDisplayName
		}
	}
	return name, nil
}

// cleanPictureURL keeps only https links of sane length, so the web never
// renders a javascript:, data: or plain-http URL from a provider.
func cleanPictureURL(raw string) string {
	if len(raw) > 2048 {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil {
		return ""
	}
	return raw
}

func truncateRunes(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	return string([]rune(s)[:n])
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
