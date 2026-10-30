package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/thakornt/rep-right/apps/api/internal/auth"
	"github.com/thakornt/rep-right/apps/api/internal/store/dbgen"
)

// AuthStore implements auth.Store on Postgres.
type AuthStore struct {
	pool *pgxpool.Pool
	q    *dbgen.Queries
}

func NewAuthStore(pool *pgxpool.Pool) *AuthStore {
	return &AuthStore{pool: pool, q: dbgen.New(pool)}
}

var _ auth.Store = (*AuthStore)(nil)

func (s *AuthStore) UpsertGoogleUser(ctx context.Context, id auth.GoogleIdentity) (auth.User, error) {
	u, err := s.q.UpsertUserByGoogleSub(ctx, dbgen.UpsertUserByGoogleSubParams{
		GoogleSub: id.Subject, Email: id.Email, DisplayName: id.Name,
	})
	return toAuthUser(u), err
}

func (s *AuthStore) GetUser(ctx context.Context, id uuid.UUID) (auth.User, error) {
	u, err := s.q.GetUserByID(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.User{}, auth.ErrUserNotFound
	}
	return toAuthUser(u), err
}

func (s *AuthStore) DeleteUser(ctx context.Context, id uuid.UUID) error {
	return s.q.DeleteUser(ctx, id)
}

func (s *AuthStore) InsertRefreshToken(ctx context.Context, userID uuid.UUID, hash []byte, expiresAt time.Time) error {
	_, err := authTx{s.q}.InsertRefreshToken(ctx, userID, hash, expiresAt)
	return err
}

func (s *AuthStore) RevokeRefreshToken(ctx context.Context, hash []byte, now time.Time) error {
	return s.q.RevokeRefreshTokenByHash(ctx, dbgen.RevokeRefreshTokenByHashParams{Now: now, TokenHash: hash})
}

func (s *AuthStore) InTx(ctx context.Context, fn func(auth.TxStore) error) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		return fn(authTx{s.q.WithTx(tx)})
	})
}

type authTx struct{ q *dbgen.Queries }

func (t authTx) LockRefreshToken(ctx context.Context, hash []byte) (auth.RefreshRecord, error) {
	r, err := t.q.LockRefreshTokenByHash(ctx, hash)
	if errors.Is(err, pgx.ErrNoRows) {
		return auth.RefreshRecord{}, auth.ErrTokenNotFound
	}
	if err != nil {
		return auth.RefreshRecord{}, fmt.Errorf("lock refresh token: %w", err)
	}
	rec := auth.RefreshRecord{ID: r.ID, UserID: r.UserID, ExpiresAt: r.ExpiresAt, Replaced: r.ReplacedBy.Valid}
	if r.RevokedAt.Valid {
		rec.RevokedAt = &r.RevokedAt.Time
	}
	return rec, nil
}

func (t authTx) InsertRefreshToken(ctx context.Context, userID uuid.UUID, hash []byte, expiresAt time.Time) (uuid.UUID, error) {
	return t.q.InsertRefreshToken(ctx, dbgen.InsertRefreshTokenParams{UserID: userID, TokenHash: hash, ExpiresAt: expiresAt})
}

func (t authTx) MarkRotated(ctx context.Context, oldID, newID uuid.UUID, now time.Time) error {
	return t.q.MarkRefreshTokenRotated(ctx, dbgen.MarkRefreshTokenRotatedParams{Now: now, ReplacedBy: newID, ID: oldID})
}

func (t authTx) RevokeAllForUser(ctx context.Context, userID uuid.UUID, now time.Time) error {
	return t.q.RevokeRefreshTokensForUser(ctx, dbgen.RevokeRefreshTokensForUserParams{Now: now, UserID: userID})
}

func toAuthUser(u dbgen.User) auth.User {
	return auth.User{ID: u.ID, GoogleSub: u.GoogleSub, Email: u.Email, DisplayName: u.DisplayName, CreatedAt: u.CreatedAt}
}
