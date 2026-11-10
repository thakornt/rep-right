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

func (s *AuthStore) UpsertIdentity(ctx context.Context, id auth.Identity) (auth.User, error) {
	var u dbgen.User
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if err := q.LockIdentity(ctx, dbgen.LockIdentityParams{Provider: id.Provider, Subject: id.Subject}); err != nil {
			return fmt.Errorf("lock identity: %w", err)
		}
		existing, err := q.GetUserByIdentity(ctx, dbgen.GetUserByIdentityParams{Provider: id.Provider, Subject: id.Subject})
		switch {
		case err == nil:
			if id.Email != "" {
				if err := q.UpdateIdentityEmail(ctx, dbgen.UpdateIdentityEmailParams{
					Provider: id.Provider, Subject: id.Subject, Email: id.Email,
				}); err != nil {
					return fmt.Errorf("update identity: %w", err)
				}
			}
			u, err = q.UpdateUserProfile(ctx, dbgen.UpdateUserProfileParams{
				ID: existing.ID, Email: id.Email, DisplayName: id.Name,
			})
			return err
		case errors.Is(err, pgx.ErrNoRows):
			u, err = q.CreateUser(ctx, dbgen.CreateUserParams{Email: id.Email, DisplayName: id.Name})
			if err != nil {
				return fmt.Errorf("create user: %w", err)
			}
			return q.InsertIdentity(ctx, dbgen.InsertIdentityParams{
				Provider: id.Provider, Subject: id.Subject, UserID: u.ID, Email: id.Email,
			})
		default:
			return fmt.Errorf("find identity: %w", err)
		}
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
	return auth.User{ID: u.ID, Email: u.Email, DisplayName: u.DisplayName, CreatedAt: u.CreatedAt}
}
