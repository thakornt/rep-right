package http

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/thakornt/rep-right/apps/api/internal/domain/workout"
)

// Workouts is the storage the workout handlers need (*store.WorkoutStore).
type Workouts interface {
	ListExercises(ctx context.Context) ([]workout.Exercise, error)
	ExerciseBySlug(ctx context.Context, slug string) (workout.Exercise, error)
	CreateSession(ctx context.Context, userID uuid.UUID, in workout.Session) (workout.Logged, error)
	UpdateSession(ctx context.Context, userID, id uuid.UUID, in workout.Session) (workout.Logged, error)
	GetSession(ctx context.Context, userID, id uuid.UUID) (workout.Logged, error)
	DeleteSession(ctx context.Context, userID, id uuid.UUID) error
	ListSessions(ctx context.Context, userID uuid.UUID, from, to time.Time, limit int32) ([]workout.Logged, error)
	LastWithExercise(ctx context.Context, userID uuid.UUID, exerciseID int32) (workout.Logged, error)
	LatestTopSets(ctx context.Context, userID uuid.UUID) ([]workout.TopSet, error)
	ListConsents(ctx context.Context, userID uuid.UUID) ([]workout.Consent, error)
	GrantConsent(ctx context.Context, userID uuid.UUID, kind, version string) (workout.Consent, error)
	WithdrawConsent(ctx context.Context, userID uuid.UUID, kind string) error
}

const (
	dateLayout      = "2006-01-02"
	maxSessionBody  = 64 << 10
	defaultListDays = 90
	maxListDays     = 366
	maxListRows     = 500
	maxVersionLen   = 32
)

type workoutHandlers struct {
	store Workouts
	log   *slog.Logger
	now   func() time.Time
}

type exerciseJSON struct {
	ID          int32  `json:"id"`
	Slug        string `json:"slug"`
	NameTH      string `json:"name_th"`
	NameEN      string `json:"name_en"`
	Category    string `json:"category"`
	IsLowerBody bool   `json:"is_lower_body"`
}

type setJSON struct {
	ExerciseID int32    `json:"exercise_id"`
	WeightKg   float64  `json:"weight_kg"`
	Reps       int      `json:"reps"`
	RPE        *float64 `json:"rpe"`
}

type sessionInJSON struct {
	PerformedAt string    `json:"performed_at"`
	Notes       string    `json:"notes"`
	PainFlag    bool      `json:"pain_flag"`
	Sets        []setJSON `json:"sets"`
}

