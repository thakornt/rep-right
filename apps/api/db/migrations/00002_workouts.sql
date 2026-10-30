-- +goose Up
-- Reference data; rows are seeded here and never written by the API.
CREATE TABLE exercises (
    id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug          text NOT NULL UNIQUE,
    name_th       text NOT NULL,
    name_en       text NOT NULL,
    category      text NOT NULL CHECK (category IN ('squat', 'hinge', 'push', 'pull')),
    -- Drives the load-jump threshold: 10% for lower body, 5% for upper body.
    is_lower_body boolean NOT NULL
);

INSERT INTO exercises (slug, name_th, name_en, category, is_lower_body) VALUES
    ('back-squat',        'สควอทบาร์หลัง',          'Back Squat',        'squat', true),
    ('front-squat',       'สควอทบาร์หน้า',          'Front Squat',       'squat', true),
    ('deadlift',          'เดดลิฟต์',               'Deadlift',          'hinge', true),
    ('romanian-deadlift', 'โรมาเนียนเดดลิฟต์',      'Romanian Deadlift', 'hinge', true),
    ('hip-thrust',        'ฮิปทรัสต์',              'Hip Thrust',        'hinge', true),
    ('bench-press',       'เบนช์เพรส',              'Bench Press',       'push',  false),
    ('overhead-press',    'โอเวอร์เฮดเพรส',         'Overhead Press',    'push',  false),
    ('barbell-row',       'บาร์เบลโรว์',            'Barbell Row',       'pull',  false),
    ('pull-up',           'พูลอัพ',                 'Pull-up',           'pull',  false);

CREATE TABLE sessions (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    performed_at date NOT NULL,
    notes        text NOT NULL DEFAULT '',
    -- Only stored with a 'health_data' consent; cleared when it is withdrawn.
    pain_flag    boolean NOT NULL DEFAULT false,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_user_performed_idx ON sessions (user_id, performed_at DESC);

CREATE TABLE sets (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  uuid NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    exercise_id integer NOT NULL REFERENCES exercises (id),
    set_index   smallint NOT NULL CHECK (set_index >= 1),
    -- Added load for bodyweight moves (pull-up) is also stored here; 0 = bodyweight.
    weight_kg   numeric(6, 2) NOT NULL CHECK (weight_kg >= 0),
    reps        smallint NOT NULL CHECK (reps >= 1),
    rpe         numeric(3, 1) CHECK (rpe BETWEEN 1 AND 10),
    UNIQUE (session_id, set_index)
);

CREATE INDEX sets_exercise_idx ON sets (exercise_id);

-- +goose Down
DROP TABLE sets;
DROP TABLE sessions;
DROP TABLE exercises;
