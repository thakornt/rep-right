package workout

import (
	"errors"
	"strings"
	"testing"
	"time"
)

var today = time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)

func ptr(f float64) *float64 { return &f }

func valid() Session {
	return Session{
		PerformedAt: today,
		Notes:       "ok",
		Sets: []Set{
			{ExerciseID: 1, WeightKg: 100, Reps: 5, RPE: ptr(8)},
			{ExerciseID: 1, WeightKg: 102.5, Reps: 5},
			{ExerciseID: 8, WeightKg: 0, Reps: 8, RPE: ptr(9.5)},
		},
	}
}

func TestValidateAcceptsTypicalSession(t *testing.T) {
	if err := Validate(valid(), today); err != nil {
		t.Fatal(err)
	}
	s := valid()
	s.PerformedAt = today.AddDate(0, 0, 1) // user ahead of UTC
	if err := Validate(s, today); err != nil {
		t.Errorf("tomorrow (time zones) should be allowed: %v", err)
	}
}

func TestValidateRejects(t *testing.T) {
	cases := []struct {
		name  string
		field string
		edit  func(*Session)
	}{
		{"no date", "performed_at", func(s *Session) { s.PerformedAt = time.Time{} }},
		{"future", "performed_at", func(s *Session) { s.PerformedAt = today.AddDate(0, 0, 2) }},
		{"ancient", "performed_at", func(s *Session) { s.PerformedAt = today.AddDate(-11, 0, 0) }},
		{"long notes", "notes", func(s *Session) { s.Notes = strings.Repeat("ก", MaxNotesRunes+1) }},
		{"no sets", "sets", func(s *Session) { s.Sets = nil }},
		{"too many sets", "sets", func(s *Session) { s.Sets = make([]Set, MaxSets+1) }},
		{"no exercise", "sets[1].exercise_id", func(s *Session) { s.Sets[1].ExerciseID = 0 }},
		{"negative weight", "sets[0].weight_kg", func(s *Session) { s.Sets[0].WeightKg = -1 }},
		{"absurd weight", "sets[0].weight_kg", func(s *Session) { s.Sets[0].WeightKg = MaxWeightKg + 1 }},
		{"3 decimals", "sets[0].weight_kg", func(s *Session) { s.Sets[0].WeightKg = 100.125 }},
		{"zero reps", "sets[2].reps", func(s *Session) { s.Sets[2].Reps = 0 }},
		{"too many reps", "sets[2].reps", func(s *Session) { s.Sets[2].Reps = MaxReps + 1 }},
		{"rpe low", "sets[0].rpe", func(s *Session) { s.Sets[0].RPE = ptr(0.5) }},
		{"rpe high", "sets[0].rpe", func(s *Session) { s.Sets[0].RPE = ptr(10.5) }},
		{"rpe step", "sets[0].rpe", func(s *Session) { s.Sets[0].RPE = ptr(8.3) }},
	}
	for _, tc := range cases {
		s := valid()
		tc.edit(&s)
		err := Validate(s, today)
		var ve *ValidationError
		if !errors.As(err, &ve) {
			t.Errorf("%s: err = %v, want *ValidationError", tc.name, err)
			continue
		}
		if ve.Field != tc.field {
			t.Errorf("%s: field = %q, want %q", tc.name, ve.Field, tc.field)
		}
	}
}

func TestValidateAcceptsBoundaries(t *testing.T) {
	s := valid()
	s.Notes = strings.Repeat("ก", MaxNotesRunes) // runes, not bytes
	s.Sets[0] = Set{ExerciseID: 1, WeightKg: MaxWeightKg, Reps: MaxReps, RPE: ptr(10)}
	s.Sets[1] = Set{ExerciseID: 1, WeightKg: 0.25, Reps: 1, RPE: ptr(1)}
	s.Sets[2] = Set{ExerciseID: 1, WeightKg: 61.23, Reps: 1}
	if err := Validate(s, today); err != nil {
		t.Fatal(err)
	}
}
