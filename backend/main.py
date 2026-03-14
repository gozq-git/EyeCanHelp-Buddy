from fastapi import FastAPI


app = FastAPI(title="EyeCanHelp Buddy Backend")


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "Hello, World!"}
