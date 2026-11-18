// Package http wires the Gin router, middleware and handlers.
package http

import (
	"context"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Pinger reports whether a dependency (the database) is reachable.
type Pinger interface {
	Ping(ctx context.Context) error
}

type Deps struct {
	Log            *slog.Logger
	DB             Pinger
	AllowedOrigins []string
	Version        string
	// Auth enables the /v1 routes; nil leaves only /healthz (used in tests).
	Auth   Authenticator
	Cookie CookieConfig
	// Workouts enables exercises, sessions and consents (needs Auth).
	Workouts Workouts
	Now      func() time.Time // defaults to time.Now
	// ProxySecret, when set, must arrive in X-RR-Proxy-Secret on every
	// request except /healthz: only our web proxy knows it.
	ProxySecret string
	Limits      Limits // zero = DefaultLimits()
}

func NewRouter(d Deps) *gin.Engine {
	now := d.Now
	if now == nil {
		now = time.Now
	}
	lim := d.Limits
	if lim == (Limits{}) {
		lim = DefaultLimits()
	}
	ipLimit := rateLimit(newKeyedLimiter(lim.PerIP, now), clientIP)
	authLimit := rateLimit(newKeyedLimiter(lim.Auth, now), clientIP)
	userLimit := rateLimit(newKeyedLimiter(lim.PerUser, now), userKey)

	r := gin.New()
	r.HandleMethodNotAllowed = true
	// The client IP comes from proxyGuard, never from X-Forwarded-For, which
	// anyone can send.
	_ = r.SetTrustedProxies(nil)
	r.Use(requestID(), recovery(d.Log), accessLog(d.Log), securityHeaders(), cors(d.AllowedOrigins),
		proxyGuard(d.ProxySecret), inFlight(lim.MaxInFlight), ipLimit,
		requestLimits(lim.MaxBody, lim.RequestTimeout))

	r.NoRoute(func(c *gin.Context) {
		writeError(c, http.StatusNotFound, CodeNotFound, "route not found")
	})
	r.NoMethod(func(c *gin.Context) {
		writeError(c, http.StatusMethodNotAllowed, CodeMethodNotAllowed, "method not allowed")
	})

	r.GET("/healthz", healthz(d.DB, d.Version, now))

	if d.Auth != nil {
		h := authHandlers{auth: d.Auth, cookie: d.Cookie, origins: d.AllowedOrigins, log: d.Log}
		v1 := r.Group("/v1")
		a := v1.Group("/auth", authLimit)
		a.GET("/providers", h.providers)
		a.POST("/google", h.google)
		a.POST("/line/start", h.lineStart)
		a.POST("/line", h.line)
		a.POST("/refresh", h.refresh)
		a.POST("/logout", h.logout)

		me := v1.Group("/me", h.requireUser, userLimit)
		me.GET("", h.me)
		me.PATCH("", h.patchMe)
		me.DELETE("", h.deleteMe)

		if d.Workouts != nil {
			w := workoutHandlers{store: newExerciseCache(d.Workouts, now), log: d.Log, now: now}
			v1.GET("/exercises", w.listExercises)

			me.GET("/consents", w.listConsents)
			me.POST("/consents", w.grantConsent)
			me.DELETE("/consents/:kind", w.withdrawConsent)

			s := v1.Group("/sessions", h.requireUser, userLimit)
			s.GET("", w.listSessions)
			s.POST("", w.createSession)
			s.GET("/last", w.lastSession)
			s.GET("/:id", w.getSession)
			s.PUT("/:id", w.updateSession)
			s.DELETE("/:id", w.deleteSession)

			ins := v1.Group("/insights", h.requireUser, userLimit)
			ins.GET("/load", w.loadInsights)
			ins.GET("/return-plan", w.returnPlan)
		}
	}
	return r
}

// healthTTL is how long a database ping result is reused, so hammering
// /healthz (which needs no sign-in) cannot hammer the database.
const healthTTL = 5 * time.Second

func healthz(db Pinger, version string, now func() time.Time) gin.HandlerFunc {
	var (
		mu      sync.Mutex
		checked time.Time
		lastErr error
	)
	return func(c *gin.Context) {
		mu.Lock()
		if t := now(); checked.IsZero() || t.Sub(checked) > healthTTL {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
			lastErr = db.Ping(ctx)
			cancel()
			checked = t
		}
		err := lastErr
		mu.Unlock()
		if err != nil {
			writeError(c, http.StatusServiceUnavailable, CodeUnavailable, "database unreachable")
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok", "version": version})
	}
}
