-- +goose Up
-- Profile picture URL as the sign-in provider gives it (Google "picture",
-- LINE profile picture). Only the link is stored, never the image. '' = none.
ALTER TABLE users ADD COLUMN picture_url text NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE users DROP COLUMN picture_url;
