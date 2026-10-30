package http

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/thakornt/rep-right/apps/api/internal/domain/workout"
)

var (
	fixedNow = time.Date(2026, 10, 30, 15, 0, 0, 0, time.UTC)
	squat    = workout.Exercise{ID: 1, Slug: "back-squat", NameTH: "สควอท", NameEN: "Back Squat", Category: "squat", IsLowerBody: true}
)

// fakeWorkouts keeps sessions of every user in one map, so a handler that
// forgot to pass the user ID would be caught by the ownership tests.
type fakeWorkouts struct {
	sessions map[uuid.UUID]ownedSession
	consent  bool
	from, to time.Time
	withdrew string
	tops     []workout.TopSet
}

type ownedSession struct {
	owner uuid.UUID
	l     workout.Logged
}

func newFakeWorkouts() *fakeWorkouts { return &fakeWorkouts{sessions: map[uuid.UUID]ownedSession{}} }

func (f *fakeWorkouts) ListExercises(context.Context) ([]workout.Exercise, error) {
	return []workout.Exercise{squat}, nil
}

func (f *fakeWorkouts) ExerciseBySlug(_ context.Context, slug string) (workout.Exercise, error) {
	if slug == squat.Slug {
		return squat, nil
	}
	return workout.Exercise{}, workout.ErrNotFound
}

func (f *fakeWorkouts) save(user, id uuid.UUID, in workout.Session) (workout.Logged, error) {
	if in.PainFlag && !f.consent {
		return workout.Logged{}, workout.ErrConsentRequired
	}
	for _, s := range in.Sets {
		if s.ExerciseID != squat.ID {
			return workout.Logged{}, workout.ErrUnknownExercise
		}
	}
	l := workout.Logged{ID: id, PerformedAt: in.PerformedAt, Notes: in.Notes, PainFlag: in.PainFlag, Sets: in.Sets}
	f.sessions[id] = ownedSession{user, l}
	return l, nil
}

func (f *fakeWorkouts) CreateSession(_ context.Context, user uuid.UUID, in workout.Session) (workout.Logged, error) {
	return f.save(user, uuid.New(), in)
}

func (f *fakeWorkouts) UpdateSession(_ context.Context, user, id uuid.UUID, in workout.Session) (workout.Logged, error) {
	if s, ok := f.sessions[id]; !ok || s.owner != user {
		return workout.Logged{}, workout.ErrNotFound
	}
	return f.save(user, id, in)
}

func (f *fakeWorkouts) GetSession(_ context.Context, user, id uuid.UUID) (workout.Logged, error) {
	s, ok := f.sessions[id]
	if !ok || s.owner != user {
		return workout.Logged{}, workout.ErrNotFound
	}
	return s.l, nil
}

func (f *fakeWorkouts) DeleteSession(_ context.Context, user, id uuid.UUID) error {
	if s, ok := f.sessions[id]; !ok || s.owner != user {
		return workout.ErrNotFound
	}
	delete(f.sessions, id)
	return nil
}

func (f *fakeWorkouts) ListSessions(_ context.Context, user uuid.UUID, from, to time.Time, _ int32) ([]workout.Logged, error) {
	f.from, f.to = from, to
	out := []workout.Logged{}
	for _, s := range f.sessions {
		if s.owner == user {
			out = append(out, s.l)
		}
	}
	return out, nil
}

func (f *fakeWorkouts) LastWithExercise(_ context.Context, user uuid.UUID, _ int32) (workout.Logged, error) {
	for _, s := range f.sessions {
		if s.owner == user {
			return s.l, nil
		}
	}
	return workout.Logged{}, workout.ErrNotFound
}

func (f *fakeWorkouts) LatestTopSets(context.Context, uuid.UUID) ([]workout.TopSet, error) {
	return f.tops, nil
}

func (f *fakeWorkouts) ListConsents(context.Context, uuid.UUID) ([]workout.Consent, error) {
	if !f.consent {
		return []workout.Consent{}, nil
	}
	return []workout.Consent{{Kind: workout.ConsentHealthData, Version: "v1", AcceptedAt: fixedNow}}, nil
}

func (f *fakeWorkouts) GrantConsent(_ context.Context, _ uuid.UUID, kind, version string) (workout.Consent, error) {
	f.consent = kind == workout.ConsentHealthData
	return workout.Consent{Kind: kind, Version: version, AcceptedAt: fixedNow}, nil
}

func (f *fakeWorkouts) WithdrawConsent(_ context.Context, _ uuid.UUID, kind string) error {
	f.withdrew = kind
	return nil
}

func newWorkoutRouter(f *fakeWorkouts) *gin.Engine {
	gin.SetMode(gin.TestMode)
	return NewRouter(Deps{
		Log:      slog.New(slog.NewTextHandler(io.Discard, nil)),
		DB:       fakePinger{},
		Auth:     &fakeAuth{},
		Workouts: f,
		Now:      func() time.Time { return fixedNow },
	})
}

var bearer = http.Header{"Authorization": {"Bearer a1"}}

