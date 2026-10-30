package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/thakornt/rep-right/apps/api/internal/domain/workout"
	"github.com/thakornt/rep-right/apps/api/internal/store/dbgen"
)

// WorkoutStore persists exercises, sessions with their sets, and consents.
// Every method that takes a userID only ever reads or writes that user's rows.
type WorkoutStore struct {
	pool *pgxpool.Pool
	q    *dbgen.Queries
}

func NewWorkoutStore(pool *pgxpool.Pool) *WorkoutStore {
	return &WorkoutStore{pool: pool, q: dbgen.New(pool)}
}

func (s *WorkoutStore) ListExercises(ctx context.Context) ([]workout.Exercise, error) {
	rows, err := s.q.ListExercises(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]workout.Exercise, len(rows))
	for i, e := range rows {
		out[i] = toExercise(e)
	}
	return out, nil
}

func (s *WorkoutStore) ExerciseBySlug(ctx context.Context, slug string) (workout.Exercise, error) {
	e, err := s.q.GetExerciseBySlug(ctx, slug)
	if errors.Is(err, pgx.ErrNoRows) {
		return workout.Exercise{}, workout.ErrNotFound
	}
	return toExercise(e), err
}

func (s *WorkoutStore) CreateSession(ctx context.Context, userID uuid.UUID, in workout.Session) (workout.Logged, error) {
	var out workout.Logged
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if err := requireHealthConsent(ctx, q, userID, in.PainFlag); err != nil {
			return err
		}
		row, err := q.CreateSession(ctx, dbgen.CreateSessionParams{
			UserID: userID, PerformedAt: in.PerformedAt, Notes: in.Notes, PainFlag: in.PainFlag,
		})
		if err != nil {
			return err
		}
		if err := insertSets(ctx, q, row.ID, in.Sets); err != nil {
			return err
		}
		out = toLogged(row, in.Sets)
		return nil
	})
	return out, err
}

// UpdateSession replaces the session's fields and all of its sets.
func (s *WorkoutStore) UpdateSession(ctx context.Context, userID, id uuid.UUID, in workout.Session) (workout.Logged, error) {
	var out workout.Logged
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if err := requireHealthConsent(ctx, q, userID, in.PainFlag); err != nil {
			return err
		}
		row, err := q.UpdateSession(ctx, dbgen.UpdateSessionParams{
			ID: id, UserID: userID, PerformedAt: in.PerformedAt, Notes: in.Notes, PainFlag: in.PainFlag,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return workout.ErrNotFound
		}
		if err != nil {
			return err
		}
		if err := q.DeleteSetsForSession(ctx, id); err != nil {
			return err
		}
		if err := insertSets(ctx, q, id, in.Sets); err != nil {
			return err
		}
		out = toLogged(row, in.Sets)
		return nil
	})
	return out, err
}

func (s *WorkoutStore) GetSession(ctx context.Context, userID, id uuid.UUID) (workout.Logged, error) {
	row, err := s.q.GetSession(ctx, dbgen.GetSessionParams{ID: id, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return workout.Logged{}, workout.ErrNotFound
	}
	if err != nil {
		return workout.Logged{}, err
	}
	out, err := s.withSets(ctx, []dbgen.Session{row})
	if err != nil {
		return workout.Logged{}, err
	}
	return out[0], nil
}

func (s *WorkoutStore) DeleteSession(ctx context.Context, userID, id uuid.UUID) error {
	n, err := s.q.DeleteSession(ctx, dbgen.DeleteSessionParams{ID: id, UserID: userID})
	if err == nil && n == 0 {
		return workout.ErrNotFound
	}
	return err
}

// ListSessions returns sessions in [from, to] (inclusive dates), newest first.
func (s *WorkoutStore) ListSessions(ctx context.Context, userID uuid.UUID, from, to time.Time, limit int32) ([]workout.Logged, error) {
	rows, err := s.q.ListSessions(ctx, dbgen.ListSessionsParams{UserID: userID, FromDate: from, ToDate: to, MaxRows: limit})
	if err != nil {
		return nil, err
	}
	return s.withSets(ctx, rows)
}

// LastWithExercise returns the most recent session containing the exercise,
// keeping only that exercise's sets (for the "same as last time" button).
func (s *WorkoutStore) LastWithExercise(ctx context.Context, userID uuid.UUID, exerciseID int32) (workout.Logged, error) {
	row, err := s.q.LastSessionWithExercise(ctx, dbgen.LastSessionWithExerciseParams{UserID: userID, ExerciseID: exerciseID})
	if errors.Is(err, pgx.ErrNoRows) {
		return workout.Logged{}, workout.ErrNotFound
	}
	if err != nil {
		return workout.Logged{}, err
	}
	out, err := s.withSets(ctx, []dbgen.Session{row})
	if err != nil {
		return workout.Logged{}, err
	}
	l := out[0]
	kept := l.Sets[:0]
	for _, set := range l.Sets {
		if set.ExerciseID == exerciseID {
			kept = append(kept, set)
		}
	}
	l.Sets = kept
	return l, nil
}

// LatestTopSets returns, per exercise, the last session date and its top set.
func (s *WorkoutStore) LatestTopSets(ctx context.Context, userID uuid.UUID) ([]workout.TopSet, error) {
	rows, err := s.q.LatestTopSets(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]workout.TopSet, len(rows))
	for i, r := range rows {
		out[i] = workout.TopSet{ExerciseID: r.ExerciseID, PerformedAt: r.PerformedAt, WeightKg: r.TopWeightKg}
	}
	return out, nil
}

