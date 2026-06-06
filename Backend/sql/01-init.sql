-- Init SQL for PostgreSQL (executed on first container init).
-- Creates tables if missing.

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS customers (
    social_security_number VARCHAR(20) PRIMARY KEY,
    first_name              VARCHAR(80) NOT NULL,
    last_name               VARCHAR(80) NOT NULL,
    birth_date              DATE NOT NULL,
    phone_number            VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS treatments (
    id                    SERIAL PRIMARY KEY,
    name                  VARCHAR(120) NOT NULL UNIQUE,
    min_duration_minutes  INTEGER NOT NULL CHECK (min_duration_minutes > 0)
);

CREATE TABLE IF NOT EXISTS staff (
    id          SERIAL PRIMARY KEY,
    first_name  VARCHAR(80) NOT NULL,
    last_name   VARCHAR(80) NOT NULL
);

CREATE TABLE IF NOT EXISTS rooms (
    id    SERIAL PRIMARY KEY,
    name  VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS staff_specializations (
    staff_id     INTEGER NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
    treatment_id INTEGER NOT NULL REFERENCES treatments (id) ON DELETE CASCADE,
    PRIMARY KEY (staff_id, treatment_id)
);

CREATE TABLE IF NOT EXISTS staff_shifts (
    id          BIGSERIAL PRIMARY KEY,
    staff_id    INTEGER NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
    room_id     INTEGER NOT NULL REFERENCES rooms (id) ON DELETE RESTRICT,
    shift_start TIMESTAMPTZ NOT NULL,
    shift_end   TIMESTAMPTZ NOT NULL,
    CONSTRAINT staff_shift_ends_after_start CHECK (shift_end > shift_start),
    CONSTRAINT no_overlapping_staff_shifts EXCLUDE USING gist (
        staff_id WITH =,
        tstzrange(shift_start, shift_end, '[)') WITH &&
    ),
    CONSTRAINT no_overlapping_room_shifts EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(shift_start, shift_end, '[)') WITH &&
    )
);

CREATE TABLE IF NOT EXISTS weekly_capacity_limits (
    weekday     SMALLINT PRIMARY KEY CHECK (weekday BETWEEN 1 AND 7),
    max_minutes INTEGER NOT NULL CHECK (max_minutes >= 0)
);

CREATE TABLE IF NOT EXISTS appointments (
    id           BIGSERIAL PRIMARY KEY,
    customer_id  VARCHAR(20) NOT NULL REFERENCES customers (social_security_number) ON DELETE CASCADE,
    staff_id     INTEGER NOT NULL REFERENCES staff (id) ON DELETE RESTRICT,
    room_id      INTEGER NOT NULL REFERENCES rooms (id) ON DELETE RESTRICT,
    treatment_id INTEGER NOT NULL REFERENCES treatments (id) ON DELETE RESTRICT,
    start_time   TIMESTAMPTZ NOT NULL,
    end_time     TIMESTAMPTZ NOT NULL,
    status       VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    CONSTRAINT appointment_ends_after_start CHECK (end_time > start_time),
    CONSTRAINT valid_appointment_status CHECK (status IN ('scheduled', 'canceled', 'completed')),
    CONSTRAINT appointment_staff_treatment_is_qualified FOREIGN KEY (staff_id, treatment_id)
        REFERENCES staff_specializations (staff_id, treatment_id) ON DELETE RESTRICT,
    CONSTRAINT no_overlapping_staff_appointments EXCLUDE USING gist (
        staff_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
    ) WHERE (status = 'scheduled'),
    CONSTRAINT no_overlapping_room_appointments EXCLUDE USING gist (
        room_id WITH =,
        tstzrange(start_time, end_time, '[)') WITH &&
    ) WHERE (status = 'scheduled')
);

CREATE INDEX IF NOT EXISTS idx_appointments_customer_id
    ON appointments (customer_id);

CREATE INDEX IF NOT EXISTS idx_appointments_treatment_id
    ON appointments (treatment_id);

CREATE INDEX IF NOT EXISTS idx_appointments_staff_start_time
    ON appointments (staff_id, start_time);

CREATE INDEX IF NOT EXISTS idx_appointments_room_start_time
    ON appointments (room_id, start_time);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_staff_shift_start
    ON staff_shifts (staff_id, shift_start);

CREATE INDEX IF NOT EXISTS idx_staff_shifts_room_shift_start
    ON staff_shifts (room_id, shift_start);

CREATE TABLE IF NOT EXISTS planned_appointments (
    id               BIGSERIAL PRIMARY KEY,
    customer_id      VARCHAR(20) NOT NULL REFERENCES customers (social_security_number) ON DELETE CASCADE,
    treatment_id     INTEGER NOT NULL REFERENCES treatments (id) ON DELETE RESTRICT,
    appointment_date DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_planned_appointments_customer_id
    ON planned_appointments (customer_id);

CREATE INDEX IF NOT EXISTS idx_planned_appointments_treatment_id
    ON planned_appointments (treatment_id);

CREATE INDEX IF NOT EXISTS idx_planned_appointments_appointment_date
    ON planned_appointments (appointment_date);