const goodSession = `{"performed_at":"2026-10-30","notes":"ok","sets":[
	{"exercise_id":1,"weight_kg":100,"reps":5,"rpe":8},
	{"exercise_id":1,"weight_kg":102.5,"reps":5}]}`

func createSession(t *testing.T, r http.Handler) sessionJSON {
	t.Helper()
	w := send(r, http.MethodPost, "/v1/sessions", goodSession, bearer)
	if w.Code != http.StatusCreated {
		t.Fatalf("create: %d %s", w.Code, w.Body)
	}
	var s sessionJSON
	if err := json.Unmarshal(w.Body.Bytes(), &s); err != nil {
		t.Fatal(err)
	}
	return s
}

func TestExercisesArePublic(t *testing.T) {
	w := send(newWorkoutRouter(newFakeWorkouts()), http.MethodGet, "/v1/exercises", "", nil)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"slug":"back-squat"`) ||
		!strings.Contains(w.Body.String(), `"is_lower_body":true`) {
		t.Fatalf("got %d %s", w.Code, w.Body)
	}
}

func TestSessionsRequireAuth(t *testing.T) {
	r := newWorkoutRouter(newFakeWorkouts())
	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/v1/sessions"},
		{http.MethodPost, "/v1/sessions"},
		{http.MethodGet, "/v1/sessions/last?exercise=back-squat"},
		{http.MethodGet, "/v1/sessions/" + uuid.NewString()},
		{http.MethodPut, "/v1/sessions/" + uuid.NewString()},
		{http.MethodDelete, "/v1/sessions/" + uuid.NewString()},
		{http.MethodGet, "/v1/me/consents"},
		{http.MethodPost, "/v1/me/consents"},
	} {
		if w := send(r, tc.method, tc.path, goodSession, nil); w.Code != http.StatusUnauthorized {
			t.Errorf("%s %s without token: %d", tc.method, tc.path, w.Code)
		}
	}
}

func TestSessionCRUD(t *testing.T) {
	f := newFakeWorkouts()
	r := newWorkoutRouter(f)
	s := createSession(t, r)
	if s.PerformedAt != "2026-10-30" || len(s.Sets) != 2 || s.Sets[0].RPE == nil || s.Sets[1].RPE != nil {
		t.Fatalf("created = %+v", s)
	}

	w := send(r, http.MethodGet, "/v1/sessions/"+s.ID.String(), "", bearer)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"rpe":null`) {
		t.Errorf("get: %d %s", w.Code, w.Body)
	}

	upd := `{"performed_at":"2026-10-29","sets":[{"exercise_id":1,"weight_kg":105,"reps":3}]}`
	w = send(r, http.MethodPut, "/v1/sessions/"+s.ID.String(), upd, bearer)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"performed_at":"2026-10-29"`) {
		t.Errorf("put: %d %s", w.Code, w.Body)
	}

	w = send(r, http.MethodGet, "/v1/sessions/last?exercise=back-squat", "", bearer)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), `"weight_kg":105`) {
		t.Errorf("last: %d %s", w.Code, w.Body)
	}

	if w = send(r, http.MethodDelete, "/v1/sessions/"+s.ID.String(), "", bearer); w.Code != http.StatusNoContent {
		t.Errorf("delete: %d", w.Code)
	}
	if w = send(r, http.MethodGet, "/v1/sessions/"+s.ID.String(), "", bearer); w.Code != http.StatusNotFound {
		t.Errorf("get after delete: %d", w.Code)
	}
}

func TestOtherUsersSessionIsNotFound(t *testing.T) {
	f := newFakeWorkouts()
	r := newWorkoutRouter(f)
	id := uuid.New()
	f.sessions[id] = ownedSession{owner: uuid.New(), l: workout.Logged{ID: id}}

	for _, m := range []string{http.MethodGet, http.MethodPut, http.MethodDelete} {
		w := send(r, m, "/v1/sessions/"+id.String(), goodSession, bearer)
		if w.Code != http.StatusNotFound || decodeError(t, w).Code != CodeNotFound {
			t.Errorf("%s: %d %s", m, w.Code, w.Body)
		}
	}
	if _, ok := f.sessions[id]; !ok {
		t.Fatal("someone else's session was deleted")
	}
	w := send(r, http.MethodGet, "/v1/sessions", "", bearer)
	if strings.Contains(w.Body.String(), id.String()) {
		t.Error("list leaks another user's session")
	}
}

func TestSessionValidation(t *testing.T) {
	r := newWorkoutRouter(newFakeWorkouts())
	cases := []struct {
		body   string
		status int
		code   string
	}{
		{`nope`, http.StatusBadRequest, CodeInvalidRequest},
		{`{"performed_at":"30/10/2026","sets":[{"exercise_id":1,"weight_kg":1,"reps":1}]}`, http.StatusUnprocessableEntity, CodeValidationFailed},
		{`{"performed_at":"2026-11-05","sets":[{"exercise_id":1,"weight_kg":1,"reps":1}]}`, http.StatusUnprocessableEntity, CodeValidationFailed},
		{`{"performed_at":"2026-10-30","sets":[]}`, http.StatusUnprocessableEntity, CodeValidationFailed},
		{`{"performed_at":"2026-10-30","sets":[{"exercise_id":1,"weight_kg":1,"reps":0}]}`, http.StatusUnprocessableEntity, CodeValidationFailed},
		{`{"performed_at":"2026-10-30","sets":[{"exercise_id":77,"weight_kg":1,"reps":1}]}`, http.StatusUnprocessableEntity, CodeValidationFailed},
		{`{"performed_at":"2026-10-30","sets":[{"exercise_id":1,"weight_kg":"heavy","reps":1}]}`, http.StatusBadRequest, CodeInvalidRequest},
	}
	for _, tc := range cases {
		w := send(r, http.MethodPost, "/v1/sessions", tc.body, bearer)
		if w.Code != tc.status || decodeError(t, w).Code != tc.code {
			t.Errorf("%.60s: got %d %s, want %d %s", tc.body, w.Code, w.Body, tc.status, tc.code)
		}
	}
	if w := send(r, http.MethodGet, "/v1/sessions/not-a-uuid", "", bearer); w.Code != http.StatusNotFound {
		t.Errorf("bad id: %d", w.Code)
	}
	if w := send(r, http.MethodGet, "/v1/sessions/last", "", bearer); w.Code != http.StatusUnprocessableEntity {
		t.Errorf("last without exercise: %d", w.Code)
	}
	if w := send(r, http.MethodGet, "/v1/sessions/last?exercise=nope", "", bearer); w.Code != http.StatusUnprocessableEntity {
		t.Errorf("last unknown exercise: %d", w.Code)
	}
	if w := send(r, http.MethodGet, "/v1/sessions/last?exercise=back-squat", "", bearer); w.Code != http.StatusNotFound {
		t.Errorf("last with no history: %d", w.Code)
	}
}

func TestListSessionsDateRange(t *testing.T) {
	f := newFakeWorkouts()
	r := newWorkoutRouter(f)

	if w := send(r, http.MethodGet, "/v1/sessions", "", bearer); w.Code != http.StatusOK {
		t.Fatalf("default range: %d %s", w.Code, w.Body)
	}
	if f.to.Format(dateLayout) != "2026-10-31" || f.from.Format(dateLayout) != "2026-08-02" {
		t.Errorf("default range = %v..%v, want last 90 days", f.from, f.to)
	}
	if w := send(r, http.MethodGet, "/v1/sessions?from=2026-01-01&to=2026-03-31", "", bearer); w.Code != http.StatusOK ||
		f.from.Format(dateLayout) != "2026-01-01" {
		t.Errorf("explicit range: %d, from=%v", w.Code, f.from)
	}
	for _, q := range []string{"from=2026-05-01&to=2026-04-01", "from=2024-01-01&to=2026-01-01", "from=yesterday"} {
		if w := send(r, http.MethodGet, "/v1/sessions?"+q, "", bearer); w.Code != http.StatusUnprocessableEntity {
			t.Errorf("%s: %d", q, w.Code)
		}
	}
}

func TestPainFlagNeedsConsent(t *testing.T) {
	f := newFakeWorkouts()
	r := newWorkoutRouter(f)
	pain := `{"performed_at":"2026-10-30","pain_flag":true,"sets":[{"exercise_id":1,"weight_kg":60,"reps":5}]}`

	w := send(r, http.MethodPost, "/v1/sessions", pain, bearer)
	if w.Code != http.StatusForbidden || decodeError(t, w).Code != CodeConsentRequired {
		t.Fatalf("without consent: %d %s", w.Code, w.Body)
	}

	w = send(r, http.MethodPost, "/v1/me/consents", `{"kind":"health_data","version":"2026-10"}`, bearer)
	if w.Code != http.StatusCreated {
		t.Fatalf("grant: %d %s", w.Code, w.Body)
	}
	if w = send(r, http.MethodPost, "/v1/sessions", pain, bearer); w.Code != http.StatusCreated {
		t.Fatalf("with consent: %d %s", w.Code, w.Body)
	}
	if w = send(r, http.MethodGet, "/v1/me/consents", "", bearer); !strings.Contains(w.Body.String(), `"kind":"health_data"`) {
		t.Errorf("list consents: %s", w.Body)
	}
}

func TestConsentValidationAndWithdraw(t *testing.T) {
	f := newFakeWorkouts()
	r := newWorkoutRouter(f)
	for _, body := range []string{
		`{"kind":"marketing","version":"1"}`,
		`{"kind":"terms","version":""}`,
		`{"kind":"terms","version":"` + strings.Repeat("x", 33) + `"}`,
	} {
		if w := send(r, http.MethodPost, "/v1/me/consents", body, bearer); w.Code != http.StatusUnprocessableEntity {
			t.Errorf("%s: %d", body, w.Code)
		}
	}
	if w := send(r, http.MethodDelete, "/v1/me/consents/marketing", "", bearer); w.Code != http.StatusNotFound {
		t.Errorf("unknown kind: %d", w.Code)
	}
	if w := send(r, http.MethodDelete, "/v1/me/consents/health_data", "", bearer); w.Code != http.StatusNoContent || f.withdrew != "health_data" {
		t.Errorf("withdraw: %d %q", w.Code, f.withdrew)
	}
}
