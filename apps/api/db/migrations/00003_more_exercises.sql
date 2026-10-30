-- +goose Up
-- Movement categories for compounds, body-part categories for isolation work.
ALTER TABLE exercises DROP CONSTRAINT exercises_category_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_category_check
    CHECK (category IN ('squat', 'hinge', 'push', 'pull', 'shoulders', 'arms', 'legs', 'core'));

-- Dumbbell weights are logged per dumbbell; 0 kg means bodyweight only.
INSERT INTO exercises (slug, name_th, name_en, category, is_lower_body) VALUES
    ('lat-pulldown',                    'แลตพูลดาวน์',                     'Lat Pulldown',                    'pull',      false),
    ('neutral-grip-lat-pulldown',       'แลตพูลดาวน์ มือจับขนาน',          'Neutral-Grip Lat Pulldown',       'pull',      false),
    ('single-arm-lat-pulldown',         'แลตพูลดาวน์ แขนเดียว',            'Single-Arm Lat Pulldown',         'pull',      false),
    ('chest-supported-row',             'เชสต์ซัพพอร์ตโรว์',               'Chest-Supported Row',             'pull',      false),
    ('single-arm-dumbbell-row',         'ดัมเบลโรว์ แขนเดียว',             'Single-Arm Dumbbell Row',         'pull',      false),
    ('shrug',                           'ชรัก',                            'Shrug',                           'pull',      false),
    ('face-pull',                       'เฟซพูล',                          'Face Pull',                       'shoulders', false),
    ('single-arm-cable-rear-delt-fly',  'เคเบิลรีเออร์เดลต์ฟลาย แขนเดียว', 'Single-Arm Cable Rear Delt Fly',  'shoulders', false),
    ('seated-dumbbell-shoulder-press',  'ดัมเบลชอลเดอร์เพรส (นั่ง)',       'Seated Dumbbell Shoulder Press',  'push',      false),
    ('machine-chest-press',             'แมชชีนเชสต์เพรส',                 'Machine Chest Press',             'push',      false),
    ('incline-dumbbell-press',          'อินไคลน์ดัมเบลเพรส',              'Incline Dumbbell Press',          'push',      false),
    ('push-up',                         'วิดพื้น',                         'Push-up',                         'push',      false),
    ('dumbbell-lateral-raise',          'ดัมเบลแลตเทอรัลเรส',              'Dumbbell Lateral Raise',          'shoulders', false),
    ('cable-lateral-raise',             'เคเบิลแลตเทอรัลเรส',              'Cable Lateral Raise',             'shoulders', false),
    ('incline-dumbbell-lateral-raise',  'อินไคลน์แลตเทอรัลเรส',            'Incline Dumbbell Lateral Raise',  'shoulders', false),
    ('upright-row',                     'อัพไรต์โรว์',                     'Upright Row',                     'shoulders', false),
    ('dumbbell-curl',                   'ดัมเบลเคิร์ล',                    'Dumbbell Curl',                   'arms',      false),
    ('hammer-curl',                     'แฮมเมอร์เคิร์ล',                  'Hammer Curl',                     'arms',      false),
    ('incline-dumbbell-curl',           'อินไคลน์ดัมเบลเคิร์ล',            'Incline Dumbbell Curl',           'arms',      false),
    ('cable-curl',                      'เคเบิลเคิร์ล',                    'Cable Curl',                      'arms',      false),
    ('rope-triceps-pushdown',           'ไตรเซปส์พุชดาวน์ (เชือก)',        'Rope Triceps Pushdown',           'arms',      false),
    ('overhead-cable-triceps-extension','ไตรเซปส์เอ็กซ์เทนชันเหนือหัว (เคเบิล)', 'Overhead Cable Triceps Extension', 'arms', false),
    ('overhead-dumbbell-triceps-extension','ไตรเซปส์เอ็กซ์เทนชันเหนือหัว (ดัมเบล)', 'Overhead Dumbbell Triceps Extension', 'arms', false),
    ('dumbbell-squat',                  'ดัมเบลสควอท',                     'Dumbbell Squat',                  'squat',     true),
    ('leg-extension',                   'เลกเอ็กซ์เทนชัน',                 'Leg Extension',                   'legs',      true),
    ('single-leg-curl',                 'เลกเคิร์ล ขาเดียว',               'Single-Leg Curl',                 'legs',      true),
    ('calf-raise',                      'คาล์ฟเรส',                        'Calf Raise',                      'legs',      true),
    ('cable-crunch',                    'เคเบิลครันช์',                    'Cable Crunch',                    'core',      false),
    ('leg-raise',                       'เลกเรส',                          'Leg Raise',                       'core',      false);

-- +goose Down
-- Fails if any of these exercises has been logged (sets reference them).
DELETE FROM exercises WHERE slug IN (
    'lat-pulldown', 'neutral-grip-lat-pulldown', 'single-arm-lat-pulldown', 'chest-supported-row',
    'single-arm-dumbbell-row', 'shrug', 'face-pull', 'single-arm-cable-rear-delt-fly',
    'seated-dumbbell-shoulder-press', 'machine-chest-press', 'incline-dumbbell-press', 'push-up',
    'dumbbell-lateral-raise', 'cable-lateral-raise', 'incline-dumbbell-lateral-raise', 'upright-row',
    'dumbbell-curl', 'hammer-curl', 'incline-dumbbell-curl', 'cable-curl', 'rope-triceps-pushdown',
    'overhead-cable-triceps-extension', 'overhead-dumbbell-triceps-extension', 'dumbbell-squat',
    'leg-extension', 'single-leg-curl', 'calf-raise', 'cable-crunch', 'leg-raise');
ALTER TABLE exercises DROP CONSTRAINT exercises_category_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_category_check
    CHECK (category IN ('squat', 'hinge', 'push', 'pull'));
