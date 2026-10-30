-- name: ListExercises :many
SELECT * FROM exercises ORDER BY id;

-- name: GetExerciseBySlug :one
SELECT * FROM exercises WHERE slug = $1;
