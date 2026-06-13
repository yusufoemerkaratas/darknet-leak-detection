from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.orm import joinedload

from db import SessionLocal
from models import Alert, AnalysisResult, Company, LeakRecord

router = APIRouter(prefix="/findings", tags=["findings"])
alert_router = APIRouter(tags=["alerts"])
stats_router = APIRouter(tags=["stats"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _serialize_alert(alert: Alert) -> dict:
    return {
        "id": alert.id,
        "leak_record_id": alert.leak_record_id,
        "company_id": alert.company_id,
        "finding_title": alert.leak_record.title if alert.leak_record else None,
        "severity": alert.severity,
        "company": alert.company.name if alert.company else None,
        "is_reviewed": alert.is_reviewed,
        "created_at": alert.created_at,
    }


def _serialize_analysis_result(result: AnalysisResult | None) -> dict | None:
    if result is None:
        return None

    return {
        "id": result.id,
        "leak_record_id": result.leak_record_id,
        "detected_patterns": result.detected_patterns,
        "matched_companies": result.matched_companies,
        "terminology_hits": result.terminology_hits,
        "score_contributors": result.score_contributors,
        "classification_rule": result.classification_rule,
        "created_at": result.created_at,
    }


def _query_alerts(
    db: Session,
    severity: str | None,
    company_id: int | None,
    is_reviewed: bool | None,
    date_from: datetime | None,
    date_to: datetime | None,
    page: int,
    size: int,
) -> dict:
    query = db.query(Alert).options(
        joinedload(Alert.leak_record),
        joinedload(Alert.company),
    )

    if severity:
        query = query.filter(func.lower(Alert.severity) == severity.lower())

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

    return {
        "page": page,
        "size": size,
        "total": total,
        "items": [_serialize_alert(alert) for alert in alerts],
    }


def _findings_by_severity(db: Session) -> dict:
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


def _stats_overview(db: Session) -> dict:
    total_findings = db.query(func.count(LeakRecord.id)).scalar() or 0
    total_alerts = db.query(func.count(Alert.id)).scalar() or 0
    reviewed_findings = (
        db.query(func.count(LeakRecord.id))
        .filter(LeakRecord.is_reviewed.is_(True))
        .scalar()
        or 0
    )
    false_positive_findings = (
        db.query(func.count(LeakRecord.id))
        .filter(LeakRecord.is_false_positive.is_(True))
        .scalar()
        or 0
    )
    monitored_companies = db.query(func.count(Company.id)).scalar() or 0
    latest_finding_at = db.query(func.max(LeakRecord.collected_at)).scalar()
    latest_alert_at = db.query(func.max(Alert.created_at)).scalar()

    return {
        "total_findings": total_findings,
        "total_alerts": total_alerts,
        "critical_alerts": (
            db.query(func.count(Alert.id))
            .filter(func.lower(Alert.severity).in_(["critical", "high"]))
            .scalar()
            or 0
        ),
        "open_alerts": (
            db.query(func.count(Alert.id))
            .filter(Alert.is_reviewed.is_(False))
            .scalar()
            or 0
        ),
        "reviewed_findings": reviewed_findings,
        "false_positive_findings": false_positive_findings,
        "monitored_companies": monitored_companies,
        "latest_finding_at": latest_finding_at,
        "latest_alert_at": latest_alert_at,
    }


def _findings_by_day(db: Session, days: int) -> list[dict]:
    start_at = datetime.now(timezone.utc) - timedelta(days=days)

    rows = (
        db.query(
            func.date(LeakRecord.collected_at).label("date"),
            func.count(LeakRecord.id).label("findings"),
        )
        .filter(LeakRecord.collected_at >= start_at)
        .group_by(func.date(LeakRecord.collected_at))
        .order_by(func.date(LeakRecord.collected_at).asc())
        .all()
    )

    return [
        {
            "date": str(row.date),
            "findings": row.findings,
        }
        for row in rows
    ]


def _alerts_by_severity(db: Session) -> dict:
    rows = (
        db.query(Alert.severity, func.count(Alert.id))
        .group_by(Alert.severity)
        .all()
    )

    return {
        (severity or "unknown"): count
        for severity, count in rows
    }


@router.get("")
def list_findings(
    company_id: int | None = None,
    classification: str | None = None,
    severity: str | None = None,
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

    query = db.query(LeakRecord).options(joinedload(LeakRecord.company))

    if company_id:
        query = query.filter(LeakRecord.company_id == company_id)

    if classification:
        query = query.filter(
            LeakRecord.classification == classification
        )

    if severity:
        query = query.filter(func.lower(LeakRecord.severity) == severity.lower())

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

        result.append({
            "id": finding.id,
            "title": finding.title,
            "company_id": finding.company_id,
            "company": finding.company.name if finding.company else None,
            "classification": finding.classification,
            "severity": finding.severity,
            "risk_score": finding.risk_score,
            "is_reviewed": finding.is_reviewed,
            "is_false_positive": finding.is_false_positive,
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
    return _query_alerts(
        db=db,
        severity=severity,
        company_id=company_id,
        is_reviewed=is_reviewed,
        date_from=date_from,
        date_to=date_to,
        page=page,
        size=size,
    )


@alert_router.get("/alerts")
def list_alerts_root(
    severity: str | None = None,
    company_id: int | None = None,
    is_reviewed: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return _query_alerts(
        db=db,
        severity=severity,
        company_id=company_id,
        is_reviewed=is_reviewed,
        date_from=date_from,
        date_to=date_to,
        page=page,
        size=size,
    )


@stats_router.get("/stats/overview")
def stats_overview(
    db: Session = Depends(get_db),
):
    return _stats_overview(db)


@stats_router.get("/stats/findings-by-day")
def findings_by_day(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    return _findings_by_day(db, days)


@stats_router.get("/stats/alerts-by-severity")
def alerts_by_severity(
    db: Session = Depends(get_db),
):
    return _alerts_by_severity(db)


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
    "analysis_result": _serialize_analysis_result(finding.analysis_result),
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
    return _findings_by_severity(db)


@stats_router.get("/stats/findings-by-severity")
def findings_by_severity_root(
    db: Session = Depends(get_db),
):
    return _findings_by_severity(db)
