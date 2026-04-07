from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from db import SessionLocal
import crud, schemas

router = APIRouter(prefix="/companies", tags=["companies"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=schemas.CompanyOut)
def create(company: schemas.CompanyCreate, db: Session = Depends(get_db)):
    return crud.create_company(db, company)

@router.get("/", response_model=list[schemas.CompanyOut])
def list_companies(db: Session = Depends(get_db)):
    return crud.get_companies(db)

@router.put("/{company_id}", response_model=schemas.CompanyOut)
def update(company_id: int, company: schemas.CompanyCreate, db: Session = Depends(get_db)):
    return crud.update_company(db, company_id, company)

@router.delete("/{company_id}")
def delete(company_id: int, db: Session = Depends(get_db)):
    return crud.delete_company(db, company_id)