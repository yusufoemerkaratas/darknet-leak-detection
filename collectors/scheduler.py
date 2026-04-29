import logging
import time
import schedule
from pathlib import Path
from datetime import datetime, timezone

from darknet_forum_collector_authenticated import AuthenticatedForumCollector, load_config
from js_collector import SPALeakCollector
from ransomwatch_collector import RansomwatchCollector
from ingestion_pipeline import run_pipeline

import os
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.db import SessionLocal
from backend.models import Source, CrawlJob

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] Scheduler — %(message)s",
)
logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "config" / "forums.yaml"


def _upsert_source(db, name: str, url: str) -> Source:
    s = db.query(Source).filter(Source.name == name).first()
    if not s:
        s = Source(name=name, url=url, is_active=True)
        db.add(s)
        db.commit()
        db.refresh(s)
    return s


def _run_with_job(db, forum_id: str, source_url: str, run_fn) -> None:
    """
    Wrap a collector's run() call with CrawlJob lifecycle tracking.
    Opens a 'running' job, calls run_fn(), then marks it 'completed' or 'failed'.
    """
    source = _upsert_source(db, forum_id, source_url)
    job = CrawlJob(
        source_id=source.id,
        status="running",
        total_records=0,
        inserted_records=0,
        duplicate_records=0,
        started_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    try:
        result = run_fn()
        if isinstance(result, dict) and "error" not in result:
            found = result.get("found") or result.get("documents_found") or 0
            new   = result.get("new")   or result.get("documents_new")   or 0
            job.total_records     = found
            job.inserted_records  = new
            job.duplicate_records = max(0, found - new)
            job.status = "completed"
        else:
            job.status = "failed"
    except Exception as e:
        logger.error(f"[{forum_id}] collector error: {e}")
        job.status = "failed"
    finally:
        job.finished_at = datetime.now(timezone.utc)
        db.commit()


def _make_collector(forum_cfg: dict, defaults: dict):
    """
    Return the correct collector based on the `type` field of the forum configuration.

    type: spa  → SPALeakCollector  (Playwright, JavaScript render)
    type: forum (default) → AuthenticatedForumCollector (requests + BS4)
    """
    forum_type = forum_cfg.get("type", "forum")
    if forum_type == "spa":
        logger.info(f"[scheduler] SPA collector selected: {forum_cfg['id']}")
        return SPALeakCollector(forum_cfg, defaults)
    logger.info(f"[scheduler] Forum collector selected: {forum_cfg['id']}")
    return AuthenticatedForumCollector(forum_cfg, defaults)


def job():
    logger.info("Starting scheduled scraping task...")
    db = SessionLocal()
    try:
        # 1. Forum / SPA collectors
        try:
            forums, defaults = load_config(CONFIG_PATH)
            for forum_cfg in forums:
                collector = _make_collector(forum_cfg, defaults)
                source_url = forum_cfg.get("base_url") or ""
                try:
                    _run_with_job(db, forum_cfg["id"], source_url, collector.run)
                finally:
                    collector.close()
        except Exception as e:
            logger.error(f"Config load or collector error: {e}")

        # 2. Clearnet: Ransomwatch public feed (no Tor, no login)
        try:
            rw = RansomwatchCollector()
            _run_with_job(
                db,
                "ransomwatch",
                "https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json",
                rw.run,
            )
            rw.close()
        except Exception as e:
            logger.error(f"[ransomwatch] Collector error: {e}")

        logger.info("Scraping completed. Starting ingestion pipeline...")

        # 3. Pipeline — raw_storage → database
        try:
            run_pipeline()
        except Exception as e:
            logger.error(f"Pipeline error: {e}")

    finally:
        db.close()

    logger.info("Scheduled task completed.")
    
def check_db_for_jobs():
    db = SessionLocal()
    try:
        pending_jobs = db.query(CrawlJob).filter(CrawlJob.status == "running").all()
        if not pending_jobs:
            return

        forums, defaults = load_config(CONFIG_PATH)
        forums_by_id = {f["id"]: f for f in forums}

        for cj in pending_jobs:
            source = db.query(Source).filter(Source.id == cj.source_id).first()
            if not source:
                cj.status = "failed"
                db.commit()
                continue
                
            forum_cfg = forums_by_id.get(source.name)
            if not forum_cfg:
                logger.error(f"Source {source.name} not configured in forums.yaml")
                cj.status = "failed"
                db.commit()
                continue

            logger.info(f"Picked up manual crawl job {cj.id} for source {source.name}")
            collector = _make_collector(forum_cfg, defaults)
            try:
                collector.run()
                cj.status = "completed"
            except Exception as e:
                logger.error(f"[{forum_cfg['id']}] API triggered collector error: {e}")
                cj.status = "failed"
            finally:
                collector.close()
                cj.finished_at = datetime.now(timezone.utc)
                db.commit()
                
        # Run pipeline after manual jobs
        run_pipeline()
    except Exception as e:
        logger.error(f"DB polling error: {e}")
    finally:
        db.close()

def start_scheduler():
    logger.info("Scheduler started. First run immediately, then every 3 hours.")
    job()
    schedule.every(3).hours.do(job)
    while True:
        schedule.run_pending()
        check_db_for_jobs()
        time.sleep(10)


if __name__ == "__main__":
    start_scheduler()
