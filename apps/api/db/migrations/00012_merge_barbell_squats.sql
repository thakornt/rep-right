-- +goose Up
-- The back squat and the front squat become one exercise, the barbell squat, with where the bar
-- sits an option inside it, as the owner asked (2026-11-14). The back squat's row stays, renamed,
-- so its id and its sets keep; sets logged on the front squat move onto it, and which bar
-- position they used is not kept. Then the front squat's row goes.
UPDATE exercises
SET slug = 'barbell-squat', name_th = 'บาร์เบลสควอท', name_en = 'Barbell Squat'
WHERE slug = 'back-squat';
UPDATE sets
SET exercise_id = (SELECT id FROM exercises WHERE slug = 'barbell-squat')
WHERE exercise_id IN (SELECT id FROM exercises WHERE slug = 'front-squat');
DELETE FROM exercises WHERE slug = 'front-squat';

-- +goose Down
-- The names come back and the front squat's row comes back, empty: the moved sets stay on the
-- back squat.
UPDATE exercises
SET slug = 'back-squat', name_th = 'สควอทบาร์หลัง', name_en = 'Back Squat'
WHERE slug = 'barbell-squat';
INSERT INTO exercises (slug, name_th, name_en, category, is_lower_body, muscles, equipment) VALUES
    ('front-squat', 'สควอทบาร์หน้า', 'Front Squat', 'legs', true, ARRAY['quads', 'glutes'], ARRAY['barbell'])
ON CONFLICT (slug) DO NOTHING;
