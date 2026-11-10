-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;

-- Serialises sign-ins of one provider account so two at once cannot create
-- two users.
-- name: LockIdentity :exec
SELECT pg_advisory_xact_lock(hashtextextended(sqlc.arg(provider)::text || ':' || sqlc.arg(subject)::text, 0));

-- name: GetUserByIdentity :one
SELECT u.* FROM users u
JOIN user_identities i ON i.user_id = u.id
WHERE i.provider = $1 AND i.subject = $2;

-- name: CreateUser :one
INSERT INTO users (email, display_name)
VALUES ($1, $2)
RETURNING *;

-- name: InsertIdentity :exec
INSERT INTO user_identities (provider, subject, user_id, email)
VALUES ($1, $2, $3, $4);

-- name: UpdateIdentityEmail :exec
UPDATE user_identities SET email = $3
WHERE provider = $1 AND subject = $2;

-- Refreshes what the provider says at each sign-in. An empty email (LINE
-- without email permission) keeps the one we have.
-- name: UpdateUserProfile :one
UPDATE users
SET email = CASE WHEN sqlc.arg(email)::text = '' THEN email ELSE sqlc.arg(email)::text END,
    display_name = sqlc.arg(display_name),
    updated_at = now()
WHERE id = sqlc.arg(id)
RETURNING *;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;
