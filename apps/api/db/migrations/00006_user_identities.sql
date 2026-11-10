-- +goose Up
-- A user can sign in with more than one provider (Google, LINE). Each
-- provider account is keyed by (provider, subject), the provider's own stable
-- user id ("sub" in the ID token). Existing users keep working: their Google
-- sub moves here unchanged.
CREATE TABLE user_identities (
    provider   text NOT NULL CHECK (provider IN ('google', 'line')),
    subject    text NOT NULL,
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    -- Email this provider gave at the last sign-in; '' when it gave none
    -- (LINE only shares email after the channel is approved for it).
    email      text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, subject)
);

CREATE INDEX user_identities_user_id_idx ON user_identities (user_id);

INSERT INTO user_identities (provider, subject, user_id, email, created_at)
SELECT 'google', google_sub, id, email, created_at FROM users;

ALTER TABLE users DROP COLUMN google_sub;

-- +goose Down
-- Users without a Google identity (LINE only) cannot exist in the old schema
-- and are deleted, with all their data by cascade.
ALTER TABLE users ADD COLUMN google_sub text;
UPDATE users u SET google_sub = i.subject
FROM user_identities i
WHERE i.user_id = u.id AND i.provider = 'google';
DELETE FROM users WHERE google_sub IS NULL;
ALTER TABLE users ALTER COLUMN google_sub SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_google_sub_key UNIQUE (google_sub);
DROP TABLE user_identities;
