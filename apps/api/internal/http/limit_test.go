package http

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/thakornt/rep-right/apps/api/internal/domain/workout"
)

type clock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *clock) now() time.Time      { c.mu.Lock(); defer c.mu.Unlock(); return c.t }
func (c *clock) add(d time.Duration) { c.mu.Lock(); c.t = c.t.Add(d); c.mu.Unlock() }

func TestKeyedLimiterBurstThenRefill(t *testing.T) {
	clk := &clock{t: fixedNow}
	l := newKeyedLimiter(Rate{PerMinute: 60, Burst: 3}, clk.now)
	for i := range 3 {
		if ok, _ := l.allow("a"); !ok {
			t.Fatalf("request %d within burst was refused", i+1)
		}
	}
	ok, wait := l.allow("a")
	if ok || wait <= 0 || wait > time.Second {
		t.Fatalf("4th request: ok=%v wait=%v, want refused with wait <= 1s", ok, wait)
	}
	if ok, _ := l.allow("b"); !ok {
		t.Error("another key must have its own bucket")
	}
	clk.add(time.Second)
	if ok, _ := l.allow("a"); !ok {
		t.Error("one token should refill after a second at 60/min")
	}
}

func TestKeyedLimiterSweepsAndCapsKeys(t *testing.T) {
	clk := &clock{t: fixedNow}
	l := newKeyedLimiter(Rate{PerMinute: 60, Burst: 2}, clk.now)
	l.maxKeys = 2
	l.allow("a")
	l.allow("b")
	if ok, _ := l.allow("c"); ok {
		t.Error("a new key past maxKeys must be refused while the others are active")
	}
	clk.add(time.Minute + time.Second) // a and b are full again: forgettable
	if ok, _ := l.allow("c"); !ok {
		t.Error("after idle buckets are swept, a new key must fit")
	}
	if len(l.buckets) != 1 {
		t.Errorf("buckets = %d, want 1 after sweep", len(l.buckets))
	}
}

// hdr builds canonical headers, as a real HTTP request would have them.
func hdr(kv ...string) http.Header {
	h := http.Header{}
	for i := 0; i+1 < len(kv); i += 2 {
		h.Set(kv[i], kv[i+1])
	}
	return h
}

func limitedRouter(lim Limits, secret string) *gin.Engine {
	gin.SetMode(gin.TestMode)
	return NewRouter(Deps{
		Log:         slog.New(slog.NewTextHandler(io.Discard, nil)),
		DB:          fakePinger{},
		Auth:        &fakeAuth{},
		Workouts:    newFakeWorkouts(),
		Now:         func() time.Time { return fixedNow },
		ProxySecret: secret,
		Limits:      lim,
	})
}

func testLimits() Limits {
	l := DefaultLimits()
	l.PerIP = Rate{PerMinute: 60, Burst: 1000}
	l.Auth = Rate{PerMinute: 60, Burst: 1000}
	l.PerUser = Rate{PerMinute: 60, Burst: 1000}
	return l
}

func TestAuthRoutesAreRateLimitedPerIP(t *testing.T) {
	lim := testLimits()
	lim.Auth = Rate{PerMinute: 60, Burst: 2}
	r := limitedRouter(lim, "")
	for range 2 {
		if w := send(r, http.MethodPost, "/v1/auth/google", `{"id_token":"bad"}`, nil); w.Code == http.StatusTooManyRequests {
			t.Fatal("refused within burst")
		}
	}
	w := send(r, http.MethodPost, "/v1/auth/google", `{"id_token":"bad"}`, nil)
	if w.Code != http.StatusTooManyRequests || decodeError(t, w).Code != CodeRateLimited {
		t.Fatalf("3rd sign-in: %d %s, want 429 rate_limited", w.Code, w.Body)
	}
	if w.Header().Get("Retry-After") == "" {
		t.Error("429 must carry Retry-After")
	}
	// Other routes use their own, larger bucket.
	if w := send(r, http.MethodGet, "/v1/exercises", "", nil); w.Code != http.StatusOK {
		t.Errorf("exercises after auth limit: %d", w.Code)
	}
}

