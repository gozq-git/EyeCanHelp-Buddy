-- =====================================================================
-- EyeCanHelp Buddy — PostgreSQL schema
--
-- Idempotent: re-running on a populated database is safe.
--
-- Run with:
--     psql -h <host> -U <user> -d <db> -v ON_ERROR_STOP=1 \
--          -f 01_postgres_schema.sql
-- =====================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS patient;
CREATE SCHEMA IF NOT EXISTS chatbot;
CREATE SCHEMA IF NOT EXISTS billing;

-- Master table of diagnoses
CREATE TABLE IF NOT EXISTS patient."TBL_DIAGNOSIS" (
    diagnosis_code      VARCHAR(50) PRIMARY KEY,
    diagnosis_name      VARCHAR(150) NOT NULL,
    diagnosis_category  VARCHAR(100),
    description         TEXT,
    is_active           BOOLEAN DEFAULT TRUE
);

-- Master table of IVT treatments/medications
CREATE TABLE IF NOT EXISTS patient."TBL_IVT" (
    ivt_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ivt_name         VARCHAR(150) NOT NULL,
    ivt_medication   VARCHAR(150),
    dosage           VARCHAR(100),
    manufacturer     VARCHAR(150),
    is_active        BOOLEAN DEFAULT TRUE
);

