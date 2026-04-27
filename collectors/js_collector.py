# collectors/js_collector.py
#
# JavaScript supported (React/Vue SPA) forum collector.
# Runs with headless Chromium via Playwright + Tor SOCKS5 proxy.
#
# Installation:
#   pip install playwright
#   playwright install chromium
#
# torrc requirements:
#   SOCKSPort 9050          ← already open
#   ControlPort 9051        ← enable (for circuit rotation)
#   CookieAuthentication 1  ← enable
#   sudo systemctl restart tor

import hashlib
import json
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

_STORAGE_ROOT = Path(__file__).parent / "raw_storage"
_HASH_INDEX   = _STORAGE_ROOT / "seen_hashes.json"

SOCKS_PROXY = "socks5://127.0.0.1:9050"

# ---------------------------------------------------------------------------
# Storage helpers (same format as darknet_forum_collector_authenticated.py)
# ---------------------------------------------------------------------------

def _load_seen_hashes() -> set:
    if _HASH_INDEX.exists():
        with open(_HASH_INDEX) as f:
            return set(json.load(f))
    return set()


def _save_seen_hashes(hashes: set) -> None:
    _HASH_INDEX.parent.mkdir(parents=True, exist_ok=True)
    with open(_HASH_INDEX, "w") as f:
        json.dump(sorted(hashes), f)


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()


def _save_doc(doc: dict) -> None:
    out = _STORAGE_ROOT / doc["forum_id"]
    out.mkdir(parents=True, exist_ok=True)
    fname = f"{doc['content_hash'][:16]}_{int(time.time())}.json"
    with open(out / fname, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)


# ---------------------------------------------------------------------------
# Playwright page loader
# ---------------------------------------------------------------------------

def _fetch_rendered(url: str, wait_selector: Optional[str] = None,
                    timeout_ms: int = 45_000) -> Optional[str]:
    """
    Fetch URL via Tor with Playwright and return full HTML
    after JavaScript render is complete.

    Args:
        url:           Target URL (.onion or clearnet)
        wait_selector: CSS selector indicating page is ready.
                       If None, waits for networkidle.
        timeout_ms:    Total page load limit (ms).

    Returns:
        Full page HTML (str) or None on error.
    """
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
    except ImportError:
        logger.error("[js_collector] playwright not installed — 'pip install playwright && playwright install chromium'")
        return None

    try:
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                proxy={"server": SOCKS_PROXY},
                args=["--disable-blink-features=AutomationControlled"],
            )
            ctx = browser.new_context(
                user_agent=(
                    "Mozilla/5.0 (X11; Linux x86_64; rv:115.0) "
                    "Gecko/20100101 Firefox/115.0"
                ),
                java_script_enabled=True,
                ignore_https_errors=True,
            )
            page = ctx.new_page()

            # Monitor network requests — are there any API calls?
            api_responses: list[dict] = []
            def _on_response(resp):
                ct = resp.headers.get("content-type", "")
                if "json" in ct and resp.status == 200:
                    try:
                        api_responses.append({
                            "url": resp.url,
                            "body": resp.json(),
                        })
                    except Exception:
                        pass
            page.on("response", _on_response)

            page.goto(url, timeout=timeout_ms)

            if wait_selector:
                try:
                    page.wait_for_selector(wait_selector, timeout=timeout_ms)
                except PlaywrightTimeout:
                    logger.warning(f"[js_collector] '{wait_selector}' selector timeout — continuing")
            else:
                page.wait_for_load_state("networkidle", timeout=timeout_ms)

            html = page.content()
            browser.close()

            if api_responses:
                logger.info(f"[js_collector] {len(api_responses)} JSON API responses caught")
                for resp in api_responses:
                    logger.debug(f"  API: {resp['url']}")

            return html

    except Exception as e:
        logger.error(f"[js_collector] Playwright error: {e}")
        return None


# ---------------------------------------------------------------------------
# Ransomware group SPA collector
# ---------------------------------------------------------------------------

