-- +goose Up
-- What each exercise is loaded with, for the equipment filter in the exercise picker
-- (someone with only dumbbells at home can list just those). An exercise done with more than
-- one tool lists each. A bench or rack is not listed: it is where the lift happens, not what
-- loads it.
ALTER TABLE exercises ADD COLUMN equipment text[] NOT NULL DEFAULT '{}'
    CHECK (equipment <@ ARRAY['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'band']::text[]);

UPDATE exercises e SET equipment = m.equipment
FROM (VALUES
    ('back-squat',                          ARRAY['barbell']),
    ('front-squat',                         ARRAY['barbell']),
    ('dumbbell-squat',                      ARRAY['dumbbell']),
    ('deadlift',                            ARRAY['barbell']),
    ('romanian-deadlift',                   ARRAY['barbell']),
    ('hip-thrust',                          ARRAY['barbell']),
    ('leg-extension',                       ARRAY['machine']),
    ('single-leg-curl',                     ARRAY['machine']),
    ('calf-raise',                          ARRAY['bodyweight', 'machine']),
    ('bench-press',                         ARRAY['barbell']),
    ('machine-chest-press',                 ARRAY['machine']),
    ('incline-dumbbell-press',              ARRAY['dumbbell']),
    ('push-up',                             ARRAY['bodyweight']),
    ('overhead-press',                      ARRAY['barbell']),
    ('seated-dumbbell-shoulder-press',      ARRAY['dumbbell']),
    ('barbell-row',                         ARRAY['barbell']),
    ('chest-supported-row',                 ARRAY['machine', 'dumbbell']),
    ('single-arm-dumbbell-row',             ARRAY['dumbbell']),
    ('pull-up',                             ARRAY['bodyweight']),
    ('lat-pulldown',                        ARRAY['machine']),
    ('shrug',                               ARRAY['barbell', 'dumbbell']),
    ('face-pull',                           ARRAY['cable']),
    ('single-arm-cable-rear-delt-fly',      ARRAY['cable']),
    ('dumbbell-lateral-raise',              ARRAY['dumbbell']),
    ('cable-lateral-raise',                 ARRAY['cable']),
    ('incline-dumbbell-lateral-raise',      ARRAY['dumbbell']),
    ('upright-row',                         ARRAY['barbell', 'dumbbell']),
    ('dumbbell-curl',                       ARRAY['dumbbell']),
    ('hammer-curl',                         ARRAY['dumbbell']),
    ('incline-dumbbell-curl',               ARRAY['dumbbell']),
    ('cable-curl',                          ARRAY['cable']),
    ('rope-triceps-pushdown',               ARRAY['cable']),
    ('overhead-cable-triceps-extension',    ARRAY['cable']),
    ('overhead-dumbbell-triceps-extension', ARRAY['dumbbell']),
    ('cable-crunch',                        ARRAY['cable']),
    ('leg-raise',                           ARRAY['bodyweight']),
    ('crunch',                              ARRAY['bodyweight'])
) AS m (slug, equipment)
WHERE e.slug = m.slug;

-- +goose Down
ALTER TABLE exercises DROP COLUMN equipment;