type sessionJSON struct {
	ID          uuid.UUID `json:"id"`
	PerformedAt string    `json:"performed_at"`
	Notes       string    `json:"notes"`
	PainFlag    bool      `json:"pain_flag"`
	Sets        []setJSON `json:"sets"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type consentJSON struct {
	Kind       string    `json:"kind"`
	Version    string    `json:"version"`
	AcceptedAt time.Time `json:"accepted_at"`
}

func toSessionJSON(l workout.Logged) sessionJSON {
	sets := make([]setJSON, len(l.Sets))
	for i, s := range l.Sets {
		sets[i] = setJSON{ExerciseID: s.ExerciseID, WeightKg: s.WeightKg, Reps: s.Reps, RPE: s.RPE}
	}
	return sessionJSON{
		ID: l.ID, PerformedAt: l.PerformedAt.Format(dateLayout), Notes: l.Notes, PainFlag: l.PainFlag,
		Sets: sets, CreatedAt: l.CreatedAt, UpdatedAt: l.UpdatedAt,
	}
}

func (h workoutHandlers) today() time.Time {
	y, m, d := h.now().UTC().Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

func (h workoutHandlers) listExercises(c *gin.Context) {
	rows, err := h.store.ListExercises(c.Request.Context())
	if err != nil {
		h.internal(c, "list exercises", err)
		return
	}
	out := make([]exerciseJSON, len(rows))
	for i, e := range rows {
		out[i] = exerciseJSON(e)
	}
	c.Header("Cache-Control", "public, max-age=3600")
	c.JSON(http.StatusOK, gin.H{"exercises": out})
}

func (h workoutHandlers) listSessions(c *gin.Context) {
	to, ok := h.dateParam(c, "to", h.today().AddDate(0, 0, 1))
	if !ok {
		return
	}
	from, ok := h.dateParam(c, "from", to.AddDate(0, 0, -defaultListDays))
	if !ok {
		return
	}
	if from.After(to) || to.Sub(from) > maxListDays*24*time.Hour {
		writeError(c, http.StatusUnprocessableEntity, CodeValidationFailed, "from must be before to and at most 366 days apart")
		return
	}
	rows, err := h.store.ListSessions(c.Request.Context(), userID(c), from, to, maxListRows)
	if err != nil {
		h.internal(c, "list sessions", err)
		return
	}
	out := make([]sessionJSON, len(rows))
	for i, l := range rows {
		out[i] = toSessionJSON(l)
	}
	c.JSON(http.StatusOK, gin.H{"sessions": out})
}

func (h workoutHandlers) createSession(c *gin.Context) {
	in, ok := h.bindSession(c)
	if !ok {
		return
	}
	l, err := h.store.CreateSession(c.Request.Context(), userID(c), in)
	if h.writeStoreError(c, "create session", err) {
		return
	}
	c.JSON(http.StatusCreated, toSessionJSON(l))
}

func (h workoutHandlers) getSession(c *gin.Context) {
	id, ok := sessionID(c)
	if !ok {
		return
	}
	l, err := h.store.GetSession(c.Request.Context(), userID(c), id)
	if h.writeStoreError(c, "get session", err) {
		return
	}
	c.JSON(http.StatusOK, toSessionJSON(l))
}

func (h workoutHandlers) updateSession(c *gin.Context) {
	id, ok := sessionID(c)
	if !ok {
		return
	}
	in, ok := h.bindSession(c)
	if !ok {
		return
	}
	l, err := h.store.UpdateSession(c.Request.Context(), userID(c), id, in)
	if h.writeStoreError(c, "update session", err) {
		return
	}
	c.JSON(http.StatusOK, toSessionJSON(l))
}

func (h workoutHandlers) deleteSession(c *gin.Context) {
	id, ok := sessionID(c)
	if !ok {
		return
	}
	if h.writeStoreError(c, "delete session", h.store.DeleteSession(c.Request.Context(), userID(c), id)) {
		return
	}
	c.Status(http.StatusNoContent)
}

// lastSession backs the "same as last time" button: the latest session with
// this exercise, containing only that exercise's sets.
func (h workoutHandlers) lastSession(c *gin.Context) {
	slug := c.Query("exercise")
	if slug == "" {
		writeError(c, http.StatusUnprocessableEntity, CodeValidationFailed, "exercise is required")
		return
	}
	ex, err := h.store.ExerciseBySlug(c.Request.Context(), slug)
	if errors.Is(err, workout.ErrNotFound) {
		writeError(c, http.StatusUnprocessableEntity, CodeValidationFailed, "unknown exercise")
		return
	}
	if err != nil {
		h.internal(c, "exercise by slug", err)
		return
	}
	l, err := h.store.LastWithExercise(c.Request.Context(), userID(c), ex.ID)
	if h.writeStoreError(c, "last session", err) {
		return
	}
	c.JSON(http.StatusOK, toSessionJSON(l))
}

func (h workoutHandlers) listConsents(c *gin.Context) {
	rows, err := h.store.ListConsents(c.Request.Context(), userID(c))
	if err != nil {
		h.internal(c, "list consents", err)
		return
	}
	out := make([]consentJSON, len(rows))
	for i, r := range rows {
		out[i] = consentJSON(r)
	}
	c.JSON(http.StatusOK, gin.H{"consents": out})
}

func (h workoutHandlers) grantConsent(c *gin.Context) {
	var req struct {
		Kind    string `json:"kind"`
		Version string `json:"version"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, CodeInvalidRequest, "invalid JSON body")
		return
	}
	if !validConsentKind(req.Kind) || req.Version == "" || len(req.Version) > maxVersionLen {
		writeError(c, http.StatusUnprocessableEntity, CodeValidationFailed, "kind must be terms or health_data and version 1-32 characters")
		return
	}
	cs, err := h.store.GrantConsent(c.Request.Context(), userID(c), req.Kind, req.Version)
	if err != nil {
		h.internal(c, "grant consent", err)
		return
	}
	c.JSON(http.StatusCreated, consentJSON(cs))
}

