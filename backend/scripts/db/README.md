# Database initialisation scripts

Standalone SQL / mongosh scripts that replicate the schema and reference
data that `backend/database/postgres.py::init_db()` and
`backend/database/mongo.py::init_mongo()` create at FastAPI startup.

Use these when you want to provision the databases **outside** the
application — e.g. running them in a CI/CD pipeline, a one-shot Job in
Kubernetes, or by handing them to a DBA. The application's
`init_db()` / `init_mongo()` will detect the already-populated state
and become no-ops, so it is safe to run both.

## Files

| #  | File                                | Purpose                                       | Run in production? |
|----|-------------------------------------|-----------------------------------------------|--------------------|
| 1  | `01_postgres_schema.sql`            | Create tables (`TBL_PATIENT`, `TBL_IVT`, `TBL_PAYMENT`) | ✅ Yes |
| 2  | `02_postgres_reference_data.sql`    | IVT medications + payment-mode rows           | ✅ Yes |
| 3  | `03_postgres_poc_seed.sql`          | P001 / P002 demo patients                     | ❌ Staging / demo only |
| 4  | `01_mongo_schema.js`                | `TBL_PATIENT_RECORDS` collection + indexes    | ✅ Yes |
| 5  | `02_mongo_poc_seed.js`              | `REC-P001-001` / `REC-P002-001` EPIC records  | ❌ Staging / demo only |

All scripts are **idempotent** — re-running them on a populated database
is safe (`CREATE TABLE IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, Mongo
`$setOnInsert` upserts, `createIndex` no-op when the same index exists).

## Run order

### Production

```bash
psql "$POSTGRES_URL" -v ON_ERROR_STOP=1 -f 01_postgres_schema.sql
psql "$POSTGRES_URL" -v ON_ERROR_STOP=1 -f 02_postgres_reference_data.sql

mongosh "$MONGO_URL" --quiet --file 01_mongo_schema.js
```

### Staging / demo (adds the fictitious test patients)

```bash
psql "$POSTGRES_URL" -v ON_ERROR_STOP=1 -f 01_postgres_schema.sql
psql "$POSTGRES_URL" -v ON_ERROR_STOP=1 -f 02_postgres_reference_data.sql
psql "$POSTGRES_URL" -v ON_ERROR_STOP=1 -f 03_postgres_poc_seed.sql

mongosh "$MONGO_URL" --quiet --file 01_mongo_schema.js
mongosh "$MONGO_URL" --quiet --file 02_mongo_poc_seed.js
```

`POSTGRES_URL` uses the libpq form here (`postgres://user:pass@host:5432/db`),
not the `postgresql+asyncpg://` URL that SQLAlchemy uses — drop the
`+asyncpg` suffix before passing the value to `psql`.

`MONGO_URL` uses the standard `mongodb://` connection string.

## Connecting against the local dev containers

```bash
# Postgres (from anywhere on the host)
psql -h localhost -p 5432 -U postgres -d eyecanhelpbuddy -v ON_ERROR_STOP=1 \
     -f 01_postgres_schema.sql

# Postgres (from inside the container — no client install needed)
docker exec -i eyecanhelp-postgres psql -U postgres -d eyecanhelpbuddy -v ON_ERROR_STOP=1 \
     < 01_postgres_schema.sql

# Mongo (dev container — host port 27019, container port 27017)
docker exec -i eyecanhelp-mongo mongosh eyecanhelpbuddy --quiet < 01_mongo_schema.js
```

## Verifying

```bash
docker exec eyecanhelp-postgres psql -U postgres -d eyecanhelpbuddy \
    -c "\dt" \
    -c "SELECT count(*) FROM \"TBL_IVT\";" \
    -c "SELECT count(*) FROM \"TBL_PAYMENT\";"

docker exec eyecanhelp-mongo mongosh eyecanhelpbuddy --quiet --eval \
    "db.TBL_PATIENT_RECORDS.getIndexes()"
```

Expected after a fresh production run: 3 tables, 3 IVT rows, 4 payment
rows, 0 patient rows; Mongo collection exists with `_id_`,
`idx_record_id_unique`, and `idx_patient_id_issued_desc` indexes.
