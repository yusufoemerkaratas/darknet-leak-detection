from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from models import Alert, AnalysisResult, LeakRecord


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

    # Same content_hash within 7 days
    same_hash = (
        db.query(LeakRecord)
        .filter(
            LeakRecord.id != finding.id,
            LeakRecord.content_hash == finding.content_hash,
            LeakRecord.collected_at >= seven_days_ago,
        )
        .first()
    )
    if same_hash is not None:
        return True

    # Same company + overlapping detected_patterns within 7 days (related variant)
    if finding.analysis_result and finding.analysis_result.detected_patterns:
        finding_patterns = set(finding.analysis_result.detected_patterns.keys())

        recent_same_company = (
            db.query(LeakRecord)
            .join(AnalysisResult, AnalysisResult.leak_record_id == LeakRecord.id)
            .filter(
                LeakRecord.id != finding.id,
                LeakRecord.company_id == finding.company_id,
                LeakRecord.collected_at >= seven_days_ago,
            )
            .all()
        )

        for other in recent_same_company:
            if other.analysis_result and other.analysis_result.detected_patterns:
                other_patterns = set(other.analysis_result.detected_patterns.keys())
                if finding_patterns & other_patterns:
                    return True

    return False


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
