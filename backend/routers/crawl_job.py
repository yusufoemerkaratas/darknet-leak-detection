from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from db import get_db
from models import CrawlJob
from schemas import CrawlJobOut

router = APIRouter(prefix="/crawl-jobs", tags=["Crawl Jobs"])


@router.get("/", response_model=list[CrawlJobOut])
def get_crawl_jobs(
    status: str | None = None,
    source_id: int | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(CrawlJob)

    if status:
        query = query.filter(CrawlJob.status == status)

    if source_id:
        query = query.filter(CrawlJob.source_id == source_id)

    return (
        query
        .order_by(CrawlJob.started_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{job_id}", response_model=CrawlJobOut)
def get_crawl_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(CrawlJob).filter(CrawlJob.id == job_id).first()

    if not job:
        raise HTTPException(status_code=404, detail="Crawl job not found")

    return job