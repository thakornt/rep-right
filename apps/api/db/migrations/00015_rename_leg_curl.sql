-- +goose Up
-- The single-leg curl becomes plainly the leg curl, as the owner asked (2026-11-16): it will be done
-- with both legs together. The row stays, so its id and the sets logged on it keep.
UPDATE exercises
SET slug = 'leg-curl', name_th = 'เลกเคิร์ล', name_en = 'Leg Curl'
WHERE slug = 'single-leg-curl';

-- +goose Down
UPDATE exercises
SET slug = 'single-leg-curl', name_th = 'เลกเคิร์ล ขาเดียว', name_en = 'Single-Leg Curl'
WHERE slug = 'leg-curl';
