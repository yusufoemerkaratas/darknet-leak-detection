from fastapi import FastAPI
from routers import source, company, crawl_job
app = FastAPI()

app.include_router(source.router)
app.include_router(company.router)
app.include_router(crawl_job.router)

@app.get("/health")
def health():
    return {"status": "ok"}