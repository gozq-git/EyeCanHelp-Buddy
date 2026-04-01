from contextlib import asynccontextmanager
from fastapi import FastAPI
from dotenv import load_dotenv

load_dotenv()

from database.postgres import init_db
from database.mongo import close_mongo_client
from routers import epic, acknowledgement, symptom, chatbot


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await init_db()
    except Exception as e:
        print(f"[WARNING] PostgreSQL unavailable, skipping DB init: {e}")
    yield
    close_mongo_client()


app = FastAPI(title="EyeCanHelp Buddy Backend", lifespan=lifespan)

app.include_router(epic.router)
app.include_router(acknowledgement.router)
app.include_router(symptom.router)
app.include_router(chatbot.router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "EyeCanHelp Buddy API is running"}