-- Patient master
CREATE TABLE IF NOT EXISTS patient."TBL_PATIENT" (
    patient_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_name     VARCHAR(150) NOT NULL,
    patient_dob      DATE NOT NULL,
    gender           VARCHAR(20),
    phone_number     VARCHAR(30),
    email            VARCHAR(150),
    status           VARCHAR(30),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Diagnoses assigned to patients
CREATE TABLE IF NOT EXISTS patient."TBL_PATIENT_DIAGNOSIS" (
    patient_diagnosis_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id             UUID NOT NULL,
    diagnosis_code         VARCHAR(50) NOT NULL,
    diagnosis_date         DATE NOT NULL,
    eye_affected           VARCHAR(20),
    severity               VARCHAR(50),
    status                 VARCHAR(30),
    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tbl_patient_diagnosis_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient."TBL_PATIENT" (patient_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_tbl_patient_diagnosis_diagnosis
        FOREIGN KEY (diagnosis_code)
        REFERENCES patient."TBL_DIAGNOSIS" (diagnosis_code)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

-- IVT treatment plans assigned to patients
CREATE TABLE IF NOT EXISTS patient."TBL_PATIENT_IVT" (
    patient_ivt_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id            UUID NOT NULL,
    ivt_id                UUID NOT NULL,
    patient_diagnosis_id  UUID NOT NULL,
    start_date            DATE NOT NULL,
    injection_count       INTEGER,
    status                VARCHAR(30),
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_tbl_patient_ivt_injection_count
        CHECK (injection_count IS NULL OR injection_count >= 0),

    CONSTRAINT fk_tbl_patient_ivt_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient."TBL_PATIENT" (patient_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_tbl_patient_ivt_ivt
        FOREIGN KEY (ivt_id)
        REFERENCES patient."TBL_IVT" (ivt_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_tbl_patient_ivt_patient_diagnosis
        FOREIGN KEY (patient_diagnosis_id)
        REFERENCES patient."TBL_PATIENT_DIAGNOSIS" (patient_diagnosis_id)
        ON DELETE RESTRICT
);

-- Individual injection sessions
CREATE TABLE IF NOT EXISTS patient."TBL_INJECTION_SESSION" (
    session_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_ivt_id    UUID NOT NULL,
    patient_id        UUID NOT NULL,
    session_date      DATE NOT NULL,
    eye_treated       VARCHAR(20),
    batch_number      VARCHAR(100),
    clinical_notes    TEXT,
    session_status    VARCHAR(30),
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tbl_injection_session_patient_ivt
        FOREIGN KEY (patient_ivt_id)
        REFERENCES patient."TBL_PATIENT_IVT" (patient_ivt_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_tbl_injection_session_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient."TBL_PATIENT" (patient_id)
        ON DELETE CASCADE
);

-- Flexible patient form submissions
CREATE TABLE IF NOT EXISTS patient."TBL_FORM_RECORD" (
    form_record_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id        UUID NOT NULL,
    form_type         VARCHAR(100) NOT NULL,
    form_status       VARCHAR(30),
    form_data         JSONB,
    submitted_at      TIMESTAMP,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tbl_form_record_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient."TBL_PATIENT" (patient_id)
        ON DELETE CASCADE
);

-- Patient addresses
CREATE TABLE IF NOT EXISTS patient."TBL_PATIENT_ADDRESS" (
    address_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id        UUID NOT NULL,
    address_line      TEXT NOT NULL,
    postal_code       VARCHAR(20),
    is_primary        BOOLEAN DEFAULT FALSE,
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_tbl_patient_address_patient
        FOREIGN KEY (patient_id)
        REFERENCES patient."TBL_PATIENT" (patient_id)
        ON DELETE CASCADE
);

-- Chat transcript rows
CREATE TABLE IF NOT EXISTS chatbot."TBL_CHAT_EXCHANGE_LOG" (
    id               INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    session_id       VARCHAR(100) NOT NULL,
    patient_id       VARCHAR(50),
    mode             VARCHAR(50) NOT NULL,
    user_message     TEXT NOT NULL,
    system_response  TEXT NOT NULL,
    created_at       TIMESTAMP NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Singapore')
);

-- Upgrade path for databases created before patient_id existed
-- (CREATE TABLE IF NOT EXISTS does not add columns to pre-existing tables).
ALTER TABLE chatbot."TBL_CHAT_EXCHANGE_LOG"
    ADD COLUMN IF NOT EXISTS patient_id VARCHAR(50);

-- Billing price matrix (record class x performer)
CREATE TABLE IF NOT EXISTS billing."TBL_BILLING_PRICE" (
    price_id                INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    record_class            VARCHAR(20) NOT NULL,
    performer               VARCHAR(20) NOT NULL,
    min_per_injection       DOUBLE PRECISION NOT NULL,
    max_per_injection       DOUBLE PRECISION NOT NULL,
    max_medisave_claimable  DOUBLE PRECISION NOT NULL DEFAULT 250.0,

    CONSTRAINT uq_tbl_billing_price_class_performer
        UNIQUE (record_class, performer)
);

-- Foreign-key and lookup indexes
CREATE INDEX IF NOT EXISTS idx_tbl_patient_diagnosis_patient_id
    ON patient."TBL_PATIENT_DIAGNOSIS" (patient_id);

CREATE INDEX IF NOT EXISTS idx_tbl_patient_diagnosis_code
    ON patient."TBL_PATIENT_DIAGNOSIS" (diagnosis_code);

CREATE INDEX IF NOT EXISTS idx_tbl_patient_ivt_patient_id
    ON patient."TBL_PATIENT_IVT" (patient_id);

CREATE INDEX IF NOT EXISTS idx_tbl_patient_ivt_ivt_id
    ON patient."TBL_PATIENT_IVT" (ivt_id);

CREATE INDEX IF NOT EXISTS idx_tbl_patient_ivt_patient_diagnosis_id
    ON patient."TBL_PATIENT_IVT" (patient_diagnosis_id);

CREATE INDEX IF NOT EXISTS idx_tbl_injection_session_patient_ivt_id
    ON patient."TBL_INJECTION_SESSION" (patient_ivt_id);

CREATE INDEX IF NOT EXISTS idx_tbl_injection_session_patient_id
    ON patient."TBL_INJECTION_SESSION" (patient_id);

CREATE INDEX IF NOT EXISTS idx_tbl_injection_session_session_date
    ON patient."TBL_INJECTION_SESSION" (session_date);

CREATE INDEX IF NOT EXISTS idx_tbl_form_record_patient_id
    ON patient."TBL_FORM_RECORD" (patient_id);

CREATE INDEX IF NOT EXISTS idx_tbl_patient_address_patient_id
    ON patient."TBL_PATIENT_ADDRESS" (patient_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tbl_patient_address_one_primary
    ON patient."TBL_PATIENT_ADDRESS" (patient_id)
    WHERE is_primary = TRUE;

CREATE INDEX IF NOT EXISTS idx_tbl_chat_exchange_log_session
    ON chatbot."TBL_CHAT_EXCHANGE_LOG" (session_id);

COMMIT;
