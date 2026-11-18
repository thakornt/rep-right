package http

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type fakePrograms struct {
	byUser map[uuid.UUID]string
	err    error
}

func (f *fakePrograms) Program(_ context.Context, u uuid.UUID) (string, error) {
	return f.byUser[u], f.err
}

func (f *fakePrograms) SetProgram(_ context.Context, u uuid.UUID, id string) error {
	if f.err != nil {
		return f.err
	}
	if id == "" {
		delete(f.byUser, u)
	} else {
		f.byUser[u] = id
	}
	return nil
}

func newProgramRouter(f *fakePrograms) *gin.Engine {
	gin.SetMode(gin.TestMode)
	return NewRouter(Deps{
		Log:      slog.New(slog.NewTextHandler(io.Discard, nil)),
		DB:       fakePinger{},
		Auth:     &fakeAuth{},
		Programs: f,
	})
}

func TestProgramNeedsSignIn(t *testing.T) {
	r := newProgramRouter(&fakePrograms{byUser: map[uuid.UUID]string{}})
	for _, m := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
		w := send(r, m, "/v1/me/program", `{"program_id":"ppl-2"}`, nil)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("%s without token = %d, want 401", m, w.Code)
		}
	}
}

func TestProgramGetPutDelete(t *testing.T) {
	f := &fakePrograms{byUser: map[uuid.UUID]string{}}
	r := newProgramRouter(f)

	if w := send(r, http.MethodGet, "/v1/me/program", "", bearer); w.Code != http.StatusOK || w.Body.String() != `{"program_id":null}` {
		t.Fatalf("get before choosing = %d %s", w.Code, w.Body)
	}
	if w := send(r, http.MethodPut, "/v1/me/program", `{"program_id":"ppl-2"}`, bearer); w.Code != http.StatusOK || w.Body.String() != `{"program_id":"ppl-2"}` {
		t.Fatalf("put = %d %s", w.Code, w.Body)
	}
	if f.byUser[testUser.ID] != "ppl-2" {
		t.Errorf("stored %q for the signed-in user", f.byUser[testUser.ID])
	}
	if w := send(r, http.MethodGet, "/v1/me/program", "", bearer); w.Body.String() != `{"program_id":"ppl-2"}` {
		t.Errorf("get after put = %s", w.Body)
	}
	if w := send(r, http.MethodDelete, "/v1/me/program", "", bearer); w.Code != http.StatusNoContent {
		t.Errorf("delete = %d", w.Code)
	}
	if w := send(r, http.MethodGet, "/v1/me/program", "", bearer); w.Body.String() != `{"program_id":null}` {
		t.Errorf("get after delete = %s", w.Body)
	}
}

func TestProgramPutRejectsBadInput(t *testing.T) {
	f := &fakePrograms{byUser: map[uuid.UUID]string{}}
	r := newProgramRouter(f)
	for _, tc := range []struct {
		body   string
		status int
		code   string
	}{
		{`not json`, http.StatusBadRequest, CodeInvalidRequest},
		{`{"program_id":"made-up"}`, http.StatusUnprocessableEntity, CodeValidationFailed},
		{`{"program_id":""}`, http.StatusUnprocessableEntity, CodeValidationFailed},
		{`{}`, http.StatusUnprocessableEntity, CodeValidationFailed},
	} {
		w := send(r, http.MethodPut, "/v1/me/program", tc.body, bearer)
		if w.Code != tc.status || !hasErrorCode(w.Body.String(), tc.code) {
			t.Errorf("put %s = %d %s, want %d %s", tc.body, w.Code, w.Body, tc.status, tc.code)
		}
	}
	if len(f.byUser) != 0 {
		t.Errorf("bad input stored something: %v", f.byUser)
	}
}

func TestProgramStoreErrorIsInternal(t *testing.T) {
	r := newProgramRouter(&fakePrograms{byUser: map[uuid.UUID]string{}, err: errors.New("db down")})
	w := send(r, http.MethodGet, "/v1/me/program", "", bearer)
	if w.Code != http.StatusInternalServerError || !hasErrorCode(w.Body.String(), CodeInternal) {
		t.Errorf("get with store error = %d %s", w.Code, w.Body)
	}
}

func hasErrorCode(body, code string) bool {
	return strings.Contains(body, `"code":"`+code+`"`)
}
