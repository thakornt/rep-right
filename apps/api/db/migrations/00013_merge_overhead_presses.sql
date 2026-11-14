-- +goose Up
-- The seated dumbbell shoulder press and the standing overhead press become one exercise, the
-- overhead press, with seated or standing an option inside it, as the owner asked (2026-11-14).
-- The overhead press's row stays and is now done with a barbell or dumbbells; sets logged on the
-- seated press move onto it, and which way they used is not kept. Then the seated press's row goes.
UPDATE exercises SET equipment = ARRAY['barbell', 'dumbbell'] WHERE slug = 'overhead-press';
UPDATE sets
SET exercise_id = (SELECT id FROM exercises WHERE slug = 'overhead-press')
WHERE exercise_id IN (SELECT id FROM exercises WHERE slug = 'seated-dumbbell-shoulder-press');
DELETE FROM exercises WHERE slug = 'seated-dumbbell-shoulder-press';

-- +goose Down
-- The seated press's row comes back, empty: the moved sets stay on the overhead press.
UPDATE exercises SET equipment = ARRAY['barbell'] WHERE slug = 'overhead-press';
INSERT INTO exercises (slug, name_th, name_en, category, is_lower_body, muscles, equipment) VALUES
    ('seated-dumbbell-shoulder-press', 'ดัมเบลชอลเดอร์เพรส (นั่ง)', 'Seated Dumbbell Shoulder Press', 'push', false,
     ARRAY['shoulders', 'triceps'], ARRAY['dumbbell'])
ON CONFLICT (slug) DO NOTHING;
