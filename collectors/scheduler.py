import logging
import time
import schedule
from pathlib import Path

# Importer of the collector logic
from darknet_forum_collector_authenticated import AuthenticatedForumCollector, load_config
from ingestion_pipeline import run_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] Scheduler — %(message)s",
)
logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).parent / "config" / "forums.yaml"

def job():
    logger.info("Starting scheduled scraping job...")
    
    # 1. Run Collectors
    try:
        forums, defaults = load_config(CONFIG_PATH)
        for forum_cfg in forums:
            collector = AuthenticatedForumCollector(forum_cfg, defaults)
            try:
                collector.run()
            except Exception as e:
                logger.error(f"Error running collector for {forum_cfg['id']}: {e}")
            finally:
                collector.close()
    except Exception as e:
        logger.error(f"Error loading config or running collectors: {e}")
        
    logger.info("Scraping completed. Moving to ingestion pipeline...")
    
    # 2. Run Ingestion Pipeline (Database Saving & Entity Extraction)
    try:
        run_pipeline()
    except Exception as e:
        logger.error(f"Error running ingestion pipeline: {e}")
        
    logger.info("Scheduled job finished.")

def start_scheduler():
    logger.info("Scheduler started. First job will run immediately, then every 3 hours.")
    
    # Run once immediately
    job()
    
    # Schedule to run every 3 hours
    schedule.every(3).hours.do(job)
    
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    start_scheduler()
