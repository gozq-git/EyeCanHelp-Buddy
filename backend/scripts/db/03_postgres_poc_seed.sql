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

INSERT INTO patient."TBL_PATIENT" (patient_id, patient_name, patient_dob, gender, phone_number, email, status) VALUES
    ('a25d9f8b-76b8-4f2a-8e2c-43fd5eb15a6c', 'Tan Ah Kow',   '1952-08-12', 'male',   '+6591234567', 'tan.ah.kow@example.com', 'active'),
    ('4db15be7-a9f5-4bf1-a7bc-938d0f838dbc', 'Lim Siew Eng', '1965-03-25', 'female', '+6598765432', 'lim.siew.eng@example.com', 'active')
ON CONFLICT (patient_id) DO NOTHING;
