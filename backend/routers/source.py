from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import crud
import schemas
from db import get_db
from models import CrawlJob, Source

router = APIRouter(prefix="/sources", tags=["sources"])

@router.post("/", response_model=schemas.SourceOut)
def create(source: schemas.SourceCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_source(db, source)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=list[schemas.SourceOut])
def list_sources(db: Session = Depends(get_db)):
    try:
        return crud.get_sources(db)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{source_id}", response_model=schemas.SourceOut)
def update(source_id: int, source: schemas.SourceCreate, db: Session = Depends(get_db)):
    return crud.update_source(db, source_id, source)

@router.patch("/{source_id}/toggle", response_model=schemas.SourceOut)
def toggle(source_id: int, db: Session = Depends(get_db)):
    return crud.toggle_source(db, source_id)

@router.delete("/{source_id}")
def delete(source_id: int, db: Session = Depends(get_db)):
    try:
        return crud.delete_source(db, source_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    


@router.post("/{source_id}/crawl")
def start_crawl(source_id: int, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")

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