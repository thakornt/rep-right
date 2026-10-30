package http

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/thakornt/rep-right/apps/api/internal/auth"
)

// Authenticator is the subset of *auth.Service the handlers need.
type Authenticator interface {
	LoginWithGoogle(ctx context.Context, idToken string) (auth.User, auth.Session, error)
	Refresh(ctx context.Context, refreshToken string) (auth.Session, error)
	Logout(ctx context.Context, refreshToken string) error
	ParseAccessToken(raw string) (uuid.UUID, error)
	Me(ctx context.Context, userID uuid.UUID) (auth.User, error)
	DeleteAccount(ctx context.Context, userID uuid.UUID) error
}

// CookieConfig controls the refresh-token cookie.
type CookieConfig struct {
	Domain string // empty = host-only, which is what the same-origin /api proxy needs
	Secure bool   // false only for plain-http local development
}

const (
	refreshCookie = "rr_refresh"
	userIDKey     = "auth.user_id"
	maxAuthBody   = 16 << 10
)

type authHandlers struct {
	auth   Authenticator
	cookie CookieConfig
	log    *slog.Logger
}

type userJSON struct {
	ID          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
}

type tokenJSON struct {
	AccessToken string    `json:"access_token"`
	TokenType   string    `json:"token_type"`
	ExpiresIn   int       `json:"expires_in"`
	User        *userJSON `json:"user,omitempty"`
}

func toUserJSON(u auth.User) *userJSON {
	return &userJSON{ID: u.ID, Email: u.Email, DisplayName: u.DisplayName, CreatedAt: u.CreatedAt}
}

func (h authHandlers) google(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAuthBody)
	var req struct {
		IDToken string `json:"id_token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.IDToken == "" {
		writeError(c, http.StatusBadRequest, CodeInvalidRequest, "id_token is required")
		return
	}
	u, s, err := h.auth.LoginWithGoogle(c.Request.Context(), req.IDToken)
	if errors.Is(err, auth.ErrInvalidGoogleToken) {
		h.log.InfoContext(c.Request.Context(), "google sign-in rejected", slog.Any("error", err))
		writeError(c, http.StatusUnauthorized, CodeInvalidGoogleToken, "google sign-in failed")
		return
	}
	if err != nil {
		h.internal(c, "google sign-in", err)
		return
	}
	h.writeSession(c, s, toUserJSON(u))
}

func (h authHandlers) refresh(c *gin.Context) {
	raw, _ := c.Cookie(refreshCookie)
	s, err := h.auth.Refresh(c.Request.Context(), raw)
	if errors.Is(err, auth.ErrInvalidRefreshToken) {
		h.clearCookie(c)
		writeError(c, http.StatusUnauthorized, CodeInvalidRefreshToken, "session expired, please sign in again")
		return
	}
	if err != nil {
		h.internal(c, "refresh", err)
		return
	}
	h.writeSession(c, s, nil)
}

func (h authHandlers) logout(c *gin.Context) {
	raw, _ := c.Cookie(refreshCookie)
	if err := h.auth.Logout(c.Request.Context(), raw); err != nil {
		h.internal(c, "logout", err)
		return
	}
	h.clearCookie(c)
	c.Status(http.StatusNoContent)
}

func (h authHandlers) me(c *gin.Context) {
	u, err := h.auth.Me(c.Request.Context(), c.MustGet(userIDKey).(uuid.UUID))
	if errors.Is(err, auth.ErrUserNotFound) {
		writeError(c, http.StatusUnauthorized, CodeUnauthorized, "account no longer exists")
		return
	}
	if err != nil {
		h.internal(c, "get me", err)
		return
	}
	c.JSON(http.StatusOK, toUserJSON(u))
}

func (h authHandlers) deleteMe(c *gin.Context) {
	if err := h.auth.DeleteAccount(c.Request.Context(), c.MustGet(userIDKey).(uuid.UUID)); err != nil {
		h.internal(c, "delete account", err)
		return
	}
	h.clearCookie(c)
	c.Status(http.StatusNoContent)
}

// requireUser accepts "Authorization: Bearer <access token>" and stores the
// user ID in the context.
func (h authHandlers) requireUser(c *gin.Context) {
	raw, ok := strings.CutPrefix(c.GetHeader("Authorization"), "Bearer ")
	if !ok || raw == "" {
		writeError(c, http.StatusUnauthorized, CodeUnauthorized, "missing access token")
		return
	}
	id, err := h.auth.ParseAccessToken(raw)
	if err != nil {
		writeError(c, http.StatusUnauthorized, CodeUnauthorized, "invalid or expired access token")
		return
	}
	c.Set(userIDKey, id)
	c.Next()
}

func (h authHandlers) writeSession(c *gin.Context, s auth.Session, u *userJSON) {
	h.setCookie(c, s.RefreshToken, s.RefreshExpiresAt)
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, tokenJSON{
		AccessToken: s.AccessToken,
		TokenType:   "Bearer",
		ExpiresIn:   int(time.Until(s.AccessExpiresAt).Seconds()),
		User:        u,
	})
}

// Secure is false only in local development over plain http.
func (h authHandlers) setCookie(c *gin.Context, value string, expires time.Time) {
	http.SetCookie(c.Writer, &http.Cookie{ //nolint:gosec // G124: Secure comes from config, see CookieConfig
		Name:     refreshCookie,
		Value:    value,
		Path:     "/",
		Domain:   h.cookie.Domain,
		Expires:  expires,
		MaxAge:   int(time.Until(expires).Seconds()),
		HttpOnly: true,
		Secure:   h.cookie.Secure,
		SameSite: http.SameSiteStrictMode,
	})
}

func (h authHandlers) clearCookie(c *gin.Context) {
	http.SetCookie(c.Writer, &http.Cookie{ //nolint:gosec // G124: as in setCookie
		Name: refreshCookie, Value: "", Path: "/", Domain: h.cookie.Domain, MaxAge: -1,
		HttpOnly: true, Secure: h.cookie.Secure, SameSite: http.SameSiteStrictMode,
	})
}

func (h authHandlers) internal(c *gin.Context, op string, err error) {
	h.log.ErrorContext(c.Request.Context(), op+" failed",
		slog.String("request_id", c.GetString(requestIDHeader)), slog.Any("error", err))
	writeError(c, http.StatusInternalServerError, CodeInternal, "internal server error")
}
