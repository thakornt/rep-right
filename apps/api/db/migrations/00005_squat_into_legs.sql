-- +goose Up
-- Squats join the leg exercises: people looking for leg work open "legs" first.
UPDATE exercises SET category = 'legs' WHERE category = 'squat';
ALTER TABLE exercises DROP CONSTRAINT exercises_category_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_category_check
    CHECK (category IN ('hinge', 'push', 'pull', 'shoulders', 'arms', 'legs', 'core'));

-- +goose Down
ALTER TABLE exercises DROP CONSTRAINT exercises_category_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_category_check
    CHECK (category IN ('squat', 'hinge', 'push', 'pull', 'shoulders', 'arms', 'legs', 'core'));
UPDATE exercises SET category = 'squat' WHERE slug IN ('back-squat', 'front-squat', 'dumbbell-squat');
