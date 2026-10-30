package workout

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNotFound        = errors.New("not found")
	ErrUnknownExercise = errors.New("unknown exercise")
	// ErrConsentRequired: pain_flag is health data and needs 'health_data' consent.
	ErrConsentRequired = errors.New("health_data consent required")
)

type Exercise struct {
	ID          int32
	Slug        string
	NameTH      string
	NameEN      string
	Category    string
	IsLowerBody bool
}

// Logged is a stored session with its sets in set order.
type Logged struct {
	ID          uuid.UUID
	PerformedAt time.Time
	Notes       string
	PainFlag    bool
	Sets        []Set
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

const (
	ConsentTerms      = "terms"
	ConsentHealthData = "health_data"
)

type Consent struct {
	Kind       string
	Version    string
	AcceptedAt time.Time
}
