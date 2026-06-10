from collections import Counter
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, joinedload

from db import get_db
from models import AnalysisResult, Company, LeakRecord, Source
from schemas import (
    DashboardFindingDetailOut,
    DashboardCompanyPressureOut,
    DashboardDetectionEngineOut,
    DashboardFeedItemOut,
    DashboardFindingOut,
    DashboardFindingStatusUpdateIn,
    DashboardOverviewOut,
    DashboardSeverityLegendOut,
    DashboardSeverityOut,
    DashboardSourceMetricOut,
    DashboardStatusCardOut,
    DashboardStatusRowOut,
    DashboardSummaryOut,
    DashboardTimelinePointOut,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

SEVERITY_BASE_SCORES = {
    "critical": 90,
    "high": 76,
    "medium": 58,
    "low": 34,
    "info": 12,
}

SEVERITY_TONES = {
    "critical": "bg-rose-400",
    "high": "bg-orange-400",
    "medium": "bg-amber-400",
    "low": "bg-emerald-400",
    "info": "bg-sky-400",
}

SEVERITY_LEGEND = [
    DashboardSeverityLegendOut(label="Critical", range="90 - 100"),
    DashboardSeverityLegendOut(label="High", range="70 - 89"),
    DashboardSeverityLegendOut(label="Medium", range="40 - 69"),
    DashboardSeverityLegendOut(label="Low", range="1 - 39"),
    DashboardSeverityLegendOut(label="Info", range="Informational"),
]

TYPE_KEYWORDS = {
    "Credential Leak": ("credential", "password", "login"),
    "Email Exposure": ("email", "mailbox"),
    "Database Leak": ("database", "dump", "records"),
    "API Key Exposure": ("api key", "token", "secret"),
    "Archive Exposure": ("archive", "backup", "export"),
}

REVIEW_STATUS_OPTIONS = {
    "Not Reviewed",
    "Reviewed",
    "False Positive",
    "Escalated",
}

PREVIEW_FINDINGS = [
    {
        "id": 1,
        "company": "TechNova GmbH",
        "type": "Credential Leak",
        "severity": "Critical",
        "risk_score": 92,
        "status": "Not Reviewed",
        "detected_at_offset": {"minutes": 6},
        "source": "Paste Site",
        "affected": "Affected: 312 emails",
        "title": "Credential leak detected in indexed paste",
        "summary": "Credential pairs matching the monitored company domain were detected in a newly indexed paste source.",
        "recommended_action": "Invalidate exposed credentials, force password resets, and review login telemetry for suspicious access attempts.",
        "raw_url": "https://preview.leakguard.local/paste/technova-credential-leak",
        "evidence": [
            "Monitored domain match detected",
            "Multiple credential-like patterns identified",
            "Public paste source indexed in preview mode",
        ],
    },
    {
        "id": 2,
        "company": "CloudBridge SE",
        "type": "Password Dump",
        "severity": "High",
        "risk_score": 84,
        "status": "Not Reviewed",
        "detected_at_offset": {"minutes": 22},
        "source": "Leak Database",
        "affected": "Estimated size: 1.80 MB",
        "title": "Password dump added to leak database",
        "summary": "A credential archive associated with the monitored company naming pattern was added to a leak aggregation database.",
        "recommended_action": "Validate whether the dump contains active credentials, rotate impacted accounts, and correlate usernames with internal identities.",
        "raw_url": "https://preview.leakguard.local/database/cloudbridge-password-dump",
        "evidence": [
            "Archive metadata references company aliases",
            "Credential dump title indicates password content",
            "Leak database source has repeated signal history",
        ],
    },
    {
        "id": 3,
        "company": "DataStream Corp",
        "type": "Email Exposure",
        "severity": "Medium",
        "risk_score": 67,
        "status": "Not Reviewed",
        "detected_at_offset": {"hours": 1, "minutes": 12},
        "source": "Dark Web Forum",
        "affected": "Affected: 128 emails",
        "title": "Email address set exposed in forum thread",
        "summary": "A forum post contains a batch of addresses tied to the monitored company and likely originated from a prior export.",
        "recommended_action": "Notify the affected business owner, monitor phishing activity, and cross-check the exposed addresses against internal user directories.",
        "raw_url": "https://preview.leakguard.local/forum/datastream-email-exposure",
        "evidence": [
            "Company domain found in leaked address list",
            "Forum thread references internal mailing segments",
            "Sample records show repeated employee aliases",
        ],
    },
    {
        "id": 4,
        "company": "SecureNet Ltd",
        "type": "Database Leak",
        "severity": "Critical",
        "risk_score": 95,
        "status": "Not Reviewed",
        "detected_at_offset": {"hours": 3, "minutes": 8},
        "source": "Breach Archive",
        "affected": "Estimated size: 5.30 MB",
        "title": "Structured database archive published",
        "summary": "A structured data archive with company-specific markers was published in a breach archive and scored as critical.",
        "recommended_action": "Escalate to incident response, preserve evidence, and confirm whether database records contain active customer or employee data.",
        "raw_url": "https://preview.leakguard.local/archive/securenet-database-leak",
        "evidence": [
            "Archive filename contains company identifier",
            "Row count estimate indicates structured export",
            "Source reputation marked as high-risk breach archive",
        ],
    },
    {
        "id": 5,
        "company": "Alpha Solutions",
        "type": "API Key Exposure",
        "severity": "Low",
        "risk_score": 33,
        "status": "Reviewed",
        "detected_at_offset": {"hours": 6, "minutes": 17},
        "source": "Git Mirror",
        "affected": "Links detected: 2",
        "title": "API token pattern detected in mirrored repository",
        "summary": "A mirrored code repository contains a token-shaped string associated with a monitored project namespace.",
        "recommended_action": "Validate whether the token is still active, rotate if necessary, and add repository secret scanning safeguards.",
        "raw_url": "https://preview.leakguard.local/git/alpha-api-key",
        "evidence": [
            "Token-like pattern matched secret detector",
            "Repository mirror references monitored project path",
            "Two related links were collected for analyst review",
        ],
    },
    {
        "id": 6,
        "company": "NordStack Labs",
        "type": "Archive Exposure",
        "severity": "High",
        "risk_score": 79,
        "status": "Not Reviewed",
        "detected_at_offset": {"hours": 9, "minutes": 45},
        "source": "Forum Thread",
        "affected": "Estimated size: 2.40 MB",
        "title": "Archive exposure referenced in discussion thread",
        "summary": "A discussion thread links to an exposed archive believed to contain internal exports tied to the monitored company.",
        "recommended_action": "Review the linked archive, assess data sensitivity, and request takedown or containment actions where possible.",
        "raw_url": "https://preview.leakguard.local/forum/nordstack-archive-exposure",
        "evidence": [
            "Thread title includes company alias",
            "Linked archive size aligns with exported workspace data",
            "Follow-up replies confirm archive accessibility",
        ],
    },
]


def _format_compact_date(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")


def _format_short_time(value: Optional[datetime]) -> str:
    if value is None:
        return "--:--"
    return value.astimezone(timezone.utc).strftime("%H:%M:%S")


def _format_day_label(value: datetime) -> str:
    return value.strftime("%b %d").replace(" 0", " ")


def _format_month_label(value: datetime) -> str:
    return value.strftime("%b %Y")


def _get_detected_patterns(record: LeakRecord) -> dict:
    if (
        record.analysis_result
        and isinstance(record.analysis_result.detected_patterns, dict)
    ):
        return dict(record.analysis_result.detected_patterns)
    return {}


def _get_review_status(record: LeakRecord) -> Optional[str]:
    review_status = _get_detected_patterns(record).get("review_status")
    if review_status in REVIEW_STATUS_OPTIONS:
        return review_status
    return None


def _normalize_severity(value: Optional[str]) -> str:
    if not value:
        return "Info"
    lowered = value.lower()
    return lowered.capitalize() if lowered != "info" else "Info"


def _severity_from_score(score: int) -> str:
    if score >= 90:
        return "Critical"
    if score >= 70:
        return "High"
    if score >= 40:
        return "Medium"
    if score >= 1:
        return "Low"
    return "Info"


def _infer_finding_type(record: LeakRecord) -> str:
    title = (record.title or "").lower()
    raw_text = (record.raw_content_text or "").lower()
    haystack = f"{title} {raw_text}"

    if record.analysis_result and record.analysis_result.detected_patterns:
        patterns = record.analysis_result.detected_patterns
        if isinstance(patterns, dict):
            for key in patterns.keys():
                normalized = str(key).replace("_", " ").strip().title()
                if normalized:
                    return normalized

    for label, keywords in TYPE_KEYWORDS.items():
        if any(keyword in haystack for keyword in keywords):
            return label

    return record.title or "Leak Detection"


def _format_affected(record: LeakRecord) -> str:
    if record.email_count:
        return f"Affected: {record.email_count:,} emails"
    if record.estimated_size_mb:
        return f"Estimated size: {float(record.estimated_size_mb):.2f} MB"
    if record.detected_links:
        return f"Links detected: {len(record.detected_links)}"
    return "Affected: content under review"


def _compute_status(record: LeakRecord) -> str:
    review_status = _get_review_status(record)
    if review_status:
        return review_status
    return "Not Reviewed"


def _compute_risk_score(record: LeakRecord) -> int:
    severity = (record.severity or "info").lower()
    base = SEVERITY_BASE_SCORES.get(severity, SEVERITY_BASE_SCORES["info"])
    email_boost = min((record.email_count or 0) / 150, 7)
    size_boost = min(float(record.estimated_size_mb or Decimal("0")), 6)
    link_boost = min(len(record.detected_links or []), 4)
    review_offset = -4 if record.is_analyzed else 0

    score = int(round(base + email_boost + size_boost + link_boost + review_offset))
    return max(1, min(100, score))


def _build_threat_explanation(
    finding_type: str,
    source: str,
    affected: str,
    severity: str,
) -> str:
    return (
        f"The monitoring pipeline classified this event as {finding_type.lower()} with {severity.lower()} severity. "
        f"Signals collected from {source} and the observed scope ({affected.lower()}) increased the analyst priority for this finding."
    )


def _build_recommended_action(finding_type: str, severity: str) -> str:
    lowered_type = finding_type.lower()
    lowered_severity = severity.lower()

    if "credential" in lowered_type or "password" in lowered_type:
        return "Force credential rotation, review authentication logs, and notify the impacted owner team immediately."
    if "api" in lowered_type or "token" in lowered_type:
        return "Rotate exposed keys, audit downstream service usage, and enable stricter repository secret scanning."
    if "database" in lowered_type:
        return "Escalate to incident response, validate the archive contents, and assess regulatory notification requirements."
    if "email" in lowered_type:
        return "Warn potentially affected users and monitor for phishing or password-spraying activity."
    if lowered_severity in {"critical", "high"}:
        return "Prioritize analyst review, preserve the evidence trail, and coordinate containment with the security team."
    return "Review the evidence, confirm the exposure scope, and document the remediation plan."


def _build_evidence_points(
    finding_type: str,
    source: str,
    affected: str,
    status: str,
) -> list[str]:
    return [
        f"Source observed: {source}",
        affected,
        f"Current analyst status: {status}",
        f"Finding classified as {finding_type}",
    ]


def _serialize_finding(record: LeakRecord) -> DashboardFindingOut:
    detected_at = record.collected_at or record.published_at

    return DashboardFindingOut(
        id=record.id,
        company=record.company.name if record.company else "Unknown Company",
        type=_infer_finding_type(record),
        severity=_normalize_severity(record.severity),
        risk_score=_compute_risk_score(record),
        status=_compute_status(record),
        detected_at=detected_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M"),
        source=record.source.name if record.source else "Unknown Source",
        affected=_format_affected(record),
    )


def _serialize_finding_detail(record: LeakRecord) -> DashboardFindingDetailOut:
    finding = _serialize_finding(record)
    title = record.title or finding.type
    summary = _build_threat_explanation(
        finding.type,
        finding.source,
        finding.affected,
        finding.severity,
    )

    return DashboardFindingDetailOut(
        **finding.model_dump(),
        title=title,
        summary=summary,
        recommended_action=_build_recommended_action(finding.type, finding.severity),
        raw_url=record.raw_url,
        published_at=_format_compact_date(record.published_at),
        evidence=_build_evidence_points(
            finding.type,
            finding.source,
            finding.affected,
            finding.status,
        ),
    )


def _preview_detected_at(now: datetime, preview_item: dict) -> datetime:
    return now - timedelta(**preview_item["detected_at_offset"])


def _serialize_preview_finding(
    preview_item: dict,
    now: Optional[datetime] = None,
) -> DashboardFindingOut:
    reference_now = now or datetime.now(timezone.utc)
    detected_at = _preview_detected_at(reference_now, preview_item)
    return DashboardFindingOut(
        id=preview_item["id"],
        company=preview_item["company"],
        type=preview_item["type"],
        severity=preview_item["severity"],
        risk_score=preview_item["risk_score"],
        status=preview_item["status"],
        detected_at=detected_at.strftime("%Y-%m-%d %H:%M"),
        source=preview_item["source"],
        affected=preview_item["affected"],
    )


def _serialize_preview_detail(
    preview_item: dict,
    now: Optional[datetime] = None,
) -> DashboardFindingDetailOut:
    finding = _serialize_preview_finding(preview_item, now=now)
    detected_at = _preview_detected_at(now or datetime.now(timezone.utc), preview_item)
    return DashboardFindingDetailOut(
        **finding.model_dump(),
        title=preview_item["title"],
        summary=preview_item["summary"],
        recommended_action=preview_item["recommended_action"],
        raw_url=preview_item["raw_url"],
        published_at=_format_compact_date(detected_at),
        evidence=preview_item["evidence"],
    )


def _build_feed_title(finding_type: str) -> str:
    lowered = finding_type.lower()
    if "credential" in lowered:
        return "New credential leak detected"
    if "password" in lowered:
        return "Password dump added to database"
    if "email" in lowered:
        return "Email exposure detected"
    if "api" in lowered or "token" in lowered:
        return "API key exposure detected"
    if "database" in lowered:
        return "Database leak classified"
    return "New leak signal ingested"


def _shift_months(value: datetime, offset: int) -> datetime:
    month_index = value.month - 1 + offset
    year = value.year + month_index // 12
    month = month_index % 12 + 1
    return value.replace(year=year, month=month, day=1)


def _build_preview_timeline(
    now: datetime,
    timeline_range: Literal["7d", "30d", "365d"],
) -> list[DashboardTimelinePointOut]:
    if timeline_range == "365d":
        base = now.replace(day=1)
        labels = [_shift_months(base, offset) for offset in range(-11, 1)]
        values = [1, 1, 2, 3, 2, 4, 3, 5, 4, 6, 5, 3]
        return [
            DashboardTimelinePointOut(date=_format_month_label(label), findings=value)
            for label, value in zip(labels, values)
        ]

    total_days = 30 if timeline_range == "30d" else 7
    sample_pattern = [1, 2, 1, 3, 2, 4, 3]
    values = [sample_pattern[index % len(sample_pattern)] for index in range(total_days)]
    return [
        DashboardTimelinePointOut(
            date=_format_day_label(
                datetime.combine(
                    now.date() - timedelta(days=total_days - index - 1),
                    datetime.min.time(),
                    tzinfo=timezone.utc,
                )
            ),
            findings=values[index],
        )
        for index in range(total_days)
    ]


def _build_timeline(
    timestamps: list[datetime],
    timeline_range: Literal["7d", "30d", "365d"],
    reference_now: Optional[datetime] = None,
) -> list[DashboardTimelinePointOut]:
    now = reference_now or datetime.now(timezone.utc)

    if timeline_range == "365d":
        current_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        buckets = {
            (month.year, month.month): 0
            for month in (_shift_months(current_month, offset) for offset in range(-11, 1))
        }

        for timestamp in timestamps:
            normalized = timestamp.astimezone(timezone.utc)
            key = (normalized.year, normalized.month)
            if key in buckets:
                buckets[key] += 1

        return [
            DashboardTimelinePointOut(
                date=_format_month_label(
                    datetime(year=year, month=month, day=1, tzinfo=timezone.utc)
                ),
                findings=count,
            )
            for (year, month), count in buckets.items()
        ]

    total_days = 30 if timeline_range == "30d" else 7
    today = now.date()
    buckets = {today - timedelta(days=offset): 0 for offset in range(total_days - 1, -1, -1)}

    for timestamp in timestamps:
        collected_day = timestamp.astimezone(timezone.utc).date()
        if collected_day in buckets:
            buckets[collected_day] += 1

    return [
        DashboardTimelinePointOut(
            date=_format_day_label(
                datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
            ),
            findings=count,
        )
        for day, count in buckets.items()
    ]


def _empty_dashboard_overview(
    timeline_range: Literal["7d", "30d", "365d"] = "7d",
) -> DashboardOverviewOut:
    now = datetime.now(timezone.utc)
    fake_findings = [_serialize_preview_finding(item, now=now) for item in PREVIEW_FINDINGS]
    reviewed_count = sum(1 for item in PREVIEW_FINDINGS if item["status"] == "Reviewed")
    critical_alerts_count = sum(
        1 for item in PREVIEW_FINDINGS if item["severity"] in {"Critical", "High"}
    )

    fake_live_feed = [
        DashboardFeedItemOut(
            id=finding.id,
            tone=SEVERITY_TONES.get(finding.severity.lower(), "bg-sky-400"),
            title=_build_feed_title(finding.type),
            company=finding.company,
            time=(now - timedelta(minutes=index * 4 + 2)).strftime("%H:%M:%S"),
        )
        for index, finding in enumerate(fake_findings[:4])
    ]

    return DashboardOverviewOut(
        generated_at=now.isoformat(),
        summary=DashboardSummaryOut(
            total_findings=len(fake_findings),
            critical_alerts=critical_alerts_count,
            reviewed_findings=reviewed_count,
            monitored_companies=len({item["company"] for item in PREVIEW_FINDINGS}),
            latest_collection="Preview mode",
        ),
        findings=fake_findings,
        critical_alerts=sorted(
            [finding for finding in fake_findings if finding.severity in {"Critical", "High"}],
            key=lambda finding: finding.risk_score,
            reverse=True,
        )[:3],
        live_feed=fake_live_feed,
        timeline=_build_preview_timeline(now, timeline_range),
        data_sources=[
            DashboardSourceMetricOut(id=1, label="Paste Site", value="124"),
            DashboardSourceMetricOut(id=2, label="Dark Web Forum", value="87"),
            DashboardSourceMetricOut(id=3, label="Leak Database", value="63"),
            DashboardSourceMetricOut(id=4, label="Breach Archive", value="41"),
        ],
        severity_breakdown=[
            DashboardSeverityOut(label="Critical", value=2),
            DashboardSeverityOut(label="High", value=2),
            DashboardSeverityOut(label="Medium", value=1),
            DashboardSeverityOut(label="Low", value=1),
        ],
        severity_legend=SEVERITY_LEGEND,
        top_companies=[
            DashboardCompanyPressureOut(
                name="SecureNet Ltd",
                count=1,
                score=95,
                severity="Critical",
            ),
            DashboardCompanyPressureOut(
                name="TechNova GmbH",
                count=1,
                score=92,
                severity="Critical",
            ),
            DashboardCompanyPressureOut(
                name="CloudBridge SE",
                count=1,
                score=84,
                severity="High",
            ),
            DashboardCompanyPressureOut(
                name="NordStack Labs",
                count=1,
                score=79,
                severity="High",
            ),
            DashboardCompanyPressureOut(
                name="DataStream Corp",
                count=1,
                score=67,
                severity="Medium",
            ),
        ],
        detection_engine=DashboardDetectionEngineOut(
            model_status="Preview",
            success_rate=96.4,
        ),
        sidebar_status_cards=[
            DashboardStatusCardOut(
                id="system-status",
                title="System Status",
                rows=[
                    DashboardStatusRowOut(
                        label="Live Monitoring",
                        value="Preview",
                        tone="text-amber-300",
                    ),
                    DashboardStatusRowOut(
                        label="Health",
                        value="Showing generated sample data",
                    ),
                ],
            ),
            DashboardStatusCardOut(
                id="detection-engine",
                title="Detection Engine",
                rows=[
                    DashboardStatusRowOut(
                        label="AI Model",
                        value="Preview",
                        tone="text-amber-300",
                    ),
                    DashboardStatusRowOut(label="Data Sources", value="4"),
                    DashboardStatusRowOut(label="Success Rate", value="96.4%"),
                    DashboardStatusRowOut(label="Last Scan", value="Preview mode"),
                ],
            ),
        ],
    )


def _get_preview_finding_by_id(finding_id: int) -> Optional[dict]:
    for item in PREVIEW_FINDINGS:
        if item["id"] == finding_id:
            return item
    return None


def _apply_review_status(record: LeakRecord, status: str) -> None:
    patterns = _get_detected_patterns(record)
    patterns["review_status"] = status

    if record.analysis_result:
        record.analysis_result.detected_patterns = patterns
    else:
        record.analysis_result = AnalysisResult(detected_patterns=patterns)

    record.is_reviewed = status != "Not Reviewed"
    record.is_false_positive = status == "False Positive"
    record.is_analyzed = status != "Not Reviewed"


@router.get("/overview", response_model=DashboardOverviewOut)
def dashboard_overview(
    timeline_range: Literal["7d", "30d", "365d"] = Query(default="7d"),
    db: Session = Depends(get_db),
):
    try:
        active_sources = (
            db.query(func.count(Source.id))
            .filter(Source.is_active.is_(True))
            .scalar()
            or 0
        )
        records = (
            db.query(LeakRecord)
            .options(
                joinedload(LeakRecord.company),
                joinedload(LeakRecord.source),
                joinedload(LeakRecord.analysis_result),
            )
            .order_by(LeakRecord.collected_at.desc(), LeakRecord.id.desc())
            .limit(100)
            .all()
        )

        total_findings = db.query(func.count(LeakRecord.id)).scalar() or 0
        reviewed_findings = (
            db.query(func.count(LeakRecord.id))
            .filter(LeakRecord.is_reviewed.is_(True))
            .scalar()
            or 0
        )
        monitored_companies = db.query(func.count(func.distinct(Company.id))).scalar() or 0
        critical_alerts_count = (
            db.query(func.count(LeakRecord.id))
            .filter(func.lower(LeakRecord.severity).in_(["critical", "high"]))
            .scalar()
            or 0
        )
        latest_collection_dt = db.query(func.max(LeakRecord.collected_at)).scalar()

        serialized_findings = [_serialize_finding(record) for record in records]

        critical_alerts = sorted(
            [
                finding
                for finding in serialized_findings
                if finding.severity in {"Critical", "High"}
            ],
            key=lambda finding: finding.risk_score,
            reverse=True,
        )[:3]

        recent_feed = [
            DashboardFeedItemOut(
                id=finding.id,
                tone=SEVERITY_TONES.get(finding.severity.lower(), "bg-sky-400"),
                title=_build_feed_title(finding.type),
                company=finding.company,
                time=_format_short_time(records[index].collected_at if index < len(records) else None),
            )
            for index, finding in enumerate(serialized_findings[:4])
        ]

        severity_rows = (
            db.query(func.lower(LeakRecord.severity).label("severity"), func.count(LeakRecord.id))
            .group_by(func.lower(LeakRecord.severity))
            .all()
        )
        severity_counter = Counter()
        for severity, count in severity_rows:
            severity_counter[_normalize_severity(severity)] = count
        severity_order = ["Critical", "High", "Medium", "Low", "Info"]
        severity_breakdown = [
            DashboardSeverityOut(label=label, value=severity_counter.get(label, 0))
            for label in severity_order
            if severity_counter.get(label, 0) > 0
        ]

        source_rows = (
            db.query(Source.id, Source.name, func.count(LeakRecord.id).label("count"))
            .join(LeakRecord, LeakRecord.source_id == Source.id)
            .group_by(Source.id, Source.name)
            .order_by(func.count(LeakRecord.id).desc(), Source.name.asc())
            .limit(5)
            .all()
        )
        data_sources = [
            DashboardSourceMetricOut(id=row.id, label=row.name, value=f"{row.count:,}")
            for row in source_rows
        ]

        company_rows = (
            db.query(
                Company.name.label("name"),
                func.count(LeakRecord.id).label("count"),
                func.max(LeakRecord.risk_score).label("score"),
            )
            .join(LeakRecord, LeakRecord.company_id == Company.id)
            .group_by(Company.id, Company.name)
            .order_by(func.count(LeakRecord.id).desc(), func.max(LeakRecord.risk_score).desc())
            .limit(5)
            .all()
        )
        top_companies = [
            DashboardCompanyPressureOut(
                name=row.name,
                count=int(row.count or 0),
                score=int(row.score or 0),
                severity=_severity_from_score(int(row.score or 0)),
            )
            for row in company_rows
        ]

        now = datetime.now(timezone.utc)
        timeline_window_days = 365 if timeline_range == "365d" else 30 if timeline_range == "30d" else 7
        timeline_start = now - timedelta(days=timeline_window_days - 1)
        timeline_rows = (
            db.query(LeakRecord.collected_at, LeakRecord.published_at)
            .filter(func.coalesce(LeakRecord.collected_at, LeakRecord.published_at) >= timeline_start)
            .all()
        )
        timeline = _build_timeline(
            [
                (row.collected_at or row.published_at)
                for row in timeline_rows
                if (row.collected_at or row.published_at) is not None
            ],
            timeline_range,
            reference_now=now,
        )

        success_rate = round((reviewed_findings / total_findings) * 100, 1) if total_findings else 0.0
        latest_collection_label = _format_compact_date(latest_collection_dt) or "No scans yet"

        sidebar_status_cards = [
            DashboardStatusCardOut(
                id="system-status",
                title="System Status",
                rows=[
                    DashboardStatusRowOut(
                        label="Live Monitoring",
                        value="Online",
                        tone="text-emerald-300",
                    ),
                    DashboardStatusRowOut(
                        label="Health",
                        value=(
                            "All systems operational"
                            if active_sources > 0
                            else "No active sources configured"
                        ),
                    ),
                ],
            ),
            DashboardStatusCardOut(
                id="detection-engine",
                title="Detection Engine",
                rows=[
                    DashboardStatusRowOut(
                        label="AI Model",
                        value="Active",
                        tone="text-emerald-300",
                    ),
                    DashboardStatusRowOut(
                        label="Data Sources",
                        value=str(active_sources),
                    ),
                    DashboardStatusRowOut(
                        label="Success Rate",
                        value=f"{success_rate:.1f}%",
                    ),
                    DashboardStatusRowOut(
                        label="Last Scan",
                        value=latest_collection_label,
                    ),
                ],
            ),
        ]

        return DashboardOverviewOut(
            generated_at=now.isoformat(),
            summary=DashboardSummaryOut(
                total_findings=total_findings,
                critical_alerts=critical_alerts_count,
                reviewed_findings=reviewed_findings,
                monitored_companies=monitored_companies,
                latest_collection=latest_collection_label,
            ),
            findings=serialized_findings,
            critical_alerts=critical_alerts,
            live_feed=recent_feed,
            timeline=timeline,
            data_sources=data_sources,
            severity_breakdown=severity_breakdown,
            severity_legend=SEVERITY_LEGEND,
            top_companies=top_companies,
            detection_engine=DashboardDetectionEngineOut(
                model_status="Active",
                success_rate=success_rate,
            ),
            sidebar_status_cards=sidebar_status_cards,
        )
    except OperationalError:
        return _empty_dashboard_overview(timeline_range)


@router.get("/findings/{finding_id}", response_model=DashboardFindingDetailOut)
def get_dashboard_finding_detail(finding_id: int, db: Session = Depends(get_db)):
    try:
        record = (
            db.query(LeakRecord)
            .options(
                joinedload(LeakRecord.company),
                joinedload(LeakRecord.source),
                joinedload(LeakRecord.analysis_result),
            )
            .filter(LeakRecord.id == finding_id)
            .first()
        )
        if not record:
            raise HTTPException(status_code=404, detail="Finding not found")
        return _serialize_finding_detail(record)
    except OperationalError:
        preview_item = _get_preview_finding_by_id(finding_id)
        if not preview_item:
            raise HTTPException(status_code=404, detail="Finding not found")
        return _serialize_preview_detail(preview_item)


@router.patch("/findings/{finding_id}/status", response_model=DashboardFindingDetailOut)
def update_dashboard_finding_status(
    finding_id: int,
    payload: DashboardFindingStatusUpdateIn,
    db: Session = Depends(get_db),
):
    if payload.status not in REVIEW_STATUS_OPTIONS:
        raise HTTPException(status_code=400, detail="Unsupported status value")

    try:
        record = (
            db.query(LeakRecord)
            .options(
                joinedload(LeakRecord.company),
                joinedload(LeakRecord.source),
                joinedload(LeakRecord.analysis_result),
            )
            .filter(LeakRecord.id == finding_id)
            .first()
        )
        if not record:
            raise HTTPException(status_code=404, detail="Finding not found")

        _apply_review_status(record, payload.status)
        db.add(record)
        db.commit()
        db.refresh(record)
        return _serialize_finding_detail(record)
    except OperationalError:
        preview_item = _get_preview_finding_by_id(finding_id)
        if not preview_item:
            raise HTTPException(status_code=404, detail="Finding not found")
        preview_item["status"] = payload.status
        return _serialize_preview_detail(preview_item)
