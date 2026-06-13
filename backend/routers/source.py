from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
import schemas
from db import get_db
from models import CrawlJob, Source

router = APIRouter(prefix="/sources", tags=["sources"])

def _require_source(db: Session, source_id: int) -> Source:
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
    return source

def _job_latency_seconds(job: CrawlJob) -> Optional[float]:
    if not job.started_at or not job.finished_at:
        return None
    return max(0.0, (job.finished_at - job.started_at).total_seconds())

@router.post("", response_model=schemas.SourceOut)
@router.post("/", response_model=schemas.SourceOut, include_in_schema=False)
def create(source: schemas.SourceCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_source(db, source)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=list[schemas.SourceOut])
@router.get("/", response_model=list[schemas.SourceOut], include_in_schema=False)
def list_sources(
    name: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    try:
        return crud.get_sources(db, name=name, is_active=is_active)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{source_id}", response_model=schemas.SourceOut)
def update(source_id: int, source: schemas.SourceCreate, db: Session = Depends(get_db)):
    updated_source = crud.update_source(db, source_id, source)
    if not updated_source:
        raise HTTPException(status_code=404, detail="Source not found")
    return updated_source

@router.patch("/{source_id}", response_model=schemas.SourceOut)
def patch(source_id: int, source: schemas.SourceUpdate, db: Session = Depends(get_db)):
    updated_source = crud.patch_source(db, source_id, source)
    if not updated_source:
        raise HTTPException(status_code=404, detail="Source not found")
    return updated_source

@router.patch("/{source_id}/toggle", response_model=schemas.SourceOut)
def toggle(source_id: int, db: Session = Depends(get_db)):
    updated_source = crud.toggle_source(db, source_id)
    if not updated_source:
        raise HTTPException(status_code=404, detail="Source not found")
    return updated_source

@router.delete("/{source_id}")
def delete(source_id: int, db: Session = Depends(get_db)):
    try:
        return crud.delete_source(db, source_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    


def _create_crawl_job(source_id: int, db: Session) -> CrawlJob:
    job = CrawlJob(
        source_id=source_id,
        status="running",
        total_records=0,
        inserted_records=0,
        duplicate_records=0,
        started_at=datetime.now(timezone.utc),
    )

    db.add(job)
    db.commit()
    db.refresh(job)

    return job

@router.post("/{source_id}/crawl")
def start_crawl(source_id: int, db: Session = Depends(get_db)):
    _require_source(db, source_id)
    return _create_crawl_job(source_id, db)

@router.post("/{source_id}/test-crawl", response_model=schemas.SourceTestCrawlOut)
def test_crawl(source_id: int, db: Session = Depends(get_db)):
    _require_source(db, source_id)
    job = _create_crawl_job(source_id, db)
    return schemas.SourceTestCrawlOut(
        job_id=job.id,
        source_id=job.source_id,
        status=job.status,
        message="Manual crawl job queued. The collector scheduler will pick it up and update the job result.",
        total_records=job.total_records or 0,
        inserted_records=job.inserted_records or 0,
        duplicate_records=job.duplicate_records or 0,
        started_at=job.started_at,
    )

@router.get("/{source_id}/health", response_model=schemas.SourceHealthOut)
def source_health(source_id: int, db: Session = Depends(get_db)):
    _require_source(db, source_id)
    jobs = (
        db.query(CrawlJob)
        .filter(CrawlJob.source_id == source_id)
        .order_by(CrawlJob.started_at.desc())
        .all()
    )

    total_jobs = len(jobs)
    successful_jobs = sum(1 for job in jobs if job.status == "completed")
    failed_jobs = sum(1 for job in jobs if job.status == "failed")
    running_jobs = sum(1 for job in jobs if job.status == "running")
    finished_latencies = [
        latency
        for latency in (_job_latency_seconds(job) for job in jobs)
        if latency is not None
    ]

    status = "unknown"
    if running_jobs:
        status = "running"
    elif total_jobs and failed_jobs == total_jobs:
        status = "unhealthy"
    elif total_jobs and successful_jobs:
        status = "healthy"

    last_success = next((job.started_at for job in jobs if job.status == "completed"), None)
    last_error = next((job.started_at for job in jobs if job.status == "failed"), None)

    return schemas.SourceHealthOut(
        source_id=source_id,
        status=status,
        total_jobs=total_jobs,
        successful_jobs=successful_jobs,
        failed_jobs=failed_jobs,
        running_jobs=running_jobs,
        success_rate=round(successful_jobs / total_jobs, 3) if total_jobs else 0.0,
        average_latency_seconds=(
            round(sum(finished_latencies) / len(finished_latencies), 3)
            if finished_latencies
            else None
        ),
        last_run_at=jobs[0].started_at if jobs else None,
        last_success_at=last_success,
        last_error_at=last_error,
    )

@router.get("/{source_id}/metrics", response_model=schemas.SourceMetricsOut)
def source_metrics(
    source_id: int,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    _require_source(db, source_id)
    bounded_limit = min(max(limit, 1), 100)
    all_jobs = (
        db.query(CrawlJob)
        .filter(CrawlJob.source_id == source_id)
        .order_by(CrawlJob.started_at.desc())
        .all()
    )
    recent_jobs = (
        db.query(CrawlJob)
        .filter(CrawlJob.source_id == source_id)
        .order_by(CrawlJob.started_at.desc())
        .limit(bounded_limit)
        .all()
    )

    return schemas.SourceMetricsOut(
        source_id=source_id,
        total_jobs=len(all_jobs),
        total_records=sum(job.total_records or 0 for job in all_jobs),
        inserted_records=sum(job.inserted_records or 0 for job in all_jobs),
        duplicate_records=sum(job.duplicate_records or 0 for job in all_jobs),
        recent_jobs=[
            schemas.SourceMetricPointOut(
                job_id=job.id,
                status=job.status,
                total_records=job.total_records or 0,
                inserted_records=job.inserted_records or 0,
                duplicate_records=job.duplicate_records or 0,
                latency_seconds=_job_latency_seconds(job),
                started_at=job.started_at,
                finished_at=job.finished_at,
            )
            for job in recent_jobs
        ],
    )
