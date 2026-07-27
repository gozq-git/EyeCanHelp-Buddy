-- =====================================================================
-- EyeCanHelp Buddy — PostgreSQL reference data
--
-- Loads the IVT medication catalogue and payment-mode rows that the
-- clinic UI depends on. Safe and intended for production.
--
-- Idempotent: re-running leaves existing rows untouched
-- (ON CONFLICT (..._id) DO NOTHING).
--
-- Run with:
--     psql -h <host> -U <user> -d <db> -v ON_ERROR_STOP=1 \
--          -f 02_postgres_reference_data.sql
-- =====================================================================

-- Diagnosis master ------------------------------------------------------
INSERT INTO patient."TBL_DIAGNOSIS" (diagnosis_code, diagnosis_name, diagnosis_category, description, is_active) VALUES
    ('H35.31', 'Age-related macular degeneration', 'Retinal Disorders', 'Wet AMD diagnosis commonly treated with IVT.', TRUE),
    ('H36.0', 'Diabetic macular edema', 'Retinal Disorders', 'Macular edema associated with diabetes mellitus.', TRUE),
    ('H34.8', 'Retinal vascular occlusion', 'Retinal Vascular Disorders', 'Includes vein occlusion conditions requiring IVT in selected cases.', TRUE)
ON CONFLICT (diagnosis_code) DO NOTHING;

-- IVT medication catalogue ---------------------------------------------
INSERT INTO patient."TBL_IVT" (ivt_id, ivt_name, ivt_medication, dosage, manufacturer, is_active) VALUES
    ('02b49d88-6e7d-4470-95ea-839f552f6491', 'Intravitreal Faricimab', 'Faricimab (Vabysmo)', '6 mg/0.05 mL', 'Roche', TRUE),
    ('08d173bf-a33f-4510-a940-aaf28b994de0', 'Intravitreal Ranibizumab', 'Ranibizumab (Lucentis)', '0.5 mg/0.05 mL', 'Novartis', TRUE),
    ('3503fab4-c03c-4f68-a0af-9fcd5914ec9f', 'Intravitreal Aflibercept', 'Aflibercept (Eylea)', '2 mg/0.05 mL', 'Bayer', TRUE)
ON CONFLICT (ivt_id) DO NOTHING;

-- Billing price matrix -------------------------------------------------
INSERT INTO billing."TBL_BILLING_PRICE"
    (record_class, performer, min_per_injection, max_per_injection, max_medisave_claimable)
VALUES
    ('SUB', 'DOCTOR', 86.0, 310.0, 250.0),
    ('SUB', 'NURSE', 62.0, 220.0, 250.0),
    ('PTE', 'DOCTOR', 430.0, 480.0, 250.0),
    ('PTE', 'NURSE', 300.0, 350.0, 250.0)
ON CONFLICT (record_class, performer) DO NOTHING;
