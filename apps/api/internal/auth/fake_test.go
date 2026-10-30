package auth

import (
	"bytes"
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
)

// memStore is an in-memory Store for tests. InTx holds the mutex for the whole
// callback, which gives the same serialisation a row lock gives in Postgres.
type memStore struct {
	mu     sync.Mutex
	users  map[uuid.UUID]User
	tokens []*RefreshRecord
	hashes map[uuid.UUID][]byte
}

func newMemStore() *memStore {
	return &memStore{users: map[uuid.UUID]User{}, hashes: map[uuid.UUID][]byte{}}
}

func (m *memStore) UpsertGoogleUser(_ context.Context, id GoogleIdentity) (User, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for k, u := range m.users {
		if u.GoogleSub == id.Subject {
			u.Email, u.DisplayName = id.Email, id.Name
			m.users[k] = u
			return u, nil
		}
	}
	u := User{ID: uuid.New(), GoogleSub: id.Subject, Email: id.Email, DisplayName: id.Name, CreatedAt: time.Now()}
	m.users[u.ID] = u
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
	id  GoogleIdentity
	err error
}

func (f fakeVerifier) Verify(context.Context, string) (GoogleIdentity, error) { return f.id, f.err }

// clock is a settable time source.
type clock struct{ t time.Time }

func (c *clock) now() time.Time          { return c.t }
func (c *clock) advance(d time.Duration) { c.t = c.t.Add(d) }
