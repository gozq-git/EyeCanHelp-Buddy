import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI

load_dotenv()

from database.postgres import init_db
from database.mongo import close_mongo_client, init_mongo
import services.patient.model  # noqa: F401 — registers TBL_PATIENT and TBL_IVT with SQLAlchemy metadata
import services.chatbot.model  # noqa: F401 — registers chatbot SQLAlchemy metadata
import services.billing.model  # noqa: F401 — registers billing SQLAlchemy metadata
from services.billing.router import router as billing_router
from services.chatbot.router import acknowledgement_router, chat_router
from services.patient.router import epic_router, patient_router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    skip_db_init = os.getenv("SKIP_DB_INIT", "0").strip().lower() in {"1", "true", "yes", "on"}
    if skip_db_init:
        print("[INFO] SKIP_DB_INIT enabled; skipping PostgreSQL initialization")
    else:
        try:
            await init_db()
        except Exception as exc:
            print(f"[ERROR] PostgreSQL init failed; app startup aborted: {exc}")
            raise
    try:
        await init_mongo()
    except Exception as exc:
        print(f"[WARNING] MongoDB unavailable, skipping Mongo seed: {exc}")
    yield
    close_mongo_client()


app = FastAPI(title="EyeCanHelp Buddy Backend", lifespan=lifespan)

app.include_router(epic_router, prefix="/api")
app.include_router(acknowledgement_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(patient_router, prefix="/api")
app.include_router(billing_router, prefix="/api")


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "EyeCanHelp Buddy API is running"}