func (s *WorkoutStore) ListConsents(ctx context.Context, userID uuid.UUID) ([]workout.Consent, error) {
	rows, err := s.q.ListConsents(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]workout.Consent, len(rows))
	for i, c := range rows {
		out[i] = workout.Consent{Kind: c.Kind, Version: c.Version, AcceptedAt: c.AcceptedAt}
	}
	return out, nil
}

func (s *WorkoutStore) GrantConsent(ctx context.Context, userID uuid.UUID, kind, version string) (workout.Consent, error) {
	c, err := s.q.GrantConsent(ctx, dbgen.GrantConsentParams{UserID: userID, Kind: kind, Version: version})
	return workout.Consent{Kind: c.Kind, Version: c.Version, AcceptedAt: c.AcceptedAt}, err
}

// WithdrawConsent removes every version of the consent. Withdrawing
// 'health_data' also clears pain_flag on all of the user's sessions.
func (s *WorkoutStore) WithdrawConsent(ctx context.Context, userID uuid.UUID, kind string) error {
	return pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		if err := q.WithdrawConsent(ctx, dbgen.WithdrawConsentParams{UserID: userID, Kind: kind}); err != nil {
			return err
		}
		if kind == workout.ConsentHealthData {
			return q.ClearPainFlags(ctx, userID)
		}
		return nil
	})
}

func requireHealthConsent(ctx context.Context, q *dbgen.Queries, userID uuid.UUID, painFlag bool) error {
	if !painFlag {
		return nil
	}
	ok, err := q.HasConsent(ctx, dbgen.HasConsentParams{UserID: userID, Kind: workout.ConsentHealthData})
	if err != nil {
		return err
	}
	if !ok {
		return workout.ErrConsentRequired
	}
	return nil
}

func insertSets(ctx context.Context, q *dbgen.Queries, sessionID uuid.UUID, sets []workout.Set) error {
	rows := make([]dbgen.InsertSetsParams, len(sets))
	for i, set := range sets {
		rows[i] = dbgen.InsertSetsParams{
			SessionID: sessionID, ExerciseID: set.ExerciseID, SetIndex: int16(i + 1), //nolint:gosec // len(sets) <= workout.MaxSets
			WeightKg: set.WeightKg, Reps: int16(set.Reps), Rpe: set.RPE, //nolint:gosec // reps <= workout.MaxReps
		}
	}
	_, err := q.InsertSets(ctx, rows)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23503" { // foreign_key_violation
		return workout.ErrUnknownExercise
	}
	if err != nil {
		return fmt.Errorf("insert sets: %w", err)
	}
	return nil
}

func (s *WorkoutStore) withSets(ctx context.Context, rows []dbgen.Session) ([]workout.Logged, error) {
	if len(rows) == 0 {
		return []workout.Logged{}, nil
	}
	ids := make([]uuid.UUID, len(rows))
	for i, r := range rows {
		ids[i] = r.ID
	}
	sets, err := s.q.ListSetsForSessions(ctx, ids)
	if err != nil {
		return nil, err
	}
	bySession := map[uuid.UUID][]workout.Set{}
	for _, st := range sets {
		bySession[st.SessionID] = append(bySession[st.SessionID], workout.Set{
			ExerciseID: st.ExerciseID, WeightKg: st.WeightKg, Reps: int(st.Reps), RPE: st.Rpe,
		})
	}
	out := make([]workout.Logged, len(rows))
	for i, r := range rows {
		out[i] = toLogged(r, bySession[r.ID])
	}
	return out, nil
}

func toLogged(r dbgen.Session, sets []workout.Set) workout.Logged {
	if sets == nil {
		sets = []workout.Set{}
	}
	return workout.Logged{
		ID: r.ID, PerformedAt: r.PerformedAt, Notes: r.Notes, PainFlag: r.PainFlag,
		Sets: sets, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
}

func toExercise(e dbgen.Exercise) workout.Exercise {
	return workout.Exercise{ID: e.ID, Slug: e.Slug, NameTH: e.NameTh, NameEN: e.NameEn, Category: e.Category, IsLowerBody: e.IsLowerBody}
}
