import logging
import time
import schedule
from pathlib import Path

from darknet_forum_collector_authenticated import AuthenticatedForumCollector, load_config
from js_collector import SPALeakCollector
from ingestion_pipeline import run_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] Scheduler — %(message)s",
)
logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "config" / "forums.yaml"


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

    # 1. Run collectors
    try:
        forums, defaults = load_config(CONFIG_PATH)
        for forum_cfg in forums:
            collector = _make_collector(forum_cfg, defaults)
            try:
                collector.run()
            except Exception as e:
                logger.error(f"[{forum_cfg['id']}] Collector error: {e}")
            finally:
                collector.close()
    except Exception as e:
        logger.error(f"Config load or collector error: {e}")

    logger.info("Scraping completed. Starting ingestion pipeline...")

    # 2. Pipeline — raw_storage → database
    try:
        run_pipeline()
    except Exception as e:
        logger.error(f"Pipeline error: {e}")

    logger.info("Scheduled task completed.")


def start_scheduler():
    logger.info("Scheduler started. First run immediately, then every 3 hours.")
    job()
    schedule.every(3).hours.do(job)
    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    start_scheduler()
