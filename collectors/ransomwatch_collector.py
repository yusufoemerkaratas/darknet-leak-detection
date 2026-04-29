# collectors/ransomwatch_collector.py
#
# Clearnet collector for the ransomwatch public dataset.
# Source: https://github.com/joshhighet/ransomwatch
# API:    https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json
#
# No login, no CAPTCHA, no Tor required.
# Each entry = one ransomware group victim announcement.

import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests

logger = logging.getLogger(__name__)

_API_URL      = "https://raw.githubusercontent.com/joshhighet/ransomwatch/main/posts.json"
_STORAGE_ROOT = Path(__file__).parent / "raw_storage"
_HASH_INDEX   = _STORAGE_ROOT / "seen_hashes.json"
_SOURCE_ID    = "ransomwatch"
_UA           = "Mozilla/5.0 (X11; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0"


# ---------------------------------------------------------------------------
# Storage helpers (same format as other collectors)
# ---------------------------------------------------------------------------

def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()


def _load_seen_hashes() -> set:
    if _HASH_INDEX.exists():
        with open(_HASH_INDEX) as f:
            return set(json.load(f))
    return set()


def _save_seen_hashes(hashes: set) -> None:
    _HASH_INDEX.parent.mkdir(parents=True, exist_ok=True)
    with open(_HASH_INDEX, "w") as f:
        json.dump(sorted(hashes), f)


def _save_doc(doc: dict) -> None:
    out = _STORAGE_ROOT / _SOURCE_ID
    out.mkdir(parents=True, exist_ok=True)
    fname = f"{doc['content_hash'][:16]}_{int(time.time())}.json"
    with open(out / fname, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Collector
# ---------------------------------------------------------------------------

class RansomwatchCollector:
    """
    Fetches the ransomwatch public JSON feed and converts each entry
    to the standard collector document format used by ingestion_pipeline.
    """

    def __init__(self, timeout: int = 30):
        self.timeout = timeout
        self._session = requests.Session()
        self._session.headers["User-Agent"] = _UA

    def _fetch(self) -> Optional[list]:
        try:
            resp = self._session.get(_API_URL, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error(f"[ransomwatch] API fetch error: {e}")
            return None

    def _to_doc(self, entry: dict) -> dict:
        group     = entry.get("group_name", "unknown")
        title     = entry.get("post_title") or entry.get("website") or group
        website   = entry.get("website", "")
        timestamp = entry.get("discovered") or entry.get("published") or ""

        body = (
            f"Ransomware Group: {group}\n"
            f"Victim Website: {website}\n"
            f"Title: {title}\n"
            f"Discovered: {timestamp}"
        )
        content_hash = _sha256(body)

        return {
            "forum_id":       _SOURCE_ID,
            "forum_name":     "Ransomwatch (public feed)",
            "title":          str(title)[:255],
            "author":         group,
            "body_preview":   body[:500],
            "full_body_text": body,
            "detected_links": [{"url": f"https://{website}", "text": website}] if website else [],
            "high_risk":      True,
            "category":       group,
            "timestamp":      timestamp,
            "thread_url":     "https://ransomwatch.telemetry.ltd/",
            "source_url":     _API_URL,
            "source_type":    "darknet_forum",
            "content_hash":   content_hash,
            "raw_content":    body,
            "fetched_at":     datetime.now(timezone.utc).isoformat(),
            "crawl_job_id":   "",
        }

    def run(self) -> dict:
        logger.info("[ransomwatch] Fetching public JSON feed...")
        entries = self._fetch()
        if not entries:
            return {"forum_id": _SOURCE_ID, "found": 0, "new": 0}

        logger.info(f"[ransomwatch] {len(entries)} entries in feed")
        seen = _load_seen_hashes()

        found = len(entries)
        new   = 0
        for entry in entries:
            doc = self._to_doc(entry)
            if doc["content_hash"] in seen:
                continue
            _save_doc(doc)
            seen.add(doc["content_hash"])
            new += 1

        _save_seen_hashes(seen)
        logger.info(f"[ransomwatch] Done — found={found}, new={new}")
        return {"forum_id": _SOURCE_ID, "found": found, "new": new}

    def close(self) -> None:
        self._session.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        stream=sys.stdout,
    )
    c = RansomwatchCollector()
    result = c.run()
    c.close()
    print(f"\nSonuç: {result}")
