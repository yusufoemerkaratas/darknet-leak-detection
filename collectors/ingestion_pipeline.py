import json
import logging
import os
import shutil
import sys
from datetime import datetime
from pathlib import Path
from dateutil import parser as date_parser
import yaml

# Add parent directory to sys.path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.db import SessionLocal
from backend.models import AnalysisResult, LeakRecord, Source, Company
from analysis.detectors.credential_detector import CredentialDetector
from analysis.detectors.terminology_detector import TerminologyDetector
from analysis.detectors.company_detector import CompanyDetector

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

RAW_STORAGE_DIR = Path(__file__).parent / "raw_storage"
PROCESSED_STORAGE_DIR = Path(__file__).parent / "processed_storage"
COMPANY_PROFILE_PATH = Path(__file__).resolve().parent.parent / "analysis" / "config" / "company_profiles.yaml"

_credential_detector = CredentialDetector()
_terminology_detector = TerminologyDetector()
_company_detector = None

def _load_company_profiles() -> list:
    if not COMPANY_PROFILE_PATH.exists():
        return []

    try:
        with open(COMPANY_PROFILE_PATH, "r", encoding="utf-8") as fh:
            config = yaml.safe_load(fh) or {}
        return config.get("companies", [])
    except Exception:
        return []

_company_detector = CompanyDetector(_load_company_profiles())

def get_or_create_source(db, forum_id: str, forum_name: str, source_url: str) -> Source:
    source = db.query(Source).filter(Source.name == forum_id).first()
    if not source:
        source = Source(name=forum_id, url=source_url, is_active=True)
        db.add(source)
        db.commit()
        db.refresh(source)
    return source

def extract_company_name(text: str) -> str:
    """
    Very basic NLP / Rule-based Entity Extraction.
    Looks for common patterns "X Database Leaks" inside the text.
    If none found, returns 'Unknown'.
    """
    # Just a placeholder heuristic - in reality, use spaCy or a LLM here.
    # We will simply look for capitalized words before "Leak" or "Database"
    text_lower = text.lower()
    if " leak" in text_lower or " database" in text_lower:
        words = text.split()
        for i, word in enumerate(words):
            if word.lower() in ["leak", "leaks", "database", "breach"]:
                if i > 0 and words[i-1].istitle():
                    return words[i-1].strip(".,\"'-:")
    return "Unknown"

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

def _build_analysis_text(doc: dict) -> str:
    parts = [
        doc.get("title", ""),
        doc.get("body", ""),
        doc.get("body_preview", ""),
        doc.get("content", ""),
    ]
    return "\n".join(p for p in parts if p)

def _serialize_detection_results(text: str) -> dict:
    patterns = []
    for result in _credential_detector.detect(text):
        patterns.append({
            "pattern_type": result.pattern_type,
            "matched_text": result.matched_text,
            "context": result.context,
            "confidence": result.confidence,
            "line_number": result.line_number,
        })

    terminology = []
    for result in _terminology_detector.detect(text):
        terminology.append({
            "term": result.term,
            "priority": result.priority,
            "count": result.count,
            "line_numbers": result.line_numbers,
            "context": result.context,
        })

    company_indicators = []
    for result in _company_detector.detect(text):
        company_indicators.append({
            "company_name": result.company_name,
            "match_type": result.match_type,
            "matched_term": result.matched_term,
            "confidence": result.confidence,
            "similarity_score": result.similarity_score,
        })

    return {
        "patterns": patterns,
        "terminology": terminology,
        "company_indicators": company_indicators,
    }

def process_file(db, filepath: Path) -> bool:
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            doc = json.load(f)
            
        content_hash = doc.get("content_hash")
        
        # Check if already exists in DB
        existing = db.query(LeakRecord).filter(LeakRecord.content_hash == content_hash).first()
        if existing:
            return True  # Already processed
        
        # 1. Provide Source
        source = get_or_create_source(db, doc.get("forum_id", "unknown"), doc.get("forum_name", "Unknown Forum"), doc.get("source_url", ""))
        
        # 2. Extract Company
        company_name = extract_company_name(doc.get("title", "") + " " + doc.get("body_preview", ""))
        company = get_or_create_company(db, company_name)
        
        # 3. Create Leak Record
        published_at = parse_date(doc.get("timestamp"))
        collected_at = parse_date(doc.get("fetched_at"))
        
        record = LeakRecord(
            source_id=source.id,
            company_id=company.id,
            title=doc.get("title", "Untitled")[:255],
            content_hash=content_hash,
            raw_url=doc.get("thread_url") or doc.get("source_url") or "",
            severity="Medium", # Default
            published_at=published_at,
            collected_at=collected_at
        )
        db.add(record)
        db.commit()
        db.refresh(record)

        analysis_text = _build_analysis_text(doc)
        detected = _serialize_detection_results(analysis_text)

        analysis_result = AnalysisResult(
            leak_record_id=record.id,
            detected_patterns=detected,
        )
        db.add(analysis_result)
        db.commit()
        return True
    
    except Exception as e:
        logger.error(f"Error processing {filepath.name}: {e}")
        db.rollback()
        return False

def run_pipeline():
    logger.info("Starting Ingestion Pipeline...")
    db = SessionLocal()
    processed_count = 0
    error_count = 0
    total_found = 0
    
    try:
        if not RAW_STORAGE_DIR.exists():
            logger.info("No raw_storage directory found. Exiting.")
            return

        for forum_dir in RAW_STORAGE_DIR.iterdir():
            if forum_dir.is_dir() and forum_dir.name != "crawl_jobs":
                for json_file in forum_dir.glob("*.json"):
                    total_found += 1
                    success = process_file(db, json_file)
                    if success:
                        # Move to processed directory
                        target_dir = PROCESSED_STORAGE_DIR / forum_dir.name
                        target_dir.mkdir(parents=True, exist_ok=True)
                        shutil.move(str(json_file), str(target_dir / json_file.name))
                        processed_count += 1
                    else:
                        error_count += 1
                        
    finally:
        db.close()
        
    logger.info(f"Pipeline finished. Total found: {total_found}. Processed & Moved: {processed_count}. Errors: {error_count}.")

if __name__ == "__main__":
    run_pipeline()
