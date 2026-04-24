from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db import get_db
from models import CrawlJob
from schemas import CrawlJobOut

router = APIRouter(prefix="/crawl-jobs", tags=["Crawl Jobs"])


@router.get("/", response_model=list[CrawlJobOut])
def get_crawl_jobs(db: Session = Depends(get_db)):
    return db.query(CrawlJob).all()


@router.get("/{job_id}", response_model=CrawlJobOut)
def get_crawl_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()
    if not job:
        return {"error": "not found"}
    return job