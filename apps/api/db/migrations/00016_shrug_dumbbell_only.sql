-- +goose Up
-- The shrug is done with dumbbells only, as the owner asked (2026-11-17), to match its 3D model.
-- The row stays, so the sets logged on it keep.
UPDATE exercises SET equipment = ARRAY['dumbbell'] WHERE slug = 'shrug';

-- +goose Down
UPDATE exercises SET equipment = ARRAY['barbell', 'dumbbell'] WHERE slug = 'shrug';
