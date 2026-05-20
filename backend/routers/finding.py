from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from db import SessionLocal
from models import Alert, Company, LeakRecord

router = APIRouter(prefix="/findings", tags=["findings"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
def list_findings(
    company_id: int | None = None,
    classification: str | None = None,
    min_score: int | None = None,
    is_reviewed: bool | None = None,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
):

    query = db.query(LeakRecord)

    if company_id:
        query = query.filter(LeakRecord.company_id == company_id)

    if classification:
        query = query.filter(
            LeakRecord.classification == classification
        )

    if min_score is not None:
        query = query.filter(
            LeakRecord.risk_score >= min_score
        )

    if is_reviewed is not None:
        query = query.filter(
            LeakRecord.is_reviewed == is_reviewed
        )

    total = query.count()

    findings = (
        query.order_by(LeakRecord.collected_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    result = []

    for finding in findings:

        company = (
            db.query(Company)
            .filter(Company.id == finding.company_id)
            .first()
        )

        result.append({
            "id": finding.id,
            "title": finding.title,
            "company": company.name if company else None,
            "classification": finding.classification,
            "risk_score": finding.risk_score,
            "created_at": finding.collected_at,
        })

    return {
        "page": page,
        "size": size,
        "total": total,
        "items": result,
    }


@router.get("/alerts")
def list_alerts(
    severity: str | None = None,
    company_id: int | None = None,
    is_reviewed: bool | None = None,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
):

    query = db.query(Alert)

    if severity:
        query = query.filter(Alert.severity == severity)

    if company_id:
        query = query.filter(Alert.company_id == company_id)

    if is_reviewed is not None:
        query = query.filter(Alert.is_reviewed == is_reviewed)

    total = query.count()

    alerts = (
        query.order_by(Alert.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    result = []

    for alert in alerts:

        finding = (
            db.query(LeakRecord)
            .filter(LeakRecord.id == alert.leak_record_id)
            .first()
        )

        company = (
            db.query(Company)
            .filter(Company.id == alert.company_id)
            .first()
        )

        result.append({
            "id": alert.id,
            "finding_title": finding.title if finding else None,
            "severity": alert.severity,
            "company": company.name if company else None,
            "created_at": alert.created_at,
        })

    return {
        "page": page,
        "size": size,
        "total": total,
        "items": result,
    }