-- Improved mock data for local development and tests.
-- Run after 01-init_4.sql.
-- Covers 2026-06-01 to 2026-06-14 with 3 rooms, 3 doctors, many appointments,
-- and realistic refill attempts with successful and unsuccessful outcomes.

TRUNCATE TABLE
    refill_attempts,
    appointment_refills,
    planned_appointments,
    appointments,
    staff_shifts,
    staff_specializations,
    weekly_capacity_limits,
    rooms,
    staff,
    treatments,
    customers
RESTART IDENTITY CASCADE;

INSERT INTO customers (social_security_number, first_name, last_name, birth_date, phone_number)
VALUES
('1001010101', 'Bembel', 'Boiii', '2003-01-01', '+436642144008'),
('1001010102', 'Krakus', 'Abjela', '1940-01-01', '+436502908969'),
('1002020202', 'Omar', 'Haddad', '1984-02-20', '+43660200200'),
('1003030303', 'Mia', 'Schneider', '1978-03-30', '+43660300300'),
('1004040404', 'Noah', 'Berger', '1995-04-04', '+43660400400'),
('1005050505', 'Emma', 'Wagner', '2001-05-15', '+43660500500'),
('1006060606', 'Jonas', 'Mayer', '1969-06-06', '+43660600600'),
('1007070707', 'Leonie', 'Bauer', '1988-07-07', '+43660700700'),
('1008080808', 'Felix', 'Gruber', '1992-08-18', '+43660800800'),
('1009090909', 'Anna', 'Hofer', '1975-09-09', '+43660900900'),
('1010101010', 'Lukas', 'Weber', '1981-10-10', '+43661001000'),
('1011111111', 'Sarah', 'Fuchs', '1999-11-11', '+43661101100'),
('1012121212', 'Paul', 'Steiner', '1964-12-12', '+43661201200'),
('1101010101', 'Nina', 'Klein', '2004-01-13', '+43661301300'),
('1102020202', 'David', 'Schwarz', '1986-02-14', '+43661401400'),
('1103030303', 'Laura', 'Neumann', '1972-03-15', '+43661501500'),
('1104040404', 'Tobias', 'Lang', '1990-04-16', '+43661601600'),
('1105050505', 'Elena', 'Haas', '1983-05-17', '+43661701700'),
('1106060606', 'Simon', 'Pichler', '1997-06-18', '+43661801800'),
('1107070707', 'Julia', 'Kern', '1979-07-19', '+43661901900'),
('1108080808', 'Markus', 'Winkler', '1968-08-20', '+43662002000'),
('1109090909', 'Sofia', 'Auer', '1993-09-21', '+43662102100'),
('1110101010', 'Daniel', 'Moser', '1985-10-22', '+43662202200'),
('1111111111', 'Katharina', 'Wolf', '2000-11-23', '+43662302300'),
('1112121212', 'Adrian', 'Koller', '1977-12-24', '+43662402400'),
('1201010101', 'Marie', 'Eder', '1991-01-25', '+43662502500'),
('1202020202', 'Hannes', 'Lechner', '1980-02-26', '+43662602600'),
('1203030303', 'Clara', 'Reiter', '1996-03-27', '+43662702700'),
('1204040404', 'Philipp', 'Mayr', '1962-04-28', '+43662802800'),
('1205050505', 'Theresa', 'Binder', '1989-05-29', '+43662902900'),
('1206060606', 'Rafael', 'Koch', '1974-06-30', '+43663003000'),
('1207070707', 'Hannah', 'Schmid', '2002-07-31', '+43663103100'),
('1208080808', 'Matteo', 'Graf', '1994-08-01', '+43663203200'),
('1209090909', 'Eva', 'Huber', '1982-09-02', '+43663303300'),
('1210101010', 'Ben', 'Seidl', '1970-10-03', '+43663403400'),
('1211111111', 'Alina', 'Winter', '1998-11-04', '+43663503500');

INSERT INTO treatments (id, name, min_duration_minutes)
VALUES
(1, 'Kleine Plombe', 30),
(2, 'Zahnersatz', 120),
(3, 'Zahnreinigung', 45),
(4, 'Kontrolle', 20),
(5, 'Wurzelbehandlung', 90);

