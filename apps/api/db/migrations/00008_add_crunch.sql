-- +goose Up
-- The plain floor crunch, which also has a 3D form page.
INSERT INTO exercises (slug, name_th, name_en, category, is_lower_body, muscles) VALUES
    ('crunch', 'ครันช์', 'Crunch', 'core', false, ARRAY['abs']);

-- +goose Down
-- Fails if this exercise has been logged (sets reference it).
DELETE FROM exercises WHERE slug = 'crunch';
