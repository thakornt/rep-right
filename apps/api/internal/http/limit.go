package http

import (
	"context"
	"crypto/subtle"
	"math"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Headers the web's /api proxy (apps/web/src/proxy.ts) adds to every request
// it forwards. The client IP header is trusted only next to the right secret.
const (
	proxySecretHeader = "X-RR-Proxy-Secret" //nolint:gosec // G101: a header name, not a credential
	clientIPHeader    = "X-RR-Client-IP"
	clientIPKey       = "client_ip"
)

// Rate is a token bucket: PerMinute tokens refill evenly; Burst is how many
// requests may arrive at once.
type Rate struct {
	PerMinute int
	Burst     int
}

// Limits protects the API from floods. A zero Limits means DefaultLimits.
// The buckets live in memory, per instance: with several instances each one
// counts on its own.
type Limits struct {
	PerIP          Rate          // every request, keyed by client IP
	Auth           Rate          // /v1/auth/*, keyed by client IP
	PerUser        Rate          // signed-in routes, keyed by user ID
	MaxInFlight    int           // concurrent requests before answering 503
	RequestTimeout time.Duration // deadline for each request's context (and its DB queries)
	MaxBody        int64         // largest request body, in bytes
}

func DefaultLimits() Limits {
	return Limits{
		PerIP:          Rate{PerMinute: 300, Burst: 60},
		Auth:           Rate{PerMinute: 20, Burst: 10},
		PerUser:        Rate{PerMinute: 120, Burst: 40},
		MaxInFlight:    100,
		RequestTimeout: 10 * time.Second,
		MaxBody:        maxSessionBody,
	}
}

// proxyGuard rejects requests that did not come through our web proxy, so the
// API host cannot be called directly. /healthz stays open for the platform's
// health check. An empty secret (local development) turns the guard off.
func proxyGuard(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		got := c.GetHeader(proxySecretHeader)
		viaProxy := secret != "" && subtle.ConstantTimeCompare([]byte(got), []byte(secret)) == 1
		ip := c.RemoteIP()
		if viaProxy {
			if p := net.ParseIP(c.GetHeader(clientIPHeader)); p != nil {
				ip = p.String()
			}
		}
		c.Set(clientIPKey, ip)
		if secret != "" && !viaProxy && c.Request.URL.Path != "/healthz" {
			writeError(c, http.StatusForbidden, CodeForbidden, "requests must come through the web app")
			return
		}
		c.Next()
	}
}

func clientIP(c *gin.Context) string {
	if ip := c.GetString(clientIPKey); ip != "" {
		return ip
	}
	return c.RemoteIP()
}

// inFlight sheds load: past max concurrent requests it answers 503 at once
// instead of queueing until everything times out.
func inFlight(max int) gin.HandlerFunc {
	slots := make(chan struct{}, max)
	return func(c *gin.Context) {
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
			c.Next()
		default:
			c.Header("Retry-After", "1")
			writeError(c, http.StatusServiceUnavailable, CodeUnavailable, "server busy, please try again")
		}
	}
}

// requestLimits bounds each request's body and lifetime. The deadline reaches
// the database through the request context, so a slow query is cancelled.
func requestLimits(maxBody int64, timeout time.Duration) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Body != nil {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBody)
		}
		ctx, cancel := context.WithTimeout(c.Request.Context(), timeout)
		defer cancel()
		c.Request = c.Request.WithContext(ctx)
		c.Next()
	}
}

func rateLimit(l *keyedLimiter, key func(*gin.Context) string) gin.HandlerFunc {
	return func(c *gin.Context) {
		ok, wait := l.allow(key(c))
		if ok {
			c.Next()
			return
		}
		c.Header("Retry-After", strconv.Itoa(int(math.Ceil(wait.Seconds()))))
		writeError(c, http.StatusTooManyRequests, CodeRateLimited, "too many requests, please slow down")
	}
}

func userKey(c *gin.Context) string { return c.MustGet(userIDKey).(uuid.UUID).String() }

// keyedLimiter is one token bucket per key. Idle buckets are swept; if there
// are still too many keys it refuses new ones rather than grow without bound.
type keyedLimiter struct {
	perSec  float64
	burst   float64
	maxKeys int
	now     func() time.Time

	mu        sync.Mutex
	buckets   map[string]*bucket
	lastSweep time.Time
}

type bucket struct {
	tokens float64
	last   time.Time
}

const limiterMaxKeys = 100_000

func newKeyedLimiter(r Rate, now func() time.Time) *keyedLimiter {
	return &keyedLimiter{
		perSec: float64(r.PerMinute) / 60, burst: float64(r.Burst), maxKeys: limiterMaxKeys,
		now: now, buckets: map[string]*bucket{}, lastSweep: now(),
	}
}

// idle is how long until an empty bucket is full again, after which it can be
// forgotten without changing any answer.
func (l *keyedLimiter) idle() time.Duration {
	return time.Duration(l.burst / l.perSec * float64(time.Second))
}

func (l *keyedLimiter) allow(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	if now.Sub(l.lastSweep) > time.Minute || len(l.buckets) >= l.maxKeys {
		l.sweep(now)
	}
	b, ok := l.buckets[key]
	if !ok {
		if len(l.buckets) >= l.maxKeys {
			return false, time.Second
		}
		b = &bucket{tokens: l.burst, last: now}
		l.buckets[key] = b
	}
	b.tokens = math.Min(l.burst, b.tokens+now.Sub(b.last).Seconds()*l.perSec)
	b.last = now
	if b.tokens >= 1 {
		b.tokens--
		return true, 0
	}
	return false, time.Duration((1 - b.tokens) / l.perSec * float64(time.Second))
}

func (l *keyedLimiter) sweep(now time.Time) {
	idle := l.idle()
	for k, b := range l.buckets {
		if now.Sub(b.last) > idle {
			delete(l.buckets, k)
		}
	}
	l.lastSweep = now
}
