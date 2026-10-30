-- +goose Up
-- Primary muscles each exercise trains, for filtering in the exercise picker.
ALTER TABLE exercises ADD COLUMN muscles text[] NOT NULL DEFAULT '{}'
    CHECK (muscles <@ ARRAY['chest', 'back', 'traps', 'shoulders', 'biceps', 'triceps',
                            'abs', 'lower_back', 'glutes', 'quads', 'hamstrings', 'calves']::text[]);

UPDATE exercises e SET muscles = m.muscles
FROM (VALUES
    ('back-squat',                          ARRAY['quads', 'glutes']),
    ('front-squat',                         ARRAY['quads', 'glutes']),
    ('dumbbell-squat',                      ARRAY['quads', 'glutes']),
    ('deadlift',                            ARRAY['hamstrings', 'glutes', 'lower_back']),
    ('romanian-deadlift',                   ARRAY['hamstrings', 'glutes']),
    ('hip-thrust',                          ARRAY['glutes']),
    ('leg-extension',                       ARRAY['quads']),
    ('single-leg-curl',                     ARRAY['hamstrings']),
    ('calf-raise',                          ARRAY['calves']),
    ('bench-press',                         ARRAY['chest', 'triceps']),
    ('machine-chest-press',                 ARRAY['chest', 'triceps']),
    ('incline-dumbbell-press',              ARRAY['chest', 'shoulders']),
    ('push-up',                             ARRAY['chest', 'triceps']),
    ('overhead-press',                      ARRAY['shoulders', 'triceps']),
    ('seated-dumbbell-shoulder-press',      ARRAY['shoulders', 'triceps']),
    ('barbell-row',                         ARRAY['back']),
    ('chest-supported-row',                 ARRAY['back']),
    ('single-arm-dumbbell-row',             ARRAY['back']),
    ('pull-up',                             ARRAY['back', 'biceps']),
    ('lat-pulldown',                        ARRAY['back', 'biceps']),
    ('neutral-grip-lat-pulldown',           ARRAY['back', 'biceps']),
    ('single-arm-lat-pulldown',             ARRAY['back']),
    ('shrug',                               ARRAY['traps']),
    ('face-pull',                           ARRAY['shoulders', 'traps']),
    ('single-arm-cable-rear-delt-fly',      ARRAY['shoulders']),
    ('dumbbell-lateral-raise',              ARRAY['shoulders']),
    ('cable-lateral-raise',                 ARRAY['shoulders']),
    ('incline-dumbbell-lateral-raise',      ARRAY['shoulders']),
    ('upright-row',                         ARRAY['shoulders', 'traps']),
    ('dumbbell-curl',                       ARRAY['biceps']),
    ('hammer-curl',                         ARRAY['biceps']),
    ('incline-dumbbell-curl',               ARRAY['biceps']),
    ('cable-curl',                          ARRAY['biceps']),
    ('rope-triceps-pushdown',               ARRAY['triceps']),
    ('overhead-cable-triceps-extension',    ARRAY['triceps']),
    ('overhead-dumbbell-triceps-extension', ARRAY['triceps']),
    ('cable-crunch',                        ARRAY['abs']),
    ('leg-raise',                           ARRAY['abs'])
) AS m (slug, muscles)
WHERE e.slug = m.slug;

-- +goose Down
ALTER TABLE exercises DROP COLUMN muscles;
