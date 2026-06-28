from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from db import get_db

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
@router.get("/")
def get_alerts(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT a.id, lr.title AS finding_title, a.severity, c.name AS company, a.created_at
        FROM alerts a
        JOIN leak_records lr ON lr.id = a.leak_record_id
        JOIN companies c ON c.id = a.company_id
        ORDER BY a.created_at DESC
    """)).fetchall()

    items = [
        {
            "id": r.id,
            "finding_title": r.finding_title,
            "severity": r.severity,
            "company": r.company,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]
    return {"page": 1, "size": len(items), "total": len(items), "items": items}
