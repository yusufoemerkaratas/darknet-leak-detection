from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from models import Alert, LeakRecord


ALERT_CLASSIFICATIONS = {"suspicious", "high-risk"}


def calculate_severity(score: int) -> str | None:
    if 90 <= score <= 100:
        return "CRITICAL"
    if 75 <= score <= 89:
        return "MEDIUM"
    if 60 <= score <= 74:
        return "LOW"
    return None


def is_duplicate_within_7_days(db: Session, finding: LeakRecord) -> bool:
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)

    existing = (
        db.query(LeakRecord)
        .filter(
            LeakRecord.id != finding.id,
            LeakRecord.content_hash == finding.content_hash,
            LeakRecord.collected_at >= seven_days_ago,
        )
        .first()
    )

    return existing is not None


def should_create_alert(db: Session, finding: LeakRecord) -> bool:
    if finding.classification not in ALERT_CLASSIFICATIONS:
        return False

    if finding.risk_score < 60:
        return False

    if finding.is_false_positive:
        return False

    if is_duplicate_within_7_days(db, finding):
        return False

    return True


def generate_alert(db: Session, finding: LeakRecord) -> Alert | None:
    if not should_create_alert(db, finding):
        return None

    severity = calculate_severity(finding.risk_score)
    if severity is None:
        return None

    alert = Alert(
        leak_record_id=finding.id,
        company_id=finding.company_id,
        severity=severity,
        is_reviewed=False,
    )

    db.add(alert)
    db.commit()
    db.refresh(alert)

    return alert
