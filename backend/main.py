from fastapi import FastAPI
from routers import source, company

app = FastAPI()

app.include_router(source.router)
app.include_router(company.router)

@app.get("/health")
def health():
    return {"status": "ok"}