// =====================================================================
// EyeCanHelp Buddy — MongoDB POC patient-record seed
//
// ⚠️  DO NOT RUN IN PRODUCTION ⚠️
// These are the two "canonical EPIC" records for the fictitious test
// patients P001 and P002. In production the equivalent data would come
// from a real EPIC FHIR R4 API call, not a static seed.
//
// Idempotent: upsert keyed by record_id with $setOnInsert — existing
// docs are left untouched. Issued date is deliberately historical
// (2020-01-01) so any real patient submission is newer and wins the
// "latest" sort used by /acknowledgement/latest/{patient_id}.
//
// Run with:
//     mongosh "mongodb://<user>:<pass>@<host>:27017/<db>?authSource=admin" \
//             --quiet --file 02_mongo_poc_seed.js
//
// Or locally:
//     docker exec -i eyecanhelp-mongo mongosh eyecanhelpbuddy \
//             --quiet < 02_mongo_poc_seed.js
// =====================================================================

const COLL = 'TBL_PATIENT_RECORDS';
const SEED_ISSUED = ISODate('2020-01-01T00:00:00Z');

const SEED_RECORDS = [
    {
        record_id: 'REC-P001-001',
        patient_id: 'P001',
        record_name: 'Tan Ah Kow',
        record_diagnosis: 'H35.31',           // AMD
        record_eyes: 'OD',
        record_medication: 'Faricimab (Vabysmo)',
        record_number_of_injections: 3,
        record_validity_of_consent: true,
        record_last3mths_admission: false,
        record_stroke_heartAtt_last6mths: false,
        record_taking_antibiotics: false,
        record_pregnant: false,
        issued: SEED_ISSUED,
    },
    {
        record_id: 'REC-P002-001',
        patient_id: 'P002',
        record_name: 'Lim Siew Eng',
        record_diagnosis: 'H36.0',            // DME
        record_eyes: 'OS',
        record_medication: 'Aflibercept (Eylea)',
        record_number_of_injections: 1,
        record_validity_of_consent: true,
        record_last3mths_admission: false,
        record_stroke_heartAtt_last6mths: false,
        record_taking_antibiotics: true,
        record_pregnant: false,
        issued: SEED_ISSUED,
    },
];

for (const record of SEED_RECORDS) {
    const result = db.getCollection(COLL).updateOne(
        { record_id: record.record_id },
        { $setOnInsert: record },
        { upsert: true },
    );
    if (result.upsertedCount === 1) {
        print(`[ok] inserted ${record.record_id} (${record.patient_id})`);
    } else {
        print(`[skip] ${record.record_id} already exists — unchanged`);
    }
}
