from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, joinedload

from db import get_db
from models import Company, LeakRecord, Source
from schemas import (
    DashboardCompanyPressureOut,
    DashboardDetectionEngineOut,
    DashboardFeedItemOut,
    DashboardFindingOut,
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


def _normalize_severity(value: Optional[str]) -> str:
    if not value:
        return "Info"
    lowered = value.lower()
    return lowered.capitalize() if lowered != "info" else "Info"


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
    severity = (record.severity or "").lower()
    if record.is_analyzed:
        return "Reviewed"
    if severity in {"critical", "high"}:
        return "New"
    return "Reviewing"


def _compute_risk_score(record: LeakRecord) -> int:
    severity = (record.severity or "info").lower()
    base = SEVERITY_BASE_SCORES.get(severity, SEVERITY_BASE_SCORES["info"])
    email_boost = min((record.email_count or 0) / 150, 7)
    size_boost = min(float(record.estimated_size_mb or Decimal("0")), 6)
    link_boost = min(len(record.detected_links or []), 4)
    review_offset = -4 if record.is_analyzed else 0

    score = int(round(base + email_boost + size_boost + link_boost + review_offset))
    return max(1, min(100, score))


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


def _empty_dashboard_overview() -> DashboardOverviewOut:
    now = datetime.now(timezone.utc)
    fake_findings = [
        DashboardFindingOut(
            id=1,
            company="TechNova GmbH",
            type="Credential Leak",
            severity="Critical",
            risk_score=92,
            status="New",
            detected_at=(now - timedelta(minutes=6)).strftime("%Y-%m-%d %H:%M"),
            source="Paste Site",
            affected="Affected: 312 emails",
        ),
        DashboardFindingOut(
            id=2,
            company="CloudBridge SE",
            type="Password Dump",
            severity="High",
            risk_score=84,
            status="Reviewing",
            detected_at=(now - timedelta(minutes=22)).strftime("%Y-%m-%d %H:%M"),
            source="Leak Database",
            affected="Estimated size: 1.80 MB",
        ),
        DashboardFindingOut(
            id=3,
            company="DataStream Corp",
            type="Email Exposure",
            severity="Medium",
            risk_score=67,
            status="Reviewing",
            detected_at=(now - timedelta(hours=1, minutes=12)).strftime("%Y-%m-%d %H:%M"),
            source="Dark Web Forum",
            affected="Affected: 128 emails",
        ),
        DashboardFindingOut(
            id=4,
            company="SecureNet Ltd",
            type="Database Leak",
            severity="Critical",
            risk_score=95,
            status="New",
            detected_at=(now - timedelta(hours=3, minutes=8)).strftime("%Y-%m-%d %H:%M"),
            source="Breach Archive",
            affected="Estimated size: 5.30 MB",
        ),
        DashboardFindingOut(
            id=5,
            company="Alpha Solutions",
            type="API Key Exposure",
            severity="Low",
            risk_score=33,
            status="Reviewed",
            detected_at=(now - timedelta(hours=6, minutes=17)).strftime("%Y-%m-%d %H:%M"),
            source="Git Mirror",
            affected="Links detected: 2",
        ),
        DashboardFindingOut(
            id=6,
            company="NordStack Labs",
            type="Archive Exposure",
            severity="High",
            risk_score=79,
            status="New",
            detected_at=(now - timedelta(hours=9, minutes=45)).strftime("%Y-%m-%d %H:%M"),
            source="Forum Thread",
            affected="Estimated size: 2.40 MB",
        ),
    ]

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
            critical_alerts=3,
            reviewed_findings=1,
            monitored_companies=6,
            latest_collection="Preview mode",
        ),
        findings=fake_findings,
        critical_alerts=sorted(
            [finding for finding in fake_findings if finding.severity in {"Critical", "High"}],
            key=lambda finding: finding.risk_score,
            reverse=True,
        )[:3],
        live_feed=fake_live_feed,
        timeline=[
            DashboardTimelinePointOut(
                date=(now.date() - timedelta(days=offset)).strftime("%b %d").replace(" 0", " "),
                findings=value,
            )
            for offset, value in zip(range(6, -1, -1), [1, 2, 1, 3, 2, 4, 3])
        ],
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


@router.get("/overview", response_model=DashboardOverviewOut)
def dashboard_overview(db: Session = Depends(get_db)):
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
            .filter(LeakRecord.is_analyzed.is_(True))
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

        severity_counter = Counter(finding.severity for finding in serialized_findings)
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

        company_aggregate: dict[str, dict[str, int | str]] = defaultdict(
            lambda: {"count": 0, "score": 0, "severity": "Info"}
        )
        for finding in serialized_findings:
            entry = company_aggregate[finding.company]
            entry["count"] += 1
            if finding.risk_score > entry["score"]:
                entry["score"] = finding.risk_score
                entry["severity"] = finding.severity

        top_companies = sorted(
            [
                DashboardCompanyPressureOut(
                    name=name,
                    count=int(values["count"]),
                    score=int(values["score"]),
                    severity=str(values["severity"]),
                )
                for name, values in company_aggregate.items()
            ],
            key=lambda item: (item.count, item.score),
            reverse=True,
        )[:5]

        today = datetime.now(timezone.utc).date()
        timeline_buckets = {today - timedelta(days=offset): 0 for offset in range(6, -1, -1)}
        for record in records:
            collected_day = (record.collected_at or record.published_at).astimezone(timezone.utc).date()
            if collected_day in timeline_buckets:
                timeline_buckets[collected_day] += 1

        timeline = [
            DashboardTimelinePointOut(
                date=day.strftime("%b %d").replace(" 0", " "),
                findings=count,
            )
            for day, count in timeline_buckets.items()
        ]

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
            generated_at=datetime.now(timezone.utc).isoformat(),
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
        return _empty_dashboard_overview()