INSERT INTO staff (id, first_name, last_name)
VALUES
(1, 'Marcus', 'Vance'),
(2, 'Amira', 'Khattab'),
(3, 'Sophie', 'Leitner');

INSERT INTO rooms (id, name)
VALUES
(1, 'Raum 1'),
(2, 'Raum 2'),
(3, 'Raum 3');

INSERT INTO staff_specializations (staff_id, treatment_id)
VALUES
(1, 1), (1, 2), (1, 4),
(2, 1), (2, 3), (2, 4),
(3, 3), (3, 4), (3, 5);

INSERT INTO weekly_capacity_limits (weekday, max_minutes)
VALUES
(1, 480),
(2, 480),
(3, 480),
(4, 480),
(5, 480),
(6, 0),
(7, 0);

WITH workdays(day) AS (
    VALUES
    ('2026-06-01'::date),
    ('2026-06-02'::date),
    ('2026-06-03'::date),
    ('2026-06-04'::date),
    ('2026-06-05'::date),
    ('2026-06-08'::date),
    ('2026-06-09'::date),
    ('2026-06-10'::date),
    ('2026-06-11'::date),
    ('2026-06-12'::date)
),
shift_pattern(staff_id, room_id, start_clock, end_clock) AS (
    VALUES
    (1, 1, '08:00', '14:00'),
    (2, 2, '09:00', '17:00'),
    (3, 3, '10:00', '18:00')
)
INSERT INTO staff_shifts (staff_id, room_id, shift_start, shift_end)
SELECT
    p.staff_id,
    p.room_id,
    (w.day::text || ' ' || p.start_clock || ':00+02')::timestamptz,
    (w.day::text || ' ' || p.end_clock || ':00+02')::timestamptz
FROM workdays w
CROSS JOIN shift_pattern p;

WITH workdays(day, day_index) AS (
    VALUES
    ('2026-06-01'::date, 0),
    ('2026-06-02'::date, 1),
    ('2026-06-03'::date, 2),
    ('2026-06-04'::date, 3),
    ('2026-06-05'::date, 4),
    ('2026-06-08'::date, 5),
    ('2026-06-09'::date, 6),
    ('2026-06-10'::date, 7),
    ('2026-06-11'::date, 8),
    ('2026-06-12'::date, 9)
),
appointment_pattern(staff_id, room_id, treatment_id, start_clock, end_clock, customer_offset) AS (
    VALUES
    (1, 1, 4, '08:00', '08:20', 0),
    (1, 1, 1, '08:30', '09:00', 1),
    (1, 1, 4, '09:15', '09:35', 2),
    (1, 1, 1, '10:00', '10:30', 3),
    (1, 1, 2, '11:00', '13:00', 4),
    (1, 1, 4, '13:15', '13:35', 5),
    (2, 2, 3, '09:00', '09:45', 6),
    (2, 2, 4, '10:00', '10:20', 7),
    (2, 2, 1, '10:45', '11:15', 8),
    (2, 2, 3, '12:00', '12:45', 9),
    (2, 2, 4, '13:30', '13:50', 10),
    (2, 2, 1, '15:00', '15:30', 11),
    (2, 2, 3, '15:45', '16:30', 12),
    (3, 3, 5, '10:00', '11:30', 13),
    (3, 3, 4, '11:45', '12:05', 14),
    (3, 3, 3, '12:30', '13:15', 15),
    (3, 3, 5, '14:00', '15:30', 16),
    (3, 3, 4, '16:00', '16:20', 17),
    (3, 3, 3, '16:45', '17:30', 18)
)
INSERT INTO appointments (
    id,
    customer_id,
    staff_id,
    room_id,
    treatment_id,
    start_time,
    end_time
)
SELECT
    ROW_NUMBER() OVER (ORDER BY w.day, p.staff_id, p.start_clock),
    c.social_security_number,
    p.staff_id,
    p.room_id,
    p.treatment_id,
    (w.day::text || ' ' || p.start_clock || ':00+02')::timestamptz,
    (w.day::text || ' ' || p.end_clock || ':00+02')::timestamptz
FROM workdays w
CROSS JOIN appointment_pattern p
JOIN LATERAL (
    SELECT social_security_number
    FROM customers
    ORDER BY social_security_number
    OFFSET ((w.day_index * 7 + p.customer_offset) % 36)
    LIMIT 1
) c ON true;

