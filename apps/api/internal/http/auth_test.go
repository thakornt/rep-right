package http

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/thakornt/rep-right/apps/api/internal/auth"
)

var testUser = auth.User{ID: uuid.MustParse("11111111-1111-1111-1111-111111111111"), Email: "a@example.com", DisplayName: "A"}

// fakeAuth accepts id token "good", refresh token "r1" and access token "a1".
type fakeAuth struct {
	loggedOut string
	deleted   uuid.UUID
	meErr     error
	err       error // forced internal error
}

func (f *fakeAuth) session(refresh string) auth.Session {
	return auth.Session{
		AccessToken: "a1", AccessExpiresAt: time.Now().Add(15 * time.Minute),
		RefreshToken: refresh, RefreshExpiresAt: time.Now().Add(30 * 24 * time.Hour),
	}
}

func (f *fakeAuth) LoginWithGoogle(_ context.Context, idToken string) (auth.User, auth.Session, error) {
	if f.err != nil {
		return auth.User{}, auth.Session{}, f.err
	}
	if idToken != "good" {
		return auth.User{}, auth.Session{}, auth.ErrInvalidGoogleToken
	}
	return testUser, f.session("r1"), nil
}

func (f *fakeAuth) Refresh(_ context.Context, raw string) (auth.Session, error) {
	if raw != "r1" {
		return auth.Session{}, auth.ErrInvalidRefreshToken
	}
	return f.session("r2"), nil
}

func (f *fakeAuth) Logout(_ context.Context, raw string) error { f.loggedOut = raw; return nil }

func (f *fakeAuth) ParseAccessToken(raw string) (uuid.UUID, error) {
	if raw != "a1" {
		return uuid.Nil, auth.ErrInvalidAccessToken
	}
	return testUser.ID, nil
}

func (f *fakeAuth) Me(context.Context, uuid.UUID) (auth.User, error) { return testUser, f.meErr }

func (f *fakeAuth) DeleteAccount(_ context.Context, id uuid.UUID) error { f.deleted = id; return nil }

func newAuthRouter(f *fakeAuth) *gin.Engine {
	gin.SetMode(gin.TestMode)
	return NewRouter(Deps{
		Log:            slog.New(slog.NewTextHandler(io.Discard, nil)),
		DB:             fakePinger{},
		AllowedOrigins: []string{"http://localhost:3000"},
		Auth:           f,
		Cookie:         CookieConfig{Secure: true},
	})
}

func send(r http.Handler, method, path, body string, header http.Header) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range header {
		req.Header[k] = v
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func refreshCookieOf(t *testing.T, w *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range w.Result().Cookies() {
		if c.Name == refreshCookie {
			return c
		}
	}
	t.Fatalf("no %s cookie in %v", refreshCookie, w.Header())
	return nil
}

func TestGoogleLoginSetsSecureCookie(t *testing.T) {
	w := send(newAuthRouter(&fakeAuth{}), http.MethodPost, "/v1/auth/google", `{"id_token":"good"}`, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d %s", w.Code, w.Body)
	}
	var body tokenJSON
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.AccessToken != "a1" || body.TokenType != "Bearer" || body.User == nil || body.User.Email != "a@example.com" {
		t.Errorf("body = %s", w.Body)
	}
	if body.ExpiresIn < 890 || body.ExpiresIn > 900 {
		t.Errorf("expires_in = %d, want ~900", body.ExpiresIn)
	}
	if strings.Contains(w.Body.String(), "r1") {
		t.Error("refresh token must only travel in the cookie")
	}
	if w.Header().Get("Cache-Control") != "no-store" {
		t.Error("token responses must not be cached")
	}
	c := refreshCookieOf(t, w)
	if c.Value != "r1" || !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteStrictMode || c.Path != "/" || c.Domain != "" {
		t.Errorf("cookie = %+v", c)
	}
	if c.MaxAge < 29*24*3600 {
		t.Errorf("cookie MaxAge = %d, want ~30 days", c.MaxAge)
	}
}

func TestGoogleLoginErrors(t *testing.T) {
	r := newAuthRouter(&fakeAuth{})
	cases := []struct {
		body   string
		status int
		code   string
	}{
		{`{}`, http.StatusBadRequest, CodeInvalidRequest},
		{`not json`, http.StatusBadRequest, CodeInvalidRequest},
		{`{"id_token":"forged"}`, http.StatusUnauthorized, CodeInvalidGoogleToken},
		{`{"id_token":"` + strings.Repeat("x", 20<<10) + `"}`, http.StatusBadRequest, CodeInvalidRequest},
	}
	for _, tc := range cases {
		w := send(r, http.MethodPost, "/v1/auth/google", tc.body, nil)
		if w.Code != tc.status || decodeError(t, w).Code != tc.code {
			t.Errorf("body %.20q: got %d %s, want %d %s", tc.body, w.Code, w.Body, tc.status, tc.code)
		}
	}

	w := send(newAuthRouter(&fakeAuth{err: errors.New("db down")}), http.MethodPost, "/v1/auth/google", `{"id_token":"good"}`, nil)
	if w.Code != http.StatusInternalServerError || strings.Contains(w.Body.String(), "db down") {
		t.Errorf("internal errors must not leak details: %d %s", w.Code, w.Body)
	}
}

func TestRefreshRotatesCookie(t *testing.T) {
	r := newAuthRouter(&fakeAuth{})
	w := send(r, http.MethodPost, "/v1/auth/refresh", "", http.Header{"Cookie": {refreshCookie + "=r1"}})
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d %s", w.Code, w.Body)
	}
	if c := refreshCookieOf(t, w); c.Value != "r2" {
		t.Errorf("cookie not rotated: %+v", c)
	}
	var body tokenJSON
	_ = json.Unmarshal(w.Body.Bytes(), &body)
	if body.AccessToken != "a1" || body.User != nil {
		t.Errorf("body = %s", w.Body)
	}
}

