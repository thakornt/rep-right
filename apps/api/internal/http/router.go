// Package http wires the Gin router, middleware and handlers.
package http

import (
	"context"
	"log/slog"
	"net/http"
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
}

func NewRouter(d Deps) *gin.Engine {
	r := gin.New()
	r.HandleMethodNotAllowed = true
	r.Use(requestID(), recovery(d.Log), accessLog(d.Log), cors(d.AllowedOrigins))

	r.NoRoute(func(c *gin.Context) {
		writeError(c, http.StatusNotFound, CodeNotFound, "route not found")
	})
	r.NoMethod(func(c *gin.Context) {
		writeError(c, http.StatusMethodNotAllowed, CodeMethodNotAllowed, "method not allowed")
	})

	r.GET("/healthz", healthz(d.DB, d.Version))

	if d.Auth != nil {
		h := authHandlers{auth: d.Auth, cookie: d.Cookie, log: d.Log}
		v1 := r.Group("/v1")
		v1.POST("/auth/google", h.google)
		v1.POST("/auth/refresh", h.refresh)
		v1.POST("/auth/logout", h.logout)

		me := v1.Group("/me", h.requireUser)
		me.GET("", h.me)
		me.DELETE("", h.deleteMe)

		if d.Workouts != nil {
			now := d.Now
			if now == nil {
				now = time.Now
			}
			w := workoutHandlers{store: d.Workouts, log: d.Log, now: now}
			v1.GET("/exercises", w.listExercises)

			me.GET("/consents", w.listConsents)
			me.POST("/consents", w.grantConsent)
			me.DELETE("/consents/:kind", w.withdrawConsent)

			s := v1.Group("/sessions", h.requireUser)
			s.GET("", w.listSessions)
			s.POST("", w.createSession)
			s.GET("/last", w.lastSession)
			s.GET("/:id", w.getSession)
			s.PUT("/:id", w.updateSession)
			s.DELETE("/:id", w.deleteSession)
		}
	}
	return r
}

func healthz(db Pinger, version string) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := db.Ping(ctx); err != nil {
			writeError(c, http.StatusServiceUnavailable, CodeUnavailable, "database unreachable")
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok", "version": version})
	}
}
