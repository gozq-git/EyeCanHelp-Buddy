-- =====================================================================
-- EyeCanHelp Buddy — PostgreSQL schema
--
-- Idempotent: re-running on a populated database is safe (CREATE TABLE
-- IF NOT EXISTS).
--
-- Run with:
--     psql -h <host> -U <user> -d <db> -v ON_ERROR_STOP=1 \
--          -f 01_postgres_schema.sql
--
-- Mirrors SQLAlchemy DeclarativeBase metadata from backend/models/*.py.
-- Column names match SQLAlchemy's output verbatim, including the mixed-
-- case identifiers (which Postgres folds to lowercase unless quoted, so
-- they MUST be quoted in DDL and INSERTs).
-- =====================================================================

-- TBL_PATIENT — FHIR R4 Patient. Demographics master.
CREATE TABLE IF NOT EXISTS "TBL_PATIENT" (
    patient_id   VARCHAR(50)  PRIMARY KEY,
    patient_name VARCHAR(255) NOT NULL,
    patient_dob  VARCHAR(20)  NOT NULL,  -- ISO date string
    phone_number VARCHAR(20)
);

-- TBL_IVT — FHIR R4 MedicationRequest/Procedure. Catalogue of IVT meds.
CREATE TABLE IF NOT EXISTS "TBL_IVT" (
    ivt_id         VARCHAR(50)  PRIMARY KEY,
    ivt_name       VARCHAR(255) NOT NULL,
    ivt_eyes       VARCHAR(10)  NOT NULL,  -- OD | OS | OU
    ivt_medication VARCHAR(255) NOT NULL
);

-- TBL_PAYMENT — FHIR R4 Coverage/Claim. Per-acknowledgement payment record.
-- Note: column names use camelCase to match the SQLAlchemy model exactly.
CREATE TABLE IF NOT EXISTS "TBL_PAYMENT" (
    payment_id                    VARCHAR(50)      PRIMARY KEY,
    payment_name                  VARCHAR(255)     NOT NULL,
    payment_diagnosis             VARCHAR(50)      NOT NULL,  -- ICD-10
    "payment_maxMedisave"         DOUBLE PRECISION NOT NULL,  -- SGD
    "payment_estCostPerInjection" DOUBLE PRECISION NOT NULL,  -- SGD
    payment_mode                  VARCHAR(50)      NOT NULL   -- Medisave | NOK Medisave | Cash | MediShield | CHAS
);