INSERT INTO planned_appointments (customer_id, treatment_id, appointment_date)
VALUES
('1001010101', 2, '2027-06-08'),
('1003030303', 3, '2027-06-09'),
('1005050505', 4, '2027-06-10'),
('1006060606', 5, '2027-06-11'),
('1002020202', 1, '2027-06-12'),
('1101010101', 3, '2027-06-15'),
('1104040404', 1, '2027-06-16'),
('1110101010', 5, '2027-06-17'),
('1202020202', 4, '2027-06-18'),
('1211111111', 2, '2027-06-19');

WITH refill_seed(uid, old_staff_id, old_start, new_staff_id, new_start) AS (
    VALUES
    (1,  1, '2026-06-01 11:00:00+02'::timestamptz, 1, '2026-06-08 08:30:00+02'::timestamptz),
    (2,  1, '2026-06-01 11:00:00+02'::timestamptz, 1, '2026-06-08 09:15:00+02'::timestamptz),
    (3,  2, '2026-06-01 09:00:00+02'::timestamptz, 2, '2026-06-08 10:00:00+02'::timestamptz),
    (4,  3, '2026-06-01 10:00:00+02'::timestamptz, 3, '2026-06-08 12:30:00+02'::timestamptz),
    (5,  1, '2026-06-02 08:30:00+02'::timestamptz, NULL::integer, NULL::timestamptz),
    (6,  2, '2026-06-02 12:00:00+02'::timestamptz, 2, '2026-06-09 10:45:00+02'::timestamptz),
    (7,  3, '2026-06-02 14:00:00+02'::timestamptz, 3, '2026-06-09 11:45:00+02'::timestamptz),
    (8,  1, '2026-06-03 10:00:00+02'::timestamptz, NULL::integer, NULL::timestamptz),
    (9,  2, '2026-06-03 15:45:00+02'::timestamptz, 2, '2026-06-10 09:00:00+02'::timestamptz),
    (10, 3, '2026-06-03 10:00:00+02'::timestamptz, 3, '2026-06-10 16:45:00+02'::timestamptz),
    (11, 1, '2026-06-04 11:00:00+02'::timestamptz, 1, '2026-06-11 13:15:00+02'::timestamptz),
    (12, 2, '2026-06-04 09:00:00+02'::timestamptz, NULL::integer, NULL::timestamptz),
    (13, 3, '2026-06-04 14:00:00+02'::timestamptz, 3, '2026-06-11 12:30:00+02'::timestamptz),
    (14, 1, '2026-06-05 08:00:00+02'::timestamptz, 1, '2026-06-12 10:00:00+02'::timestamptz),
    (15, 2, '2026-06-05 10:45:00+02'::timestamptz, 2, '2026-06-12 13:30:00+02'::timestamptz),
    (16, 3, '2026-06-05 16:45:00+02'::timestamptz, NULL::integer, NULL::timestamptz),
    (17, 1, '2026-06-08 11:00:00+02'::timestamptz, 1, '2026-06-10 08:30:00+02'::timestamptz),
    (18, 2, '2026-06-08 15:00:00+02'::timestamptz, 2, '2026-06-11 10:45:00+02'::timestamptz),
    (19, 3, '2026-06-09 10:00:00+02'::timestamptz, 3, '2026-06-12 11:45:00+02'::timestamptz),
    (20, 1, '2026-06-10 11:00:00+02'::timestamptz, NULL::integer, NULL::timestamptz),
    (21, 2, '2026-06-11 12:00:00+02'::timestamptz, 2, '2026-06-12 15:00:00+02'::timestamptz),
    (22, 3, '2026-06-12 14:00:00+02'::timestamptz, NULL::integer, NULL::timestamptz)
)
INSERT INTO appointment_refills (uid, old_appointment_id, new_appointment_id)
SELECT
    s.uid,
    old_app.id,
    new_app.id
FROM refill_seed s
JOIN appointments old_app
    ON old_app.staff_id = s.old_staff_id
    AND old_app.start_time = s.old_start
LEFT JOIN appointments new_app
    ON s.new_staff_id IS NOT NULL
    AND new_app.staff_id = s.new_staff_id
    AND new_app.start_time = s.new_start;

