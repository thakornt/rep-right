package http

import (
	"context"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/thakornt/rep-right/apps/api/internal/auth"
)

// Authenticator is the subset of *auth.Service the handlers need.
type Authenticator interface {
	Providers() auth.Providers
	LoginWithGoogle(ctx context.Context, idToken string) (auth.User, auth.Session, error)
	LoginWithGoogleCode(ctx context.Context, code string) (auth.User, auth.Session, error)
	StartLine(redirectURI string) (auth.LineStart, error)
	LoginWithLine(ctx context.Context, code, redirectURI, nonce string) (auth.User, auth.Session, error)
	Refresh(ctx context.Context, refreshToken string) (auth.Session, error)
	Logout(ctx context.Context, refreshToken string) error
	ParseAccessToken(raw string) (uuid.UUID, error)
	Me(ctx context.Context, userID uuid.UUID) (auth.User, error)
	UpdateDisplayName(ctx context.Context, userID uuid.UUID, name string) (auth.User, error)
	DeleteAccount(ctx context.Context, userID uuid.UUID) error
}

// CookieConfig controls the refresh-token cookie.
type CookieConfig struct {
	Domain string // empty = host-only, which is what the same-origin /api proxy needs
	Secure bool   // false only for plain-http local development
}

const (
	refreshCookie = "rr_refresh"
	// lineCookie holds state, nonce and redirect URI between the start of
	// LINE Login and its callback.
	lineCookie       = "rr_line"
	lineCookieTTL    = 10 * time.Minute
	lineCallbackPath = "/auth/line/callback"
	userIDKey        = "auth.user_id"
	maxAuthBody      = 16 << 10
)

type authHandlers struct {
	auth    Authenticator
	cookie  CookieConfig
	origins []string // web origins allowed as LINE redirect targets
	log     *slog.Logger
}

type userJSON struct {
	ID          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"display_name"`
	PictureURL  string    `json:"picture_url"`
	Providers   []string  `json:"providers"`
	CreatedAt   time.Time `json:"created_at"`
}

type tokenJSON struct {
	AccessToken string    `json:"access_token"`
	TokenType   string    `json:"token_type"`
	ExpiresIn   int       `json:"expires_in"`
	User        *userJSON `json:"user,omitempty"`
}

func toUserJSON(u auth.User) *userJSON {
	providers := u.Providers
	if providers == nil {
		providers = []string{}
	}
	return &userJSON{
		ID: u.ID, Email: u.Email, DisplayName: u.DisplayName, PictureURL: u.PictureURL,
		Providers: providers, CreatedAt: u.CreatedAt,
	}
}

// providers tells the web which sign-in buttons can work on this server.
func (h authHandlers) providers(c *gin.Context) {
	p := h.auth.Providers()
	c.JSON(http.StatusOK, gin.H{"google_code": p.GoogleCode, "line": p.Line})
}

// google accepts either an ID token (Google's rendered button) or an
// authorization code from the GIS code client (our own button).
func (h authHandlers) google(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAuthBody)
	var req struct {
		IDToken string `json:"id_token"`
		Code    string `json:"code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || (req.IDToken == "") == (req.Code == "") {
		writeError(c, http.StatusBadRequest, CodeInvalidRequest, "id_token or code is required")
		return
	}
	var (
		u   auth.User
		s   auth.Session
		err error
	)
	if req.Code != "" {
		u, s, err = h.auth.LoginWithGoogleCode(c.Request.Context(), req.Code)
	} else {
		u, s, err = h.auth.LoginWithGoogle(c.Request.Context(), req.IDToken)
	}
	if errors.Is(err, auth.ErrProviderDisabled) {
		writeError(c, http.StatusNotFound, CodeProviderDisabled, "this sign-in method is not set up")
		return
	}
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

