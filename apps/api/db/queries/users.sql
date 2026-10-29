-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- name: UpsertUserByGoogleSub :one
INSERT INTO users (google_sub, email, display_name)
VALUES ($1, $2, $3)
ON CONFLICT (google_sub) DO UPDATE
SET email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    updated_at = now()
RETURNING *;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;
