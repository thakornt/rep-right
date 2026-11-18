-- +goose Up
-- The three lat pulldowns become one exercise, the grip an option inside it, as the owner asked
-- (2026-11-12). Sets logged on the neutral-grip and single-arm pulldowns move onto the lat
-- pulldown; which grip they used is not kept. Then the two rows go.
UPDATE sets
SET exercise_id = (SELECT id FROM exercises WHERE slug = 'lat-pulldown')
WHERE exercise_id IN (
    SELECT id FROM exercises WHERE slug IN ('neutral-grip-lat-pulldown', 'single-arm-lat-pulldown')
);
DELETE FROM exercises WHERE slug IN ('neutral-grip-lat-pulldown', 'single-arm-lat-pulldown');

-- +goose Down
-- The rows come back, empty: the moved sets stay on the lat pulldown.
INSERT INTO exercises (slug, name_th, name_en, category, is_lower_body, muscles) VALUES
    ('neutral-grip-lat-pulldown', 'แลตพูลดาวน์ มือจับขนาน', 'Neutral-Grip Lat Pulldown', 'pull', false, ARRAY['back', 'biceps']),
    ('single-arm-lat-pulldown',   'แลตพูลดาวน์ แขนเดียว',   'Single-Arm Lat Pulldown',   'pull', false, ARRAY['back'])
ON CONFLICT (slug) DO NOTHING;