// lineStart begins LINE Login: it remembers state and nonce in a short-lived
// cookie and returns the LINE URL to send the browser to.
func (h authHandlers) lineStart(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAuthBody)
	var req struct {
		RedirectURI string `json:"redirect_uri"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || !h.allowedLineRedirect(req.RedirectURI) {
		writeError(c, http.StatusBadRequest, CodeInvalidRequest, "redirect_uri must be "+lineCallbackPath+" on an allowed origin")
		return
	}
	st, err := h.auth.StartLine(req.RedirectURI)
	if errors.Is(err, auth.ErrProviderDisabled) {
		writeError(c, http.StatusNotFound, CodeProviderDisabled, "this sign-in method is not set up")
		return
	}
	if err != nil {
		h.internal(c, "line start", err)
		return
	}
	value := st.State + "~" + st.Nonce + "~" + base64.RawURLEncoding.EncodeToString([]byte(req.RedirectURI))
	h.setLineCookie(c, value, int(lineCookieTTL.Seconds()))
	c.Header("Cache-Control", "no-store")
	c.JSON(http.StatusOK, gin.H{"url": st.URL})
}

// line finishes LINE Login with the code and state LINE sent to the callback.
func (h authHandlers) line(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAuthBody)
	var req struct {
		Code  string `json:"code"`
		State string `json:"state"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.Code == "" || req.State == "" {
		writeError(c, http.StatusBadRequest, CodeInvalidRequest, "code and state are required")
		return
	}
	raw, _ := c.Cookie(lineCookie)
	h.setLineCookie(c, "", -1) // one attempt per start
	state, nonce, redirect, ok := parseLineCookie(raw)
	if !ok || subtle.ConstantTimeCompare([]byte(state), []byte(req.State)) != 1 {
		writeError(c, http.StatusBadRequest, CodeInvalidLineLogin, "line sign-in expired, please try again")
		return
	}
	u, s, err := h.auth.LoginWithLine(c.Request.Context(), req.Code, redirect, nonce)
	if errors.Is(err, auth.ErrProviderDisabled) {
		writeError(c, http.StatusNotFound, CodeProviderDisabled, "this sign-in method is not set up")
		return
	}
	if errors.Is(err, auth.ErrInvalidLineLogin) {
		h.log.InfoContext(c.Request.Context(), "line sign-in rejected", slog.Any("error", err))
		writeError(c, http.StatusUnauthorized, CodeInvalidLineLogin, "line sign-in failed")
		return
	}
	if err != nil {
		h.internal(c, "line sign-in", err)
		return
	}
	h.writeSession(c, s, toUserJSON(u))
}

func parseLineCookie(raw string) (state, nonce, redirect string, ok bool) {
	parts := strings.Split(raw, "~")
	if len(parts) != 3 || parts[0] == "" || parts[1] == "" {
		return "", "", "", false
	}
	r, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil || len(r) == 0 {
		return "", "", "", false
	}
	return parts[0], parts[1], string(r), true
}

// allowedLineRedirect accepts only our callback page on a configured web
// origin, so LINE never sends a code anywhere else.
func (h authHandlers) allowedLineRedirect(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Path != lineCallbackPath || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
		return false
	}
	return slices.Contains(h.origins, u.Scheme+"://"+u.Host)
}

// The LINE cookie is Lax, not Strict: the callback page is reached by a
// cross-site redirect from LINE.
func (h authHandlers) setLineCookie(c *gin.Context, value string, maxAge int) {
	http.SetCookie(c.Writer, &http.Cookie{ //nolint:gosec // G124: Secure comes from config, see CookieConfig
		Name: lineCookie, Value: value, Path: "/", Domain: h.cookie.Domain, MaxAge: maxAge,
		HttpOnly: true, Secure: h.cookie.Secure, SameSite: http.SameSiteLaxMode,
	})
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

// patchMe lets the user change the name shown in the app.
func (h authHandlers) patchMe(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxAuthBody)
	var req struct {
		DisplayName *string `json:"display_name"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || req.DisplayName == nil {
		writeError(c, http.StatusBadRequest, CodeInvalidRequest, "display_name is required")
		return
	}
	u, err := h.auth.UpdateDisplayName(c.Request.Context(), c.MustGet(userIDKey).(uuid.UUID), *req.DisplayName)
	switch {
	case errors.Is(err, auth.ErrInvalidDisplayName):
		writeError(c, http.StatusUnprocessableEntity, CodeValidationFailed,
			fmt.Sprintf("display_name must be 1-%d characters", auth.MaxDisplayNameLen))
	case errors.Is(err, auth.ErrUserNotFound):
		writeError(c, http.StatusUnauthorized, CodeUnauthorized, "account no longer exists")
	case err != nil:
		h.internal(c, "update display name", err)
	default:
		c.JSON(http.StatusOK, toUserJSON(u))
	}
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
