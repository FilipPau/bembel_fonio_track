-- Mock data for local development and tests.
-- Run after 01-init.sql.

INSERT INTO customers (social_security_number, first_name, last_name, birth_date, phone_number)
VALUES
    ('1001010101', 'Bembel', 'Boiii', '2003-01-01', '+436642144008'),
    ('1002020202', 'Omar', 'Haddad', '1984-02-20', '+43660200200'),
    ('1003030303', 'Mia', 'Schneider', '1978-03-30', '+43660300300'),
    ('1004040404', 'Noah', 'Berger', '1995-04-04', '+43660400400'),
    ('1005050505', 'Emma', 'Wagner', '2001-05-15', '+43660500500'),
    ('1006060606', 'Jonas', 'Mayer', '1969-06-06', '+43660600600')
ON CONFLICT (social_security_number) DO NOTHING;

INSERT INTO treatments (id, name, min_duration_minutes)
VALUES
    (1, 'Kleine Plombe', 30),
    (2, 'Zahnersatz', 120),
    (3, 'Zahnreinigung', 45),
    (4, 'Kontrolle', 20),
    (5, 'Wurzelbehandlung', 90)
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff (id, first_name, last_name)
VALUES
    (1, 'Marcus', 'Vance'),
    (2, 'Amira', 'Khattab'),
    (3, 'Sophie', 'Leitner')
ON CONFLICT (id) DO NOTHING;

INSERT INTO rooms (id, name)
VALUES
    (1, 'Raum 1'),
    (2, 'Raum 2'),
    (3, 'Raum 3')
ON CONFLICT (id) DO NOTHING;

INSERT INTO staff_specializations (staff_id, treatment_id)
VALUES
    (1, 1),
    (1, 2),
    (1, 4),
    (2, 1),
    (2, 3),
    (2, 4),
    (3, 3),
    (3, 4),
    (3, 5)
ON CONFLICT (staff_id, treatment_id) DO NOTHING;

INSERT INTO weekly_capacity_limits (weekday, max_minutes)
VALUES
    (1, 180),
    (2, 180),
    (3, 180),
    (4, 180),
    (5, 180),
    (6, 0),
    (7, 0)
ON CONFLICT (weekday) DO UPDATE
SET max_minutes = EXCLUDED.max_minutes;

INSERT INTO staff_shifts (staff_id, room_id, shift_start, shift_end)
VALUES
    (1, 1, '2026-06-08 08:00:00+02', '2026-06-08 14:00:00+02'),
    (2, 2, '2026-06-08 09:00:00+02', '2026-06-08 17:00:00+02'),
    (3, 3, '2026-06-08 10:00:00+02', '2026-06-08 18:00:00+02'),
    (1, 1, '2026-06-09 08:00:00+02', '2026-06-09 14:00:00+02'),
    (2, 2, '2026-06-09 09:00:00+02', '2026-06-09 17:00:00+02')
ON CONFLICT DO NOTHING;

INSERT INTO appointments (
    customer_id,
    staff_id,
    room_id,
    treatment_id,
    start_time,
    end_time,
    status
)
VALUES
    ('1001010101', 1, 1, 1, '2026-06-08 08:00:00+02', '2026-06-08 09:00:00+02', 'scheduled'),
    ('1002020202', 1, 1, 2, '2026-06-08 09:00:00+02', '2026-06-08 11:00:00+02', 'canceled'),
    ('1003030303', 1, 1, 1, '2026-06-08 11:00:00+02', '2026-06-08 12:00:00+02', 'scheduled'),
    ('1004040404', 2, 2, 3, '2026-06-08 09:30:00+02', '2026-06-08 10:15:00+02', 'scheduled'),
    ('1005050505', 2, 2, 4, '2026-06-08 10:30:00+02', '2026-06-08 11:00:00+02', 'scheduled'),
    ('1006060606', 3, 3, 5, '2026-06-08 10:00:00+02', '2026-06-08 11:30:00+02', 'scheduled'),
    ('1002020202', 1, 1, 1, '2026-06-09 08:00:00+02', '2026-06-09 08:30:00+02', 'scheduled'),
    ('1004040404', 2, 2, 3, '2026-06-09 09:00:00+02', '2026-06-09 09:45:00+02', 'scheduled')
ON CONFLICT DO NOTHING;

INSERT INTO planned_appointments (
    customer_id,
    treatment_id,
    appointment_date
)
VALUES
    ('1001010101', 2, '2027-06-08'),
    ('1003030303', 3, '2027-06-09'),
    ('1005050505', 4, '2027-06-10'),
    ('1006060606', 5, '2027-06-11'),
    ('1002020202', 1, '2027-06-12')
ON CONFLICT DO NOTHING;

SELECT setval('treatments_id_seq', (SELECT MAX(id) FROM treatments));
SELECT setval('staff_id_seq', (SELECT MAX(id) FROM staff));
SELECT setval('rooms_id_seq', (SELECT MAX(id) FROM rooms));
