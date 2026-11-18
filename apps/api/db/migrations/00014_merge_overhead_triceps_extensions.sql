-- +goose Up
-- The overhead dumbbell and cable triceps extensions become one exercise, the overhead triceps
-- extension, with dumbbell or cable an option inside it, as the owner asked (2026-11-14). The
-- dumbbell one's row stays, renamed, so its id and its sets keep; sets logged on the cable one move
-- onto it, and which they used is not kept. Then the cable one's row goes.
UPDATE exercises
SET slug = 'overhead-triceps-extension', name_th = 'ไตรเซปส์เอ็กซ์เทนชันเหนือหัว',
    name_en = 'Overhead Triceps Extension', equipment = ARRAY['dumbbell', 'cable']
WHERE slug = 'overhead-dumbbell-triceps-extension';
UPDATE sets
SET exercise_id = (SELECT id FROM exercises WHERE slug = 'overhead-triceps-extension')
WHERE exercise_id IN (SELECT id FROM exercises WHERE slug = 'overhead-cable-triceps-extension');
DELETE FROM exercises WHERE slug = 'overhead-cable-triceps-extension';

-- +goose Down
-- The names come back and the cable one's row comes back, empty: the moved sets stay on the
-- dumbbell one.
UPDATE exercises
SET slug = 'overhead-dumbbell-triceps-extension', name_th = 'ไตรเซปส์เอ็กซ์เทนชันเหนือหัว (ดัมเบล)',
    name_en = 'Overhead Dumbbell Triceps Extension', equipment = ARRAY['dumbbell']
WHERE slug = 'overhead-triceps-extension';
INSERT INTO exercises (slug, name_th, name_en, category, is_lower_body, muscles, equipment) VALUES
    ('overhead-cable-triceps-extension', 'ไตรเซปส์เอ็กซ์เทนชันเหนือหัว (เคเบิล)', 'Overhead Cable Triceps Extension',
     'arms', false, ARRAY['triceps'], ARRAY['cable'])
ON CONFLICT (slug) DO NOTHING;
