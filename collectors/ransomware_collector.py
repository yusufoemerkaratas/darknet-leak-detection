import hashlib
import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import yaml
from bs4 import BeautifulSoup

from tor_manager import TorManager

logger = logging.getLogger(__name__)

_CONFIG_PATH  = Path(__file__).parent / "config" / "ransomware_sites.yaml"
_STORAGE_ROOT = Path(__file__).parent / "raw_storage"
_HASH_INDEX   = _STORAGE_ROOT / "ransomware_sites_hashes.json"
_SOURCE_ID    = "ransomware_sites"


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


class RansomwareCollector:
    def __init__(self, timeout: int = 45):
        self.timeout = timeout
        self.tor = TorManager()
        self.seen_hashes = _load_seen_hashes()

    def _to_doc(self, group_name: str, url: str, raw_html: str) -> dict:
        soup = BeautifulSoup(raw_html, "lxml")
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
            
        text = soup.get_text(separator="\n", strip=True)
        
        body = (
            f"Ransomware Group: {group_name}\n"
            f"URL: {url}\n"
            f"Content:\n{text}"
        )
        content_hash = _sha256(body)

        links = []
        for a in soup.find_all("a", href=True):
            links.append({"url": a["href"], "text": a.get_text(strip=True)})

        return {
            "forum_id":       _SOURCE_ID,
            "forum_name":     "Ransomware Leak Sites",
            "title":          f"{group_name} Leak Site Dump",
            "author":         group_name,
            "body_preview":   text[:500],
            "full_body_text": text,
            "detected_links": links[:50],  # Limit links to avoid massive payloads
            "high_risk":      True,
            "category":       group_name,
            "timestamp":      datetime.now(timezone.utc).isoformat(),
            "thread_url":     url,
            "source_url":     url,
            "source_type":    "ransomware",
            "content_hash":   content_hash,
            "raw_content":    raw_html,
            "fetched_at":     datetime.now(timezone.utc).isoformat(),
            "crawl_job_id":   "",
        }

    def run(self) -> dict:
        if not _CONFIG_PATH.exists():
            logger.error(f"[ransomware_sites] Config not found: {_CONFIG_PATH}")
            return {"forum_id": _SOURCE_ID, "found": 0, "new": 0}

        try:
            with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
        except Exception as e:
            logger.error(f"[ransomware_sites] Error parsing YAML: {e}")
            return {"forum_id": _SOURCE_ID, "found": 0, "new": 0}

        groups = config.get("groups", [])
        
        # Filter enabled groups
        enabled_groups = [g for g in groups if g.get("enabled", False)]
        logger.info(f"[ransomware_sites] Found {len(enabled_groups)} enabled groups out of {len(groups)}")
        
        found = 0
        new = 0

        for group in enabled_groups:
            group_name = group.get("name", "Unknown")
            locations = group.get("locations", [])
            
            # Find an available location (prefer .onion, but any available is fine)
            available_locs = [loc for loc in locations if loc.get("available", False)]
            if not available_locs:
                continue
                
            # Try to fetch from the first available location
            success = False
            for loc in available_locs:
                url = loc.get("url")
                if not url:
                    continue
                
                logger.info(f"[ransomware_sites] Fetching {group_name} via {url}")
                try:
                    resp = self.tor.fetch(url, timeout=self.timeout)
                    if resp and resp.status_code == 200:
                        raw_html = resp.text
                        doc = self._to_doc(group_name, url, raw_html)
                        
                        found += 1
                        if doc["content_hash"] not in self.seen_hashes:
                            _save_doc(doc)
                            self.seen_hashes.add(doc["content_hash"])
                            new += 1
                            logger.info(f"[ransomware_sites] ✓ Saved new content for {group_name}")
                        else:
                            logger.info(f"[ransomware_sites] - Content unchanged for {group_name}")
                            
                        success = True
                        break # Successfully fetched one mirror, move to next group
                    else:
                        logger.warning(f"[ransomware_sites] ✗ Failed to fetch {url}")
                except Exception as e:
                    logger.error(f"[ransomware_sites] ✗ Error fetching {url}: {e}")
                    
            if not success:
                logger.warning(f"[ransomware_sites] ✗ All mirrors failed for {group_name}")

        _save_seen_hashes(self.seen_hashes)
        logger.info(f"[ransomware_sites] Run complete — found={found}, new={new}")
        
        return {"forum_id": _SOURCE_ID, "found": found, "new": new}

    def close(self) -> None:
        if self.tor:
            self.tor.close()


if __name__ == "__main__":
    import sys
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        stream=sys.stdout,
    )
    c = RansomwareCollector()
    result = c.run()
    c.close()
    print(f"\nResult: {result}")
