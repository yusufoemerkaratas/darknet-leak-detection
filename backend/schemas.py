from datetime import datetime
from typing import Optional

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
    success_rate: float


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
