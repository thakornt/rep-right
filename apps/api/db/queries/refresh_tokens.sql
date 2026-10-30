-- name: InsertRefreshToken :one
INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
VALUES ($1, $2, $3)
RETURNING id;

-- Row lock serialises concurrent refreshes of the same token.
-- name: LockRefreshTokenByHash :one
SELECT id, user_id, expires_at, revoked_at, replaced_by
FROM refresh_tokens
WHERE token_hash = $1
FOR UPDATE;

-- name: MarkRefreshTokenRotated :exec
UPDATE refresh_tokens
SET revoked_at = sqlc.arg(now)::timestamptz, replaced_by = sqlc.arg(replaced_by)::uuid
WHERE id = sqlc.arg(id);

-- name: RevokeRefreshTokenByHash :exec
UPDATE refresh_tokens
SET revoked_at = sqlc.arg(now)::timestamptz
WHERE token_hash = sqlc.arg(token_hash) AND revoked_at IS NULL;

-- name: RevokeRefreshTokensForUser :exec
UPDATE refresh_tokens
SET revoked_at = sqlc.arg(now)::timestamptz
WHERE user_id = sqlc.arg(user_id) AND revoked_at IS NULL;
