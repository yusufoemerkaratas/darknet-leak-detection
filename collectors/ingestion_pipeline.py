import json
import logging
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional
from dateutil import parser as date_parser

# Add parent directory to sys.path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.db import SessionLocal
from backend.models import LeakRecord, Source, Company

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

RAW_STORAGE_DIR       = Path(__file__).parent / "raw_storage"
PROCESSED_STORAGE_DIR = Path(__file__).parent / "processed_storage"
FAILED_STORAGE_DIR    = Path(__file__).parent / "failed_storage"

# ---------------------------------------------------------------------------
# Regex-based metadata extractors
# ---------------------------------------------------------------------------

# Email address counter
_EMAIL_RE = re.compile(
    r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b'
)

# File size: "1.2 GB", "500 MB", "2TB" etc.
_SIZE_RE = re.compile(
    r'(\d+(?:[.,]\d+)?)\s*(TB|GB|MB|tb|gb|mb)',
    re.IGNORECASE,
)

# Expressions like "X records", "X rows", "X lines" at the start of the line
_RECORD_COUNT_RE = re.compile(
    r'([\d,\.]+)\s*(?:million|mln|M)?\s*(?:records?|rows?|lines?|entries|kullanıcı)',
    re.IGNORECASE,
)


def _extract_email_count(text: str) -> Optional[int]:
    """Count email addresses in text."""
    found = _EMAIL_RE.findall(text)
    return len(found) if found else None


def _extract_size_mb(text: str) -> Optional[float]:
    """
    Convert the first size expression in text to MB.
    E.g.: "1.5 GB" → 1536.0, "2 TB" → 2097152.0
    """
    m = _SIZE_RE.search(text)
    if not m:
        return None
    raw_val = m.group(1).replace(",", ".")
    try:
        value = float(raw_val)
    except ValueError:
        return None
    unit = m.group(2).upper()
    multipliers = {"TB": 1024 * 1024, "GB": 1024, "MB": 1}
    return round(value * multipliers[unit], 2)


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_or_create_source(db, forum_id: str, source_url: str) -> Source:
    source = db.query(Source).filter(Source.name == forum_id).first()
    if not source:
        source = Source(name=forum_id, url=source_url, is_active=True)
        db.add(source)
        db.commit()
        db.refresh(source)
    return source


def get_or_create_company(db, company_name: str) -> Company:
    company = db.query(Company).filter(Company.name == company_name).first()
    if not company:
        company = Company(name=company_name)
        db.add(company)
        db.commit()
        db.refresh(company)
    return company


def parse_date(date_str: str) -> datetime:
    try:
        if not date_str:
            return datetime.utcnow()
        return date_parser.parse(date_str)
    except Exception:
        return datetime.utcnow()


# ---------------------------------------------------------------------------
# File processing
# ---------------------------------------------------------------------------

def process_file(db, filepath: Path) -> bool:
    """
    Process a single JSON file and save it to the database as a LeakRecord.

    Returns:
        True  → successfully saved (or already existed)
        False → error / validation failed (→ will be moved to failed_storage)
    """
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            doc = json.load(f)

        content_hash = doc.get("content_hash")

        # Duplicate check
        existing = db.query(LeakRecord).filter(
            LeakRecord.content_hash == content_hash
        ).first()
        if existing:
            return True  # Already processed, safe to delete

        # Validation: full_body_text is required
        full_body_text = doc.get("full_body_text", "").strip()
        if not full_body_text:
            logger.warning(f"[pipeline] {filepath.name}: full_body_text empty — moving to failed_storage")
            return False

        # Extract metadata
        email_count    = _extract_email_count(full_body_text)
        estimated_size = _extract_size_mb(full_body_text)

        # Source and company
        source  = get_or_create_source(
            db, doc.get("forum_id", "unknown"), doc.get("source_url", "")
        )
        company = get_or_create_company(db, "Unknown")

        # Date
        published_at = parse_date(doc.get("timestamp"))
        collected_at = parse_date(doc.get("fetched_at"))

        record = LeakRecord(
            source_id        = source.id,
            company_id       = company.id,
            title            = doc.get("title", "Untitled")[:255],
            content_hash     = content_hash,
            raw_url          = doc.get("thread_url") or doc.get("source_url") or "",
            severity         = "Medium",
            published_at     = published_at,
            collected_at     = collected_at,
            raw_content_text = full_body_text,
            detected_links   = doc.get("detected_links") or [],
            is_analyzed      = False,
            email_count      = email_count,
            estimated_size_mb = estimated_size,
        )

        db.add(record)
        db.commit()
        return True

    except Exception as e:
        logger.error(f"[pipeline] error processing {filepath.name}: {e}")
        db.rollback()
        return False


def _move(src: Path, dest_dir: Path) -> None:
    """Move file to target directory; create target directory if necessary."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dest_dir / src.name))


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_pipeline():
    logger.info("Starting Ingestion Pipeline...")
    db = SessionLocal()
    processed_count = 0
    failed_count    = 0
    total_found     = 0

    try:
        if not RAW_STORAGE_DIR.exists():
            logger.info("raw_storage directory not found. Exiting.")
            return

        for forum_dir in RAW_STORAGE_DIR.iterdir():
            if not (forum_dir.is_dir() and forum_dir.name != "crawl_jobs"):
                continue

            for json_file in forum_dir.glob("*.json"):
                total_found += 1
                success = process_file(db, json_file)

                if success:
                    # Success → move to processed_storage
                    _move(json_file, PROCESSED_STORAGE_DIR / forum_dir.name)
                    processed_count += 1
                else:
                    # Failed → move to failed_storage (prevents infinite loop)
                    _move(json_file, FAILED_STORAGE_DIR / forum_dir.name)
                    failed_count += 1

    finally:
        db.close()

    logger.info(
        f"Pipeline complete — "
        f"found={total_found}, processed={processed_count}, failed={failed_count}"
    )


if __name__ == "__main__":
    run_pipeline()