func TestSignedInRoutesAreRateLimitedPerUser(t *testing.T) {
	lim := testLimits()
	lim.PerUser = Rate{PerMinute: 60, Burst: 2}
	r := limitedRouter(lim, "")
	for range 2 {
		send(r, http.MethodGet, "/v1/me", "", bearer)
	}
	w := send(r, http.MethodGet, "/v1/sessions", "", bearer)
	if w.Code != http.StatusTooManyRequests {
		t.Fatalf("3rd request by the same user: %d, want 429", w.Code)
	}
}

func TestPerIPLimitCoversEveryRoute(t *testing.T) {
	lim := testLimits()
	lim.PerIP = Rate{PerMinute: 60, Burst: 1}
	r := limitedRouter(lim, "")
	send(r, http.MethodGet, "/healthz", "", nil)
	if w := send(r, http.MethodGet, "/v1/exercises", "", nil); w.Code != http.StatusTooManyRequests {
		t.Fatalf("got %d, want 429", w.Code)
	}
}

func TestProxyGuard(t *testing.T) {
	const secret = "0123456789abcdef0123456789abcdef"
	r := limitedRouter(testLimits(), secret)

	w := send(r, http.MethodGet, "/v1/exercises", "", nil)
	if w.Code != http.StatusForbidden || decodeError(t, w).Code != CodeForbidden {
		t.Fatalf("direct call: %d %s, want 403", w.Code, w.Body)
	}
	if w := send(r, http.MethodGet, "/v1/exercises", "", hdr(proxySecretHeader, "wrong")); w.Code != http.StatusForbidden {
		t.Errorf("wrong secret: %d, want 403", w.Code)
	}
	if w := send(r, http.MethodGet, "/healthz", "", nil); w.Code != http.StatusOK {
		t.Errorf("healthz must stay open for the platform: %d", w.Code)
	}
	if w := send(r, http.MethodGet, "/v1/exercises", "", hdr(proxySecretHeader, secret)); w.Code != http.StatusOK {
		t.Errorf("through proxy: %d", w.Code)
	}
}

func TestClientIPHeaderTrustedOnlyWithSecret(t *testing.T) {
	const secret = "0123456789abcdef0123456789abcdef"
	lim := testLimits()
	lim.PerIP = Rate{PerMinute: 60, Burst: 1}

	// Through the proxy, each client IP gets its own bucket.
	r := limitedRouter(lim, secret)
	for _, ip := range []string{"203.0.113.1", "203.0.113.2"} {
		h := hdr(proxySecretHeader, secret, clientIPHeader, ip)
		if w := send(r, http.MethodGet, "/v1/exercises", "", h); w.Code != http.StatusOK {
			t.Errorf("client %s: %d, want 200", ip, w.Code)
		}
	}

	// Without the proxy, a made-up client IP (or X-Forwarded-For) is ignored.
	r = limitedRouter(lim, "")
	send(r, http.MethodGet, "/v1/exercises", "", nil)
	h := hdr(clientIPHeader, "203.0.113.9", "X-Forwarded-For", "203.0.113.9")
	if w := send(r, http.MethodGet, "/v1/exercises", "", h); w.Code != http.StatusTooManyRequests {
		t.Errorf("spoofed client IP: %d, want 429", w.Code)
	}
}

