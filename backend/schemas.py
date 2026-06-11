from datetime import datetime
from typing import Optional, Any


from pydantic import BaseModel

class SourceCreate(BaseModel):
    name: str
    url: str

class SourceOut(BaseModel):
    id: int
    name: str
    url: str
    is_active: bool

    class Config:
        from_attributes = True

class CompanyCreate(BaseModel):
    name: str

class CompanyOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class CrawlJobOut(BaseModel):
    id: int
    source_id: int
    status: str
    total_records: int
    inserted_records: int
    duplicate_records: int
    started_at: datetime
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DashboardSummaryOut(BaseModel):
    total_findings: int
    critical_alerts: int
    reviewed_findings: int
    monitored_companies: int
    latest_collection: Optional[str] = None


class DashboardFindingOut(BaseModel):
    id: int
    company: str
    type: str
    severity: str
    risk_score: int
    status: str
    detected_at: str
    source: str
    affected: str


class DashboardFindingDetailOut(DashboardFindingOut):
    title: str
    summary: str
    recommended_action: str
    raw_url: Optional[str] = None
    published_at: Optional[str] = None
    evidence: list[str]


class DashboardFeedItemOut(BaseModel):
    id: int
    tone: str
    title: str
    company: str
    time: str


class DashboardTimelinePointOut(BaseModel):
    date: str
    findings: int


class DashboardSourceMetricOut(BaseModel):
    id: int
    label: str
    value: str


class DashboardSeverityOut(BaseModel):
    label: str
    value: int


class DashboardSeverityLegendOut(BaseModel):
    label: str
    range: str


class DashboardCompanyPressureOut(BaseModel):
    name: str
    count: int
    score: int
    severity: str


class DashboardStatusRowOut(BaseModel):
    label: str
    value: str
    tone: Optional[str] = None


class DashboardStatusCardOut(BaseModel):
    id: str
    title: str
    rows: list[DashboardStatusRowOut]


class DashboardDetectionEngineOut(BaseModel):
    model_status: str
    analysis_coverage: float
    analyzed_findings: int
    pending_findings: int


class DashboardFindingStatusUpdateIn(BaseModel):
    status: str


class DashboardOverviewOut(BaseModel):
    generated_at: str
    summary: DashboardSummaryOut
    findings: list[DashboardFindingOut]
    critical_alerts: list[DashboardFindingOut]
    live_feed: list[DashboardFeedItemOut]
    timeline: list[DashboardTimelinePointOut]
    data_sources: list[DashboardSourceMetricOut]
    severity_breakdown: list[DashboardSeverityOut]
    severity_legend: list[DashboardSeverityLegendOut]
    top_companies: list[DashboardCompanyPressureOut]
    detection_engine: DashboardDetectionEngineOut
    sidebar_status_cards: list[DashboardStatusCardOut]
class AnalysisResultOut(BaseModel):
    id: int
    leak_record_id: int
    detected_patterns: dict
    matched_companies: list[Any]
    terminology_hits: list[Any]
    score_contributors: dict
    classification_rule: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FindingOut(BaseModel):
    id: int
    title: str
    company_id: int
    classification: str
    risk_score: int
    severity: Optional[str] = None
    content_hash: str
    raw_url: str
    is_analyzed: bool
    collected_at: datetime

    class Config:
        from_attributes = True


class FindingDetailOut(FindingOut):
    is_reviewed: Optional[bool] = None
    is_false_positive: Optional[bool] = None
    review_notes: Optional[str] = None
    analysis_result: Optional[AnalysisResultOut] = None


class PaginatedFindingsOut(BaseModel):
    page: int
    size: int
    total: int
    items: list[FindingOut]


class AlertOut(BaseModel):
    id: int
    leak_record_id: int
    company_id: int
    severity: str
    is_reviewed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AlertListItemOut(AlertOut):
    finding_title: str


class PaginatedAlertsOut(BaseModel):
    page: int
    size: int
    total: int
    items: list[AlertListItemOut]


class ReviewRequest(BaseModel):
    review_notes: Optional[str] = None


class FalsePositiveRequest(BaseModel):
    review_notes: str


class SeverityStatsOut(BaseModel):
    critical: int
    medium: int
    low: int