WITH seed_attempts(refill_uid, customer_offset, outcome, outcome_reason, call_timestamp, call_duration_seconds) AS (
    VALUES
    (1,  4, 'no_answer', 'Nicht erreicht',             '2026-06-01 08:35:00+02'::timestamptz, 0),
    (1,  7, 'declined',  'Abgelehnt, zu kurzfristig',  '2026-06-01 08:52:00+02'::timestamptz, 132),
    (1,  NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-01 09:08:00+02'::timestamptz, 214),
    (2,  8, 'no_answer', 'Nicht geantwortet',          '2026-06-01 11:10:00+02'::timestamptz, 0),
    (2,  NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-01 11:31:00+02'::timestamptz, 166),
    (3,  9, 'declined',  'Abgelehnt, zu kurzfristig',  '2026-06-01 12:05:00+02'::timestamptz, 98),
    (3,  10, 'no_answer', 'Nicht erreicht',            '2026-06-01 12:28:00+02'::timestamptz, 0),
    (3,  NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-01 12:44:00+02'::timestamptz, 181),
    (4,  11, 'no_answer', 'Nicht geantwortet',         '2026-06-01 15:10:00+02'::timestamptz, 0),
    (4,  12, 'declined',  'Abgelehnt, zu kurzfristig', '2026-06-01 15:38:00+02'::timestamptz, 77),
    (4,  NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-01 15:57:00+02'::timestamptz, 203),
    (5,  13, 'no_answer', 'Nicht erreicht',            '2026-06-02 08:20:00+02'::timestamptz, 0),
    (5,  14, 'declined',  'Abgelehnt, zu kurzfristig', '2026-06-02 08:44:00+02'::timestamptz, 85),
    (5,  15, 'no_answer', 'Nicht geantwortet',         '2026-06-02 09:13:00+02'::timestamptz, 0),
    (6,  16, 'declined',  'Abgelehnt, zu kurzfristig', '2026-06-02 12:21:00+02'::timestamptz, 116),
    (6,  NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-02 12:42:00+02'::timestamptz, 178),
    (7,  17, 'no_answer', 'Nicht erreicht',            '2026-06-02 14:35:00+02'::timestamptz, 0),
    (7,  NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-02 14:53:00+02'::timestamptz, 154),
    (8,  18, 'declined',  'Abgelehnt, zu kurzfristig', '2026-06-03 09:25:00+02'::timestamptz, 91),
    (8,  19, 'no_answer', 'Nicht geantwortet',         '2026-06-03 09:51:00+02'::timestamptz, 0),
    (9,  20, 'no_answer', 'Nicht erreicht',            '2026-06-03 15:04:00+02'::timestamptz, 0),
    (9,  21, 'declined',  'Abgelehnt, zu kurzfristig', '2026-06-03 15:31:00+02'::timestamptz, 103),
    (9,  NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-03 15:49:00+02'::timestamptz, 197),
    (10, 22, 'no_answer', 'Nicht geantwortet',         '2026-06-03 10:35:00+02'::timestamptz, 0),
    (10, NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-03 10:58:00+02'::timestamptz, 188),
    (11, 23, 'declined',  'Abgelehnt, zu kurzfristig', '2026-06-04 11:16:00+02'::timestamptz, 73),
    (11, NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-04 11:40:00+02'::timestamptz, 169),
    (12, 24, 'no_answer', 'Nicht erreicht',            '2026-06-04 08:50:00+02'::timestamptz, 0),
    (12, 25, 'no_answer', 'Nicht geantwortet',         '2026-06-04 09:18:00+02'::timestamptz, 0),
    (12, 26, 'declined',  'Abgelehnt, zu kurzfristig', '2026-06-04 09:42:00+02'::timestamptz, 112),
    (13, 27, 'no_answer', 'Nicht erreicht',            '2026-06-04 13:55:00+02'::timestamptz, 0),
    (13, NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-04 14:13:00+02'::timestamptz, 211),
    (14, 28, 'declined',  'Abgelehnt, zu kurzfristig', '2026-06-05 07:42:00+02'::timestamptz, 87),
    (14, NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-05 08:02:00+02'::timestamptz, 191),
    (15, 29, 'no_answer', 'Nicht geantwortet',         '2026-06-05 10:02:00+02'::timestamptz, 0),
    (15, 30, 'declined',  'Abgelehnt, zu kurzfristig', '2026-06-05 10:26:00+02'::timestamptz, 95),
    (15, NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-05 10:47:00+02'::timestamptz, 173),
    (16, 31, 'no_answer', 'Nicht erreicht',            '2026-06-05 16:02:00+02'::timestamptz, 0),
    (16, 32, 'declined',  'Abgelehnt, zu kurzfristig', '2026-06-05 16:31:00+02'::timestamptz, 66),
    (17, 33, 'no_answer', 'Nicht geantwortet',         '2026-06-08 10:22:00+02'::timestamptz, 0),
    (17, NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-08 10:46:00+02'::timestamptz, 205),
    (18, 34, 'declined',  'Abgelehnt, zu kurzfristig', '2026-06-08 14:24:00+02'::timestamptz, 102),
    (18, NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-08 14:45:00+02'::timestamptz, 186),
    (19, 35, 'no_answer', 'Nicht erreicht',            '2026-06-09 09:18:00+02'::timestamptz, 0),
    (19, 0,  'declined',  'Abgelehnt, zu kurzfristig', '2026-06-09 09:43:00+02'::timestamptz, 114),
    (19, NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-09 10:04:00+02'::timestamptz, 226),
    (20, 1,  'no_answer', 'Nicht geantwortet',         '2026-06-10 10:12:00+02'::timestamptz, 0),
    (20, 2,  'declined',  'Abgelehnt, zu kurzfristig', '2026-06-10 10:35:00+02'::timestamptz, 79),
    (21, 3,  'no_answer', 'Nicht erreicht',            '2026-06-11 11:05:00+02'::timestamptz, 0),
    (21, NULL::integer, 'accepted', 'Termin vorverschoben', '2026-06-11 11:27:00+02'::timestamptz, 194),
    (22, 4,  'declined',  'Abgelehnt, zu kurzfristig', '2026-06-12 13:11:00+02'::timestamptz, 88),
    (22, 5,  'no_answer', 'Nicht geantwortet',         '2026-06-12 13:38:00+02'::timestamptz, 0),
    (22, 6,  'no_answer', 'Nicht erreicht',            '2026-06-12 14:02:00+02'::timestamptz, 0)
)
INSERT INTO refill_attempts (
    refill_uid,
    customer_id,
    outcome,
    outcome_reason,
    call_timestamp,
    call_duration_seconds
)
SELECT
    s.refill_uid,
    COALESCE(seeded_customer.social_security_number, new_app.customer_id),
    s.outcome,
    s.outcome_reason,
    s.call_timestamp,
    s.call_duration_seconds
FROM seed_attempts s
JOIN appointment_refills ar ON ar.uid = s.refill_uid
LEFT JOIN appointments new_app ON new_app.id = ar.new_appointment_id
LEFT JOIN LATERAL (
    SELECT social_security_number
    FROM customers
    ORDER BY social_security_number
    OFFSET COALESCE(s.customer_offset, 0)
    LIMIT 1
) seeded_customer ON s.customer_offset IS NOT NULL
WHERE COALESCE(seeded_customer.social_security_number, new_app.customer_id) IS NOT NULL;

SELECT setval('treatments_id_seq', COALESCE((SELECT MAX(id) FROM treatments), 1), true);
SELECT setval('staff_id_seq', COALESCE((SELECT MAX(id) FROM staff), 1), true);
SELECT setval('rooms_id_seq', COALESCE((SELECT MAX(id) FROM rooms), 1), true);
SELECT setval('staff_shifts_id_seq', COALESCE((SELECT MAX(id) FROM staff_shifts), 1), true);
SELECT setval('appointments_id_seq', COALESCE((SELECT MAX(id) FROM appointments), 1), true);
SELECT setval('planned_appointments_id_seq', COALESCE((SELECT MAX(id) FROM planned_appointments), 1), true);
SELECT setval('appointment_refills_uid_seq', COALESCE((SELECT MAX(uid) FROM appointment_refills), 1), true);
SELECT setval('refill_attempts_uid_seq', COALESCE((SELECT MAX(uid) FROM refill_attempts), 1), true);
