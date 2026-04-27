from fastapi import Depends, FastAPI
from sqlalchemy import func
from sqlalchemy.orm import Session

from db import SessionLocal
from models import LeakRecord, Source
from routers import source, company, crawl_job

app = FastAPI(title="Datenleck API", version="1.0.0")

app.include_router(source.router)
app.include_router(company.router)
app.include_router(crawl_job.router)


# ---------------------------------------------------------------------------
# DB dependency
# ---------------------------------------------------------------------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Stats — system status summary (for analyzer + ops)
# ---------------------------------------------------------------------------

@app.get("/stats")
def stats(db: Session = Depends(get_db)):
    """
    Returns a real-time summary of collection and analysis status.

    For the analyzer:
      - pending_analysis: number of records not yet reviewed
      - total_emails_found: total number of email addresses found in all records
      - records_per_source: how many records came from which forum

    For ops:
      - total_records: total records in the database
      - largest_leak_mb: largest leak size detected (MB)
      - latest_collection: time of the most recent data collection (ISO-8601)
    """
    total     = db.query(func.count(LeakRecord.id)).scalar() or 0
    pending   = db.query(func.count(LeakRecord.id)).filter(
        LeakRecord.is_analyzed == False  # noqa: E712
    ).scalar() or 0
    analyzed  = total - pending

    total_emails  = db.query(func.sum(LeakRecord.email_count)).scalar() or 0
    largest_leak  = db.query(func.max(LeakRecord.estimated_size_mb)).scalar()
    latest_ts     = db.query(func.max(LeakRecord.collected_at)).scalar()

    per_source_rows = (
        db.query(Source.name, func.count(LeakRecord.id).label("count"))
        .join(LeakRecord, LeakRecord.source_id == Source.id)
        .group_by(Source.name)
        .all()
    )
    records_per_source = {row.name: row.count for row in per_source_rows}

    return {
        "total_records":        total,
        "pending_analysis":     pending,
        "analyzed":             analyzed,
        "total_emails_found":   int(total_emails),
        "largest_leak_mb":      float(largest_leak) if largest_leak else None,
        "latest_collection":    latest_ts.isoformat() if latest_ts else None,
        "records_per_source":   records_per_source,
    }
