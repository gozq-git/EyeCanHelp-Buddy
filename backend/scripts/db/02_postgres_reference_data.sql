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

-- IVT medication catalogue ---------------------------------------------
INSERT INTO "TBL_IVT" (ivt_id, ivt_name, ivt_eyes, ivt_medication) VALUES
    ('IVT001', 'Intravitreal Faricimab',   'OD', 'Faricimab (Vabysmo)'),
    ('IVT002', 'Intravitreal Ranibizumab', 'OS', 'Ranibizumab (Lucentis)'),
    ('IVT003', 'Intravitreal Aflibercept', 'OU', 'Aflibercept (Eylea)')
ON CONFLICT (ivt_id) DO NOTHING;

-- Payment modes --------------------------------------------------------
INSERT INTO "TBL_PAYMENT" (
    payment_id, payment_name, payment_diagnosis,
    "payment_maxMedisave", "payment_estCostPerInjection", payment_mode
) VALUES
    ('PAY001', 'Medisave Standard', 'H35.31', 2150.0, 123.0, 'Medisave'),
    ('PAY002', 'Cash Payment',      'H36.0',  0.0,    500.0, 'Cash'),
    ('PAY003', 'MediShield Life',   'H34.8',  2150.0, 200.0, 'MediShield'),
    ('PAY004', 'CHAS Subsidised',   'H35.31', 2150.0, 50.0,  'CHAS')
ON CONFLICT (payment_id) DO NOTHING;
