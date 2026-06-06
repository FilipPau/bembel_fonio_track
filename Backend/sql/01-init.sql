CREATE TABLE IF NOT EXISTS customers (
    social_security_number VARCHAR(20) PRIMARY KEY,
    first_name              VARCHAR(80) NOT NULL,
    last_name               VARCHAR(80) NOT NULL,
    birth_date              DATE NOT NULL,
    phone_number            VARCHAR(30),
    has_previous_appointments BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS appointment_types (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(120) NOT NULL,
    duration  INTEGER NOT NULL CHECK (duration > 0)
);

CREATE TABLE IF NOT EXISTS appointments (
    id                  BIGSERIAL PRIMARY KEY,
    customer_id         VARCHAR(20) NOT NULL REFERENCES customers (social_security_number) ON DELETE CASCADE,
    starts_at           TIMESTAMPTZ NOT NULL,
    ends_at             TIMESTAMPTZ NOT NULL,
    appointment_type_id INTEGER NULL REFERENCES appointment_types (id) ON DELETE SET NULL,
    CONSTRAINT ends_after_start CHECK (ends_at > starts_at)
);
-- This file is mounted to PostgreSQL init directory and executed once
-- when a fresh database volume is initialized.

CREATE TABLE IF NOT EXISTS customers (
    social_security_number VARCHAR(20) PRIMARY KEY,
    first_name              VARCHAR(80) NOT NULL,
    last_name               VARCHAR(80) NOT NULL,
    birth_date              DATE NOT NULL,
    phone_number            VARCHAR(30),
    has_previous_appointments BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS appointment_types (
    id        SERIAL PRIMARY KEY,
    name      VARCHAR(120) NOT NULL,
    duration  INTEGER NOT NULL CHECK (duration > 0)
);

CREATE TABLE IF NOT EXISTS appointments (
    id                  BIGSERIAL PRIMARY KEY,
    customer_id         VARCHAR(20) NOT NULL REFERENCES customers (social_security_number) ON DELETE CASCADE,
    starts_at           TIMESTAMPTZ NOT NULL,
    ends_at             TIMESTAMPTZ NOT NULL,
    appointment_type_id INTEGER NULL REFERENCES appointment_types (id) ON DELETE SET NULL,
    CONSTRAINT ends_after_start CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_appointments_customer_id
    ON appointments (customer_id);

CREATE INDEX IF NOT EXISTS idx_appointments_appointment_type_id
    ON appointments (appointment_type_id);
