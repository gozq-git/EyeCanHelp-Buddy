from contextlib import asynccontextmanager
from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

from database.postgres import init_db
from database.mongo import close_mongo_client, init_mongo
import services.patient.model  # noqa: F401 — registers TBL_PATIENT and TBL_IVT with SQLAlchemy metadata
import services.chatbot.model  # noqa: F401 — registers TBL_PAYMENT with SQLAlchemy metadata
from services.billing.router import router as billing_router
from services.chatbot.router import acknowledgement_router, chat_router
from services.patient.router import epic_router, patient_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
    except Exception as e:
        print(f"[WARNING] PostgreSQL unavailable, skipping DB init: {e}")
    try:
        await init_mongo()
    except Exception as e:
        print(f"[WARNING] MongoDB unavailable, skipping Mongo seed: {e}")
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
