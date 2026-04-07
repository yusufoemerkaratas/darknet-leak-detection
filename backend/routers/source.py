from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db import SessionLocal
import crud, schemas

router = APIRouter(prefix="/sources", tags=["sources"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from fastapi import HTTPException

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