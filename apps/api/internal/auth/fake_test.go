package auth

import (
	"bytes"
	"context"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
)

// memStore is an in-memory Store for tests. InTx holds the mutex for the whole
// callback, which gives the same serialisation a row lock gives in Postgres.
type memStore struct {
	mu         sync.Mutex
	users      map[uuid.UUID]User
	identities map[[2]string]uuid.UUID // (provider, subject) -> user
	tokens     []*RefreshRecord
	hashes     map[uuid.UUID][]byte
}

func newMemStore() *memStore {
	return &memStore{users: map[uuid.UUID]User{}, identities: map[[2]string]uuid.UUID{}, hashes: map[uuid.UUID][]byte{}}
}

func (m *memStore) UpsertIdentity(_ context.Context, id Identity) (User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := [2]string{id.Provider, id.Subject}
	if uid, ok := m.identities[key]; ok {
		u := m.users[uid]
		if id.Email != "" {
			u.Email = id.Email
		}
		u.DisplayName = id.Name
		m.users[uid] = u
		return u, nil
	}
	u := User{ID: uuid.New(), Email: id.Email, DisplayName: id.Name, CreatedAt: time.Now()}
	m.users[u.ID] = u
	m.identities[key] = u.ID
	return u, nil
}

func (m *memStore) GetUser(_ context.Context, id uuid.UUID) (User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	u, ok := m.users[id]
	if !ok {
		return User{}, ErrUserNotFound
	}
	return u, nil
}

func (m *memStore) DeleteUser(_ context.Context, id uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.users, id)
	for k, uid := range m.identities {
		if uid == id {
			delete(m.identities, k)
		}
	}
	kept := m.tokens[:0]
	for _, t := range m.tokens {
		if t.UserID != id {
			kept = append(kept, t)
		}
	}
	m.tokens = kept
	return nil
}

func (m *memStore) InsertRefreshToken(_ context.Context, userID uuid.UUID, hash []byte, expiresAt time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, err := m.insert(userID, hash, expiresAt)
	return err
}

func (m *memStore) RevokeRefreshToken(_ context.Context, hash []byte, now time.Time) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if t := m.find(hash); t != nil && t.RevokedAt == nil {
		t.RevokedAt = &now
	}
	return nil
}

func (m *memStore) InTx(_ context.Context, fn func(TxStore) error) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	return fn(memTx{m})
}

func (m *memStore) insert(userID uuid.UUID, hash []byte, expiresAt time.Time) (uuid.UUID, error) {
	rec := &RefreshRecord{ID: uuid.New(), UserID: userID, ExpiresAt: expiresAt}
	m.tokens = append(m.tokens, rec)
	m.hashes[rec.ID] = hash
	return rec.ID, nil
}

func (m *memStore) find(hash []byte) *RefreshRecord {
	for _, t := range m.tokens {
		if bytes.Equal(m.hashes[t.ID], hash) {
			return t
		}
	}
	return nil
}

// activeTokens counts unrevoked tokens of a user.
func (m *memStore) activeTokens(userID uuid.UUID) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	n := 0
	for _, t := range m.tokens {
		if t.UserID == userID && t.RevokedAt == nil {
			n++
		}
	}
	return n
}

type memTx struct{ m *memStore }

func (tx memTx) LockRefreshToken(_ context.Context, hash []byte) (RefreshRecord, error) {
	t := tx.m.find(hash)
	if t == nil {
		return RefreshRecord{}, ErrTokenNotFound
	}
	return *t, nil
}

func (tx memTx) InsertRefreshToken(_ context.Context, userID uuid.UUID, hash []byte, expiresAt time.Time) (uuid.UUID, error) {
	return tx.m.insert(userID, hash, expiresAt)
}

func (tx memTx) MarkRotated(_ context.Context, oldID, _ uuid.UUID, now time.Time) error {
	for _, t := range tx.m.tokens {
		if t.ID == oldID {
			t.RevokedAt, t.Replaced = &now, true
		}
	}
	return nil
}

func (tx memTx) RevokeAllForUser(_ context.Context, userID uuid.UUID, now time.Time) error {
	for _, t := range tx.m.tokens {
		if t.UserID == userID && t.RevokedAt == nil {
			t.RevokedAt = &now
		}
	}
	return nil
}

type fakeVerifier struct {
	id  Identity
	err error
}

func (f fakeVerifier) Verify(context.Context, string) (Identity, error) { return f.id, f.err }

// fakeCode turns code "c1" into the ID token the fakeVerifier accepts.
type fakeCode struct{}

func (fakeCode) ExchangeCode(_ context.Context, code string) (string, error) {
	if code != "c1" {
		return "", errors.New("invalid_grant")
	}
	return "id-token", nil
}

// fakeLine accepts code "l1" with nonce "n1" and redirect "https://app/cb".
type fakeLine struct{ id Identity }

func (fakeLine) AuthURL(redirectURI, state, nonce string) string {
	return "https://line.test/authorize?redirect_uri=" + redirectURI + "&state=" + state + "&nonce=" + nonce
}

func (f fakeLine) Login(_ context.Context, code, redirectURI, nonce string) (Identity, error) {
	if code != "l1" || nonce != "n1" || redirectURI != "https://app/cb" {
		return Identity{}, errors.New("rejected")
	}
	return f.id, nil
}

// clock is a settable time source.
type clock struct{ t time.Time }

func (c *clock) now() time.Time          { return c.t }
func (c *clock) advance(d time.Duration) { c.t = c.t.Add(d) }
