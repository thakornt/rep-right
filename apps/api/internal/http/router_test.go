package http

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

type fakePinger struct{ err error }

func (f fakePinger) Ping(context.Context) error { return f.err }

func newTestRouter(db Pinger) *gin.Engine {
	gin.SetMode(gin.TestMode)
	return NewRouter(Deps{
		Log:            slog.New(slog.NewTextHandler(io.Discard, nil)),
		DB:             db,
		AllowedOrigins: []string{"http://localhost:3000"},
	})
}

func do(r http.Handler, method, path string, header http.Header) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	for k, v := range header {
		req.Header[k] = v
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func decodeError(t *testing.T, w *httptest.ResponseRecorder) errorDetail {
	t.Helper()
	var body errorBody
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("decode error body %q: %v", w.Body.String(), err)
	}
	return body.Error
}

func TestHealthzOK(t *testing.T) {
	w := do(newTestRouter(fakePinger{}), http.MethodGet, "/healthz", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	if w.Header().Get(requestIDHeader) == "" {
		t.Error("missing X-Request-ID header")
	}
}

func TestHealthzDBDown(t *testing.T) {
	w := do(newTestRouter(fakePinger{err: errors.New("down")}), http.MethodGet, "/healthz", nil)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", w.Code)
	}
	if got := decodeError(t, w).Code; got != CodeUnavailable {
		t.Errorf("code = %q, want %q", got, CodeUnavailable)
	}
}

func TestUnknownRouteUsesErrorFormat(t *testing.T) {
	w := do(newTestRouter(fakePinger{}), http.MethodGet, "/nope", nil)
	if w.Code != http.StatusNotFound || decodeError(t, w).Code != CodeNotFound {
		t.Fatalf("got %d %s", w.Code, w.Body.String())
	}
}

func TestWrongMethodUsesErrorFormat(t *testing.T) {
	w := do(newTestRouter(fakePinger{}), http.MethodPost, "/healthz", nil)
	if w.Code != http.StatusMethodNotAllowed || decodeError(t, w).Code != CodeMethodNotAllowed {
		t.Fatalf("got %d %s", w.Code, w.Body.String())
	}
}

func TestCORS(t *testing.T) {
	r := newTestRouter(fakePinger{})

	w := do(r, http.MethodOptions, "/healthz", http.Header{"Origin": {"http://localhost:3000"}})
	if w.Code != http.StatusNoContent {
		t.Fatalf("preflight status = %d, want 204", w.Code)
	}
	if w.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" ||
		w.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Errorf("missing CORS headers for allowed origin: %v", w.Header())
	}

	w = do(r, http.MethodGet, "/healthz", http.Header{"Origin": {"https://evil.test"}})
	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Error("CORS header set for disallowed origin")
	}
}

func TestPanicReturnsStandardError(t *testing.T) {
	r := newTestRouter(fakePinger{})
	r.GET("/boom", func(*gin.Context) { panic("boom") })
	w := do(r, http.MethodGet, "/boom", nil)
	if w.Code != http.StatusInternalServerError || decodeError(t, w).Code != CodeInternal {
		t.Fatalf("got %d %s", w.Code, w.Body.String())
	}
}
