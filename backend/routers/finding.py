from datetime import datetime

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
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = Query(default="timestamp", pattern="^(score|timestamp)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
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

    if date_from is not None:
        query = query.filter(LeakRecord.collected_at >= date_from)

    if date_to is not None:
        query = query.filter(LeakRecord.collected_at <= date_to)

    total = query.count()

    sort_column = LeakRecord.risk_score if sort_by == "score" else LeakRecord.collected_at
    order = sort_column.asc() if sort_order == "asc" else sort_column.desc()

    findings = (
        query.order_by(order)
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
    date_from: datetime | None = None,
    date_to: datetime | None = None,
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

    if date_from is not None:
        query = query.filter(Alert.created_at >= date_from)

    if date_to is not None:
        query = query.filter(Alert.created_at <= date_to)

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

@router.get("/{finding_id}")
def get_finding_detail(
    finding_id: int,
    db: Session = Depends(get_db),
):
    finding = (
        db.query(LeakRecord)
        .filter(LeakRecord.id == finding_id)
        .first()
    )

    if not finding:
        return {"error": "Finding not found"}

    company = (
        db.query(Company)
        .filter(Company.id == finding.company_id)
        .first()
    )

    return {
    "id": finding.id,
    "title": finding.title,
    "company": finding.company.name if finding.company else "Unknown",
    "classification": finding.classification,
    "risk_score": finding.risk_score,
    "severity": finding.severity,
    "created_at": finding.collected_at,
    "analysis_result": finding.analysis_result,
    "is_reviewed": finding.is_reviewed,
    "is_false_positive": finding.is_false_positive,
    "review_notes": finding.review_notes
    }


@router.patch("/{finding_id}/review")
def mark_finding_reviewed(
    finding_id: int,
    review_notes: str | None = None,
    db: Session = Depends(get_db),
):
    finding = (
        db.query(LeakRecord)
        .filter(LeakRecord.id == finding_id)
        .first()
    )

    if not finding:
        return {"error": "Finding not found"}

    finding.is_reviewed = True
    finding.is_analyzed = True

    if review_notes:
        finding.review_notes = review_notes

    db.commit()
    db.refresh(finding)

    return {
        "id": finding.id,
        "is_reviewed": True,
        "review_notes": review_notes,
    }


@router.patch("/{finding_id}/false-positive")
def mark_false_positive(
    finding_id: int,
    review_notes: str,
    db: Session = Depends(get_db),
):
    finding = (
        db.query(LeakRecord)
        .filter(LeakRecord.id == finding_id)
        .first()
    )

    if not finding:
        return {"error": "Finding not found"}

    finding.is_false_positive = True
    finding.is_reviewed = True
    finding.is_analyzed = True
    finding.review_notes = review_notes

    db.commit()
    db.refresh(finding)

    return {
        "id": finding.id,
        "is_false_positive": True,
        "review_notes": review_notes,
    }


@router.get("/stats/findings-by-severity")
def findings_by_severity(
    db: Session = Depends(get_db),
):
    critical = (
        db.query(LeakRecord)
        .filter(LeakRecord.risk_score >= 90)
        .count()
    )

    medium = (
        db.query(LeakRecord)
        .filter(
            LeakRecord.risk_score >= 75,
            LeakRecord.risk_score <= 89,
        )
        .count()
    )

    low = (
        db.query(LeakRecord)
        .filter(
            LeakRecord.risk_score >= 60,
            LeakRecord.risk_score <= 74,
        )
        .count()
    )

    return {
        "critical": critical,
        "medium": medium,
        "low": low,
    }
