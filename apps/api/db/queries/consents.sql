-- name: ListConsents :many
SELECT * FROM consents WHERE user_id = $1 ORDER BY kind, accepted_at;

-- name: GrantConsent :one
INSERT INTO consents (user_id, kind, version)
VALUES ($1, $2, $3)
ON CONFLICT (user_id, kind, version) DO UPDATE SET accepted_at = now()
RETURNING *;

-- name: WithdrawConsent :exec
DELETE FROM consents WHERE user_id = $1 AND kind = $2;

-- name: HasConsent :one
SELECT EXISTS (SELECT 1 FROM consents WHERE user_id = $1 AND kind = $2);

-- Run when 'health_data' consent is withdrawn (PDPA: stop keeping the data).
-- name: ClearPainFlags :exec
UPDATE sessions SET pain_flag = false, updated_at = now()
WHERE user_id = $1 AND pain_flag;
