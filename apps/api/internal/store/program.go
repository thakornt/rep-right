package store

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/thakornt/rep-right/apps/api/internal/store/dbgen"
)

// ProgramStore keeps the weekly program a user picked (users.program_id).
type ProgramStore struct{ q *dbgen.Queries }

func NewProgramStore(pool *pgxpool.Pool) *ProgramStore { return &ProgramStore{q: dbgen.New(pool)} }

// Program returns the user's program id, or "" when none is chosen.
func (s *ProgramStore) Program(ctx context.Context, userID uuid.UUID) (string, error) {
	id, err := s.q.GetUserProgram(ctx, userID)
	if err != nil {
		return "", err
	}
	return id.String, nil
}

// SetProgram stores id as the user's program; "" clears it.
func (s *ProgramStore) SetProgram(ctx context.Context, userID uuid.UUID, id string) error {
	_, err := s.q.SetUserProgram(ctx, dbgen.SetUserProgramParams{
		ID:        userID,
		ProgramID: pgtype.Text{String: id, Valid: id != ""},
	})
	return err
}