class SPALeakCollector:
    """
    Collector for JavaScript-based (React/Vue SPA) leak/ransomware sites.

    Renders the page with Playwright headless Chromium, then
    extracts structured data with BeautifulSoup.

    forum_config example (forums.yaml):
      id: ransomhouse
      type: spa                      ← selects this collector
      base_url: "http://zohlm7...onion"
      sections:
        - name: "Victims"
          url: "/"
          enabled: true
      selectors:
        post_item: "div.cls_mainPage > div"   ← selector after render
        title: "h2, h3, .cls_title"
        body: "p, .cls_description"
        ...
      wait_selector: "div.cls_mainPage"       ← render complete signal
    """

    def __init__(self, forum_config: dict, defaults: dict):
        self.forum     = forum_config
        self.defaults  = defaults
        self.forum_id  = forum_config["id"]
        self.base_url  = forum_config.get("base_url", "")
        self.sel       = forum_config.get("selectors", {})
        self.wait_sel  = forum_config.get("wait_selector")
        self._seen     = _load_seen_hashes()
        self._new      = 0
        self._found    = 0

    def run(self) -> dict:
        logger.info(f"[{self.forum_id}] SPA collector starting")
        for section in self.forum.get("sections", []):
            if not section.get("enabled", True):
                continue
            self._scrape_section(section)
        _save_seen_hashes(self._seen)
        logger.info(f"[{self.forum_id}] Completed — found={self._found}, new={self._new}")
        return {"forum_id": self.forum_id, "found": self._found, "new": self._new}

    def close(self) -> None:
        pass  # Playwright context is closed on every fetch

    # ------------------------------------------------------------------

    def _scrape_section(self, section: dict) -> None:
        section_url = self.base_url.rstrip("/") + "/" + section["url"].lstrip("/")
        logger.info(f"[{self.forum_id}] Rendering page: {section_url}")

        html = _fetch_rendered(
            section_url,
            wait_selector=self.wait_sel,
            timeout_ms=self.defaults.get("request_timeout", 30) * 1000,
        )
        if not html:
            logger.error(f"[{self.forum_id}] Page could not be fetched: {section_url}")
            return

        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "lxml")

        container_sel = self.sel.get("post_item", "")
        if not container_sel:
            logger.warning(f"[{self.forum_id}] post_item selector not defined")
            return

        items = soup.select(container_sel)
        logger.info(f"[{self.forum_id}] {len(items)} items found")
        self._found += len(items)

        for el in items:
            try:
                doc = self._parse_item(el, section_url)
                if doc and doc["content_hash"] not in self._seen:
                    _save_doc(doc)
                    self._seen.add(doc["content_hash"])
                    self._new += 1
            except Exception as e:
                logger.warning(f"[{self.forum_id}] Parse error: {e}")

    def _parse_item(self, el, page_url: str) -> Optional[dict]:
        def _txt(selector, maxlen=2000):
            if not selector:
                return ""
            node = el.select_one(selector)
            return node.get_text(separator=" ", strip=True)[:maxlen] if node else ""

        title = _txt(self.sel.get("title", ""))
        if not title:
            title = el.get_text(separator=" ", strip=True)[:200]
        if not title:
            return None

        body           = _txt(self.sel.get("body", ""), 2000)
        website        = _txt(self.sel.get("website", ""), 300)
        full_body_text = el.get_text(separator=" ", strip=True)

        # Extract all links — both detail page (/r/<hash>) and external links
        detected_links = []
        for a in el.find_all("a", href=True):
            href = a["href"]
            if not href or href.startswith("#"):
                continue
            # Convert relative paths to absolute URLs
            if href.startswith("/"):
                href = self.base_url.rstrip("/") + href
            detected_links.append({
                "url": href,
                "text": a.get_text(strip=True) or href,
            })

        raw_content  = f"{title}\n{website}\n{body}"
        content_hash = _sha256(raw_content)

        pre_filter_kw = self.forum.get("pre_filter", {}).get("keywords", [])
        high_risk = (
            not pre_filter_kw
            or any(kw.lower() in full_body_text.lower() for kw in pre_filter_kw)
        )

        return {
            "forum_id":       self.forum_id,
            "forum_name":     self.forum.get("name", ""),
            "title":          title,
            "author":         "",
            "body_preview":   body[:500],
            "full_body_text": full_body_text,
            "detected_links": detected_links,
            "high_risk":      high_risk,
            "timestamp":      datetime.now(timezone.utc).isoformat(),
            "thread_url":     page_url,
            "source_url":     page_url,
            "source_type":    "ransomware_spa",
            "content_hash":   content_hash,
            "raw_content":    raw_content,
            "fetched_at":     datetime.now(timezone.utc).isoformat(),
            "crawl_job_id":   "",
        }
