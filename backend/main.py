from contextlib import asynccontextmanager
from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

from database.postgres import init_db
from database.mongo import close_mongo_client, init_mongo
import models.patient  # noqa: F401 — registers TBL_PATIENT with SQLAlchemy metadata
import models.ivt      # noqa: F401 — registers TBL_IVT with SQLAlchemy metadata
import models.payment  # noqa: F401 — registers TBL_PAYMENT with SQLAlchemy metadata
from routers import epic, acknowledgement, symptom, chatbot, patient


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

app.include_router(epic.router, prefix="/api")
app.include_router(acknowledgement.router, prefix="/api")
app.include_router(symptom.router, prefix="/api")
app.include_router(chatbot.router, prefix="/api")
app.include_router(patient.router, prefix="/api")


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "EyeCanHelp Buddy API is running"}
