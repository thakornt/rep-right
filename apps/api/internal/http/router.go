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