func (h workoutHandlers) withdrawConsent(c *gin.Context) {
	kind := c.Param("kind")
	if !validConsentKind(kind) {
		writeError(c, http.StatusNotFound, CodeNotFound, "unknown consent kind")
		return
	}
	if err := h.store.WithdrawConsent(c.Request.Context(), userID(c), kind); err != nil {
		h.internal(c, "withdraw consent", err)
		return
	}
	c.Status(http.StatusNoContent)
}

func validConsentKind(k string) bool {
	return k == workout.ConsentTerms || k == workout.ConsentHealthData
}

func (h workoutHandlers) bindSession(c *gin.Context) (workout.Session, bool) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxSessionBody)
	var req sessionInJSON
	if err := c.ShouldBindJSON(&req); err != nil {
		writeError(c, http.StatusBadRequest, CodeInvalidRequest, "invalid JSON body")
		return workout.Session{}, false
	}
	in := workout.Session{Notes: req.Notes, PainFlag: req.PainFlag, Sets: make([]workout.Set, len(req.Sets))}
	if req.PerformedAt != "" {
		d, err := time.Parse(dateLayout, req.PerformedAt)
		if err != nil {
			writeError(c, http.StatusUnprocessableEntity, CodeValidationFailed, "performed_at: must be YYYY-MM-DD")
			return workout.Session{}, false
		}
		in.PerformedAt = d
	}
	for i, s := range req.Sets {
		in.Sets[i] = workout.Set(s)
	}
	if err := workout.Validate(in, h.today()); err != nil {
		writeError(c, http.StatusUnprocessableEntity, CodeValidationFailed, err.Error())
		return workout.Session{}, false
	}
	return in, true
}

// writeStoreError maps store errors to responses; it returns true if it wrote one.
func (h workoutHandlers) writeStoreError(c *gin.Context, op string, err error) bool {
	switch {
	case err == nil:
		return false
	case errors.Is(err, workout.ErrNotFound):
		writeError(c, http.StatusNotFound, CodeNotFound, "session not found")
	case errors.Is(err, workout.ErrUnknownExercise):
		writeError(c, http.StatusUnprocessableEntity, CodeValidationFailed, "sets: unknown exercise_id")
	case errors.Is(err, workout.ErrConsentRequired):
		writeError(c, http.StatusForbidden, CodeConsentRequired, "pain_flag needs health_data consent")
	default:
		h.internal(c, op, err)
	}
	return true
}

func (h workoutHandlers) dateParam(c *gin.Context, name string, fallback time.Time) (time.Time, bool) {
	v := c.Query(name)
	if v == "" {
		return fallback, true
	}
	d, err := time.Parse(dateLayout, v)
	if err != nil {
		writeError(c, http.StatusUnprocessableEntity, CodeValidationFailed, name+": must be YYYY-MM-DD")
		return time.Time{}, false
	}
	return d, true
}

// sessionID parses :id; a malformed ID is reported like a missing session.
func sessionID(c *gin.Context) (uuid.UUID, bool) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		writeError(c, http.StatusNotFound, CodeNotFound, "session not found")
		return uuid.Nil, false
	}
	return id, true
}

func userID(c *gin.Context) uuid.UUID { return c.MustGet(userIDKey).(uuid.UUID) }

func (h workoutHandlers) internal(c *gin.Context, op string, err error) {
	h.log.ErrorContext(c.Request.Context(), op+" failed",
		slog.String("request_id", c.GetString(requestIDHeader)), slog.Any("error", err))
	writeError(c, http.StatusInternalServerError, CodeInternal, "internal server error")
}
