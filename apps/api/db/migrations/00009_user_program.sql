-- +goose Up
-- The weekly program the user picked on /programs (an id from
-- apps/web/src/content/programs.ts, checked against internal/domain/program).
-- One value per user, so a column: it goes with the row on DELETE /v1/me.
-- NULL = none chosen.
ALTER TABLE users ADD COLUMN program_id text;

-- +goose Down
ALTER TABLE users DROP COLUMN program_id;