func TestInFlightShedsLoad(t *testing.T) {
	release := make(chan struct{})
	var entered atomic.Int32
	r := gin.New()
	r.Use(inFlight(1))
	r.GET("/slow", func(c *gin.Context) { entered.Add(1); <-release; c.Status(http.StatusOK) })

	done := make(chan int)
	go func() {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/slow", nil))
		done <- w.Code
	}()
	for entered.Load() == 0 {
		time.Sleep(time.Millisecond)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/slow", nil))
	if w.Code != http.StatusServiceUnavailable || w.Header().Get("Retry-After") == "" {
		t.Errorf("second concurrent request: %d, want 503 with Retry-After", w.Code)
	}
	close(release)
	if code := <-done; code != http.StatusOK {
		t.Errorf("first request: %d", code)
	}
}

func TestBodyLimitAppliesToEveryRoute(t *testing.T) {
	lim := testLimits()
	lim.MaxBody = 64
	r := limitedRouter(lim, "")
	body := `{"kind":"terms","version":"` + string(make([]byte, 200)) + `"}`
	if w := send(r, http.MethodPost, "/v1/me/consents", body, bearer); w.Code != http.StatusBadRequest {
		t.Errorf("oversized consent body: %d, want 400", w.Code)
	}
}

func TestRequestTimeoutReachesHandlers(t *testing.T) {
	r := gin.New()
	r.Use(requestLimits(1<<10, 20*time.Millisecond))
	r.GET("/", func(c *gin.Context) {
		<-c.Request.Context().Done()
		if errors.Is(c.Request.Context().Err(), context.DeadlineExceeded) {
			c.Status(http.StatusGatewayTimeout)
		}
	})
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/", nil))
	if w.Code != http.StatusGatewayTimeout {
		t.Errorf("got %d, want the handler to see the deadline", w.Code)
	}
}

type countingPinger struct{ n atomic.Int32 }

func (p *countingPinger) Ping(context.Context) error { p.n.Add(1); return nil }

func TestHealthzReusesPing(t *testing.T) {
	clk := &clock{t: fixedNow}
	p := &countingPinger{}
	r := gin.New()
	r.GET("/healthz", healthz(p, "v", clk.now))
	for range 5 {
		r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/healthz", nil))
	}
	if p.n.Load() != 1 {
		t.Errorf("pings = %d, want 1 within %v", p.n.Load(), healthTTL)
	}
	clk.add(healthTTL + time.Second)
	r.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/healthz", nil))
	if p.n.Load() != 2 {
		t.Errorf("pings = %d, want 2 after the TTL", p.n.Load())
	}
}

type countingWorkouts struct {
	*fakeWorkouts
	lists int
}

func (c *countingWorkouts) ListExercises(ctx context.Context) ([]workout.Exercise, error) {
	c.lists++
	return c.fakeWorkouts.ListExercises(ctx)
}

func TestExerciseCache(t *testing.T) {
	clk := &clock{t: fixedNow}
	src := &countingWorkouts{fakeWorkouts: newFakeWorkouts()}
	c := newExerciseCache(src, clk.now)
	ctx := context.Background()
	for range 3 {
		if _, err := c.ListExercises(ctx); err != nil {
			t.Fatal(err)
		}
	}
	if e, err := c.ExerciseBySlug(ctx, "back-squat"); err != nil || e.Slug != "back-squat" {
		t.Fatalf("by slug: %+v %v", e, err)
	}
	if _, err := c.ExerciseBySlug(ctx, "nope"); !errors.Is(err, workout.ErrNotFound) {
		t.Errorf("unknown slug: %v", err)
	}
	if src.lists != 1 {
		t.Errorf("store hit %d times, want 1", src.lists)
	}
	clk.add(exerciseTTL + time.Second)
	_, _ = c.ListExercises(ctx)
	if src.lists != 2 {
		t.Errorf("store hit %d times after TTL, want 2", src.lists)
	}
}

func TestDailyLimitIs429(t *testing.T) {
	f := newFakeWorkouts()
	f.createErr = workout.ErrDailyLimit
	w := send(newWorkoutRouter(f), http.MethodPost, "/v1/sessions", goodSession, bearer)
	if w.Code != http.StatusTooManyRequests || decodeError(t, w).Code != CodeDailyLimit {
		t.Fatalf("got %d %s, want 429 daily_limit", w.Code, w.Body)
	}
}
