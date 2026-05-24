-- =====================================================================
-- EyeCanHelp Buddy — PostgreSQL POC patient seed
--
-- ⚠️  DO NOT RUN IN PRODUCTION ⚠️
-- These are fictitious patients used for development and demo only.
-- Real patient demographics must enter the system through the
-- registration flow (POST /api/patient), not via a static script.
--
-- Idempotent (ON CONFLICT). Safe to re-run in staging.
--
-- Run with:
--     psql -h <host> -U <user> -d <db> -v ON_ERROR_STOP=1 \
--          -f 03_postgres_poc_seed.sql
-- =====================================================================

INSERT INTO "TBL_PATIENT" (patient_id, patient_name, patient_dob, phone_number) VALUES
    ('P001', 'Tan Ah Kow',   '1952-08-12', '+6591234567'),
    ('P002', 'Lim Siew Eng', '1965-03-25', '+6598765432')
ON CONFLICT (patient_id) DO NOTHING;
