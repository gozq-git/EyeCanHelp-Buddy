// =====================================================================
// EyeCanHelp Buddy — MongoDB schema and indexes
//
// Creates the TBL_PATIENT_RECORDS collection and the two indexes the
// application relies on. Safe and intended for production.
//
// Idempotent: createCollection swallows the NamespaceExists error and
// createIndex is a no-op when the same index already exists.
//
// Run with (replace <host>, <db>, and credentials as appropriate):
//     mongosh "mongodb://<user>:<pass>@<host>:27017/<db>?authSource=admin" \
//             --quiet --file 01_mongo_schema.js
//
// Or against a local container without auth:
//     docker exec -i eyecanhelp-mongo mongosh eyecanhelpbuddy \
//             --quiet < 01_mongo_schema.js
// =====================================================================

const COLL = 'TBL_PATIENT_RECORDS';

// 1. Collection -----------------------------------------------------
//    Idempotent — wrap in try/catch to absorb "NamespaceExists" on re-run.
try {
    db.createCollection(COLL);
    print(`[ok] created collection ${COLL}`);
} catch (e) {
    if (e.codeName === 'NamespaceExists') {
        print(`[skip] collection ${COLL} already exists`);
    } else {
        throw e;
    }
}

// 2. Indexes --------------------------------------------------------
//    a) record_id is the application-level primary key (stable IDs like
//       REC-{patient_id}-001 for canonical EPIC records, REC-{patient_id}-{6hex}
//       for user submissions). Must be unique.
db.getCollection(COLL).createIndex(
    { record_id: 1 },
    { unique: true, name: 'idx_record_id_unique' },
);

//    b) Compound index for "latest submission per patient" queries.
//       Used by GET /acknowledgement/latest/{patient_id} which executes
//       find_one({patient_id}, sort=[(issued, -1)]).
db.getCollection(COLL).createIndex(
    { patient_id: 1, issued: -1 },
    { name: 'idx_patient_id_issued_desc' },
);

print(`[ok] indexes ensured on ${COLL}`);
