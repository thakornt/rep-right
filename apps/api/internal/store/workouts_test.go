package store

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/thakornt/rep-right/apps/api/internal/domain/workout"
	"github.com/thakornt/rep-right/apps/api/internal/store/dbgen"
)

func TestWorkoutStore(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL not set")
	}
	ctx := context.Background()
	pool, err := Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if err := Migrate(ctx, pool, "up", slog.New(slog.NewTextHandler(io.Discard, nil))); err != nil {
		t.Fatal(err)
	}

	q := dbgen.New(pool)
	newUser := func() uuid.UUID {
		u, err := q.UpsertUserByGoogleSub(ctx, dbgen.UpsertUserByGoogleSubParams{GoogleSub: uuid.NewString(), Email: "w@example.com"})
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = q.DeleteUser(ctx, u.ID) })
		return u.ID
	}
	alice, bob := newUser(), newUser()
	s := NewWorkoutStore(pool)

	exercises, err := s.ListExercises(ctx)
	if err != nil || len(exercises) < 5 {
		t.Fatalf("seeded exercises: %v, %v", exercises, err)
	}
	for _, e := range exercises {
		if len(e.Muscles) == 0 {
			t.Errorf("%s has no primary muscles", e.Slug)
		}
	}
	if lr, err := s.ExerciseBySlug(ctx, "leg-raise"); err != nil || lr.Category != "core" || lr.IsLowerBody ||
		len(lr.Muscles) != 1 || lr.Muscles[0] != "abs" {
		t.Errorf("leg-raise from migration 00003: %+v, %v", lr, err)
	}
	squat, err := s.ExerciseBySlug(ctx, "back-squat")
	if err != nil || !squat.IsLowerBody {
		t.Fatalf("back-squat: %+v, %v", squat, err)
	}
	bench, _ := s.ExerciseBySlug(ctx, "bench-press")
	if _, err := s.ExerciseBySlug(ctx, "nope"); !errors.Is(err, workout.ErrNotFound) {
		t.Errorf("unknown slug: %v", err)
	}

	day := func(d int) time.Time { return time.Date(2026, 10, d, 0, 0, 0, 0, time.UTC) }
	rpe := 8.5
	in := workout.Session{
		PerformedAt: day(1),
		Notes:       "เบา",
		Sets: []workout.Set{
			{ExerciseID: squat.ID, WeightKg: 100, Reps: 5, RPE: &rpe},
			{ExerciseID: bench.ID, WeightKg: 62.5, Reps: 8},
			{ExerciseID: squat.ID, WeightKg: 102.5, Reps: 5},
		},
	}
	created, err := s.CreateSession(ctx, alice, in)
	if err != nil {
		t.Fatal(err)
	}

	got, err := s.GetSession(ctx, alice, created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !got.PerformedAt.Equal(day(1)) || got.Notes != "เบา" || len(got.Sets) != 3 {
		t.Fatalf("round trip: %+v", got)
	}
	if got.Sets[1].WeightKg != 62.5 || got.Sets[0].RPE == nil || *got.Sets[0].RPE != 8.5 || got.Sets[1].RPE != nil {
		t.Errorf("numeric round trip: %+v", got.Sets)
	}

	// Another user can neither see, change nor delete it.
	if _, err := s.GetSession(ctx, bob, created.ID); !errors.Is(err, workout.ErrNotFound) {
		t.Errorf("bob GetSession: %v", err)
	}
	if _, err := s.UpdateSession(ctx, bob, created.ID, in); !errors.Is(err, workout.ErrNotFound) {
		t.Errorf("bob UpdateSession: %v", err)
	}
	if err := s.DeleteSession(ctx, bob, created.ID); !errors.Is(err, workout.ErrNotFound) {
		t.Errorf("bob DeleteSession: %v", err)
	}
	if list, _ := s.ListSessions(ctx, bob, day(1), day(31), 100); len(list) != 0 {
		t.Errorf("bob sees %d sessions", len(list))
	}

	// Update replaces every set.
	in2 := in
	in2.PerformedAt = day(3)
	in2.Sets = []workout.Set{{ExerciseID: squat.ID, WeightKg: 105, Reps: 3}}
	if _, err := s.UpdateSession(ctx, alice, created.ID, in2); err != nil {
		t.Fatal(err)
	}
	got, _ = s.GetSession(ctx, alice, created.ID)
	if len(got.Sets) != 1 || got.Sets[0].WeightKg != 105 || !got.PerformedAt.Equal(day(3)) {
		t.Errorf("after update: %+v", got)
	}

	// Unknown exercise rolls the whole create back.
	bad := in
	bad.Sets = []workout.Set{{ExerciseID: 999999, WeightKg: 1, Reps: 1}}
	if _, err := s.CreateSession(ctx, alice, bad); !errors.Is(err, workout.ErrUnknownExercise) {
		t.Errorf("unknown exercise: %v", err)
	}

	// A later session with only bench, then "last squat" must skip it.
	if _, err := s.CreateSession(ctx, alice, workout.Session{
		PerformedAt: day(5), Sets: []workout.Set{{ExerciseID: bench.ID, WeightKg: 65, Reps: 8}},
	}); err != nil {
		t.Fatal(err)
	}
	last, err := s.LastWithExercise(ctx, alice, squat.ID)
	if err != nil || last.ID != created.ID || len(last.Sets) != 1 || last.Sets[0].ExerciseID != squat.ID {
		t.Errorf("LastWithExercise squat = %+v, %v", last, err)
	}
	if _, err := s.LastWithExercise(ctx, bob, squat.ID); !errors.Is(err, workout.ErrNotFound) {
		t.Errorf("bob last: %v", err)
	}

	list, err := s.ListSessions(ctx, alice, day(1), day(31), 100)
	if err != nil || len(list) != 2 || !list[0].PerformedAt.Equal(day(5)) {
		t.Errorf("list newest first: %+v, %v", list, err)
	}
	if list, _ := s.ListSessions(ctx, alice, day(4), day(31), 100); len(list) != 1 {
		t.Errorf("date filter: got %d", len(list))
	}

	// Latest top set per exercise: squat from day 3 (105), bench from day 5 (65).
	tops, err := s.LatestTopSets(ctx, alice)
	if err != nil || len(tops) != 2 {
		t.Fatalf("LatestTopSets = %+v, %v", tops, err)
	}
	for _, top := range tops {
		switch top.ExerciseID {
		case squat.ID:
			if top.WeightKg != 105 || !top.PerformedAt.Equal(day(3)) {
				t.Errorf("squat top = %+v", top)
			}
		case bench.ID:
			if top.WeightKg != 65 || !top.PerformedAt.Equal(day(5)) {
				t.Errorf("bench top = %+v", top)
			}
		}
	}
	if tops, _ := s.LatestTopSets(ctx, bob); len(tops) != 0 {
		t.Errorf("bob sees alice's top sets: %+v", tops)
	}

	// pain_flag needs health_data consent; withdrawing it clears the flags.
	pain := in
	pain.PainFlag = true
	if _, err := s.CreateSession(ctx, alice, pain); !errors.Is(err, workout.ErrConsentRequired) {
		t.Fatalf("pain without consent: %v", err)
	}
	if _, err := s.GrantConsent(ctx, alice, workout.ConsentHealthData, "2026-10"); err != nil {
		t.Fatal(err)
	}
	painful, err := s.CreateSession(ctx, alice, pain)
	if err != nil || !painful.PainFlag {
		t.Fatalf("pain with consent: %+v, %v", painful, err)
	}
	if err := s.WithdrawConsent(ctx, alice, workout.ConsentHealthData); err != nil {
		t.Fatal(err)
	}
	if got, _ := s.GetSession(ctx, alice, painful.ID); got.PainFlag {
		t.Error("withdrawing health_data must clear pain_flag")
	}
	if cs, _ := s.ListConsents(ctx, alice); len(cs) != 0 {
		t.Errorf("consents after withdraw: %+v", cs)
	}

	if err := s.DeleteSession(ctx, alice, created.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetSession(ctx, alice, created.ID); !errors.Is(err, workout.ErrNotFound) {
		t.Errorf("after delete: %v", err)
	}
}
