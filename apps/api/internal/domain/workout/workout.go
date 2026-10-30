// Package workout holds the rules for what a logged training session may
// contain. It is pure: no database or HTTP.
package workout

import (
	"fmt"
	"math"
	"time"
	"unicode/utf8"
)

const (
	MaxSets       = 60
	MaxReps       = 100
	MaxWeightKg   = 1000
	MaxNotesRunes = 1000
	// MaxAgeYears bounds how far back a session may be back-dated.
	MaxAgeYears = 10
)

type Set struct {
	ExerciseID int32
	WeightKg   float64 // 0 = bodyweight only
	Reps       int
	RPE        *float64 // optional, 1-10 in half steps
}

// Session is a session as submitted by the user. Set order is the set index.
type Session struct {
	PerformedAt time.Time // date only
	Notes       string
	PainFlag    bool
	Sets        []Set
}

type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string { return e.Field + ": " + e.Message }

func invalid(field, format string, args ...any) error {
	return &ValidationError{Field: field, Message: fmt.Sprintf(format, args...)}
}

// Validate checks a session against today's date (UTC). One extra day ahead
// is allowed because users east of UTC are already on tomorrow.
func Validate(s Session, today time.Time) error {
	switch {
	case s.PerformedAt.IsZero():
		return invalid("performed_at", "is required")
	case s.PerformedAt.After(today.AddDate(0, 0, 1)):
		return invalid("performed_at", "cannot be in the future")
	case s.PerformedAt.Before(today.AddDate(-MaxAgeYears, 0, 0)):
		return invalid("performed_at", "is more than %d years ago", MaxAgeYears)
	}
	if utf8.RuneCountInString(s.Notes) > MaxNotesRunes {
		return invalid("notes", "must be at most %d characters", MaxNotesRunes)
	}
	if len(s.Sets) == 0 {
		return invalid("sets", "at least one set is required")
	}
	if len(s.Sets) > MaxSets {
		return invalid("sets", "at most %d sets per session", MaxSets)
	}
	for i, set := range s.Sets {
		f := func(name string) string { return fmt.Sprintf("sets[%d].%s", i, name) }
		switch {
		case set.ExerciseID <= 0:
			return invalid(f("exercise_id"), "is required")
		case set.WeightKg < 0 || set.WeightKg > MaxWeightKg:
			return invalid(f("weight_kg"), "must be between 0 and %d", MaxWeightKg)
		case !isMultiple(set.WeightKg, 0.01):
			return invalid(f("weight_kg"), "at most 2 decimal places")
		case set.Reps < 1 || set.Reps > MaxReps:
			return invalid(f("reps"), "must be between 1 and %d", MaxReps)
		case set.RPE != nil && (*set.RPE < 1 || *set.RPE > 10 || !isMultiple(*set.RPE, 0.5)):
			return invalid(f("rpe"), "must be 1-10 in steps of 0.5")
		}
	}
	return nil
}

func isMultiple(v, step float64) bool {
	q := v / step
	return math.Abs(q-math.Round(q)) < 1e-6
}
