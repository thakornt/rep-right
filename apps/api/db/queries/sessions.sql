-- Every query is scoped by user_id so one user can never touch another's data.

-- name: CreateSession :one
INSERT INTO sessions (user_id, performed_at, notes, pain_flag)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: UpdateSession :one
UPDATE sessions
SET performed_at = $3, notes = $4, pain_flag = $5, updated_at = now()
WHERE id = $1 AND user_id = $2
RETURNING *;

-- name: GetSession :one
SELECT * FROM sessions WHERE id = $1 AND user_id = $2;

-- name: DeleteSession :execrows
DELETE FROM sessions WHERE id = $1 AND user_id = $2;

-- name: ListSessions :many
SELECT * FROM sessions
WHERE user_id = sqlc.arg(user_id)
  AND performed_at BETWEEN sqlc.arg(from_date)::date AND sqlc.arg(to_date)::date
ORDER BY performed_at DESC, created_at DESC
LIMIT sqlc.arg(max_rows);

-- name: LastSessionWithExercise :one
SELECT s.* FROM sessions s
WHERE s.user_id = $1
  AND EXISTS (SELECT 1 FROM sets WHERE sets.session_id = s.id AND sets.exercise_id = $2)
ORDER BY s.performed_at DESC, s.created_at DESC
LIMIT 1;

-- name: ListSetsForSessions :many
SELECT * FROM sets
WHERE session_id = ANY(sqlc.arg(session_ids)::uuid[])
ORDER BY session_id, set_index;

-- name: InsertSets :copyfrom
INSERT INTO sets (session_id, exercise_id, set_index, weight_kg, reps, rpe)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: DeleteSetsForSession :exec
DELETE FROM sets WHERE session_id = $1;
