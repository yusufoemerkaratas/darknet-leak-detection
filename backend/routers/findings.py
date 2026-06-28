from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from db import get_db
from models import LeakRecord, Source, AnalysisResult

router = APIRouter(prefix="/findings", tags=["findings"])

SEVERITY_TO_SCORE = {"CRITICAL": 92, "MEDIUM": 77, "LOW": 62}
SEVERITY_TO_CLASS = {"CRITICAL": "high-risk", "MEDIUM": "suspicious", "LOW": "low-risk"}


def _row_to_finding(lr, source_name: str):
    score = SEVERITY_TO_SCORE.get(lr.severity, 50)
    cls = SEVERITY_TO_CLASS.get(lr.severity, "low-risk")
    return {
        "id": lr.id,
        "title": lr.title,
        "company": source_name,
        "classification": cls,
        "risk_score": score,
        "created_at": lr.collected_at.isoformat() if lr.collected_at else None,
    }


@router.get("")
@router.get("/")
def list_findings(page: int = 1, size: int = 100, db: Session = Depends(get_db)):
    offset = (page - 1) * size
    total = db.query(func.count(LeakRecord.id)).scalar() or 0

    rows = (
        db.query(LeakRecord, Source.name)
        .join(Source, LeakRecord.source_id == Source.id)
        .order_by(LeakRecord.collected_at.desc())
        .offset(offset)
        .limit(size)
        .all()
    )

    items = [_row_to_finding(lr, name) for lr, name in rows]
    return {"page": page, "size": size, "total": total, "items": items}


@router.get("/{finding_id}")
def get_finding(finding_id: int, db: Session = Depends(get_db)):
    row = (
        db.query(LeakRecord, Source.name)
        .join(Source, LeakRecord.source_id == Source.id)
        .filter(LeakRecord.id == finding_id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="Finding not found")

    lr, source_name = row
    base = _row_to_finding(lr, source_name)

    ar = db.query(AnalysisResult).filter(AnalysisResult.leak_record_id == lr.id).first()
    base.update({
        "severity": lr.severity,
        "is_reviewed": lr.is_analyzed,
        "is_false_positive": False,
        "review_notes": None,
        "analysis_result": {
            "id": ar.id,
            "leak_record_id": ar.leak_record_id,
            "detected_patterns": ar.detected_patterns,
            "matched_companies": [],
            "terminology_hits": [],
            "score_contributors": {},
            "classification_rule": base["classification"],
            "created_at": ar.created_at.isoformat() if ar.created_at else None,
        } if ar else None,
    })
    return base


@router.patch("/{finding_id}/review")
def mark_reviewed(finding_id: int, body: dict = {}, db: Session = Depends(get_db)):
    lr = db.query(LeakRecord).filter(LeakRecord.id == finding_id).first()
    if not lr:
        raise HTTPException(status_code=404, detail="Finding not found")
    lr.is_analyzed = True
    db.commit()
    return {"id": finding_id, "is_reviewed": True}


@router.patch("/{finding_id}/false-positive")
def mark_false_positive(finding_id: int, db: Session = Depends(get_db)):
    lr = db.query(LeakRecord).filter(LeakRecord.id == finding_id).first()
    if not lr:
        raise HTTPException(status_code=404, detail="Finding not found")
    return {"id": finding_id, "is_false_positive": True}