func TestRefreshInvalidClearsCookie(t *testing.T) {
	r := newAuthRouter(&fakeAuth{})
	for _, h := range []http.Header{nil, {"Cookie": {refreshCookie + "=stolen"}}} {
		w := send(r, http.MethodPost, "/v1/auth/refresh", "", h)
		if w.Code != http.StatusUnauthorized || decodeError(t, w).Code != CodeInvalidRefreshToken {
			t.Fatalf("got %d %s", w.Code, w.Body)
		}
		if c := refreshCookieOf(t, w); c.MaxAge >= 0 || c.Value != "" {
			t.Errorf("cookie should be cleared: %+v", c)
		}
	}
}

func TestLogoutRevokesAndClears(t *testing.T) {
	f := &fakeAuth{}
	w := send(newAuthRouter(f), http.MethodPost, "/v1/auth/logout", "", http.Header{"Cookie": {refreshCookie + "=r1"}})
	if w.Code != http.StatusNoContent || f.loggedOut != "r1" {
		t.Fatalf("got %d, loggedOut=%q", w.Code, f.loggedOut)
	}
	if c := refreshCookieOf(t, w); c.MaxAge >= 0 {
		t.Errorf("cookie should be cleared: %+v", c)
	}
}

func TestMeRequiresBearerToken(t *testing.T) {
	r := newAuthRouter(&fakeAuth{})
	for _, h := range []http.Header{
		nil,
		{"Authorization": {"a1"}},
		{"Authorization": {"Bearer "}},
		{"Authorization": {"Bearer expired"}},
		// The refresh cookie alone must never authenticate API calls.
		{"Cookie": {refreshCookie + "=r1"}},
	} {
		w := send(r, http.MethodGet, "/v1/me", "", h)
		if w.Code != http.StatusUnauthorized || decodeError(t, w).Code != CodeUnauthorized {
			t.Errorf("header %v: got %d %s", h, w.Code, w.Body)
		}
	}

	w := send(r, http.MethodGet, "/v1/me", "", http.Header{"Authorization": {"Bearer a1"}})
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d %s", w.Code, w.Body)
	}
	var u userJSON
	if err := json.Unmarshal(w.Body.Bytes(), &u); err != nil || u.ID != testUser.ID || u.Email != testUser.Email {
		t.Errorf("body = %s", w.Body)
	}
}

func TestMeForDeletedUser(t *testing.T) {
	r := newAuthRouter(&fakeAuth{meErr: auth.ErrUserNotFound})
	w := send(r, http.MethodGet, "/v1/me", "", http.Header{"Authorization": {"Bearer a1"}})
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("got %d %s", w.Code, w.Body)
	}
}

func TestDeleteMe(t *testing.T) {
	f := &fakeAuth{}
	r := newAuthRouter(f)
	if w := send(r, http.MethodDelete, "/v1/me", "", nil); w.Code != http.StatusUnauthorized {
		t.Fatalf("delete without token: %d", w.Code)
	}
	w := send(r, http.MethodDelete, "/v1/me", "", http.Header{"Authorization": {"Bearer a1"}})
	if w.Code != http.StatusNoContent || f.deleted != testUser.ID {
		t.Fatalf("got %d, deleted=%v", w.Code, f.deleted)
	}
	if c := refreshCookieOf(t, w); c.MaxAge >= 0 {
		t.Errorf("cookie should be cleared: %+v", c)
	}
}
