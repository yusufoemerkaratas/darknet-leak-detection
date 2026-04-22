# collectors/darknet_forum_collector_authenticated.py
#
# Full darknet forum collector:
#   - Loads forum config from forums.yaml
#   - Authenticates via AuthenticationManager (cookie reuse + re-login)
#   - Scrapes listing pages and individual threads with BeautifulSoup4
#   - Deduplicates via SHA-256 content hash
#   - Stores raw documents + crawl_job records as JSON (SQLite-ready)
#   - Rate limiting, User-Agent rotation, 429 handling (via RateLimiter)
#   - Auto-rotates Tor circuit every N requests (via TorManager)
#   - Auto account generation when forum allows registration

import hashlib
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from urllib.parse import urljoin

import yaml
from bs4 import BeautifulSoup

from account_generator import AccountRegistrar
from authentication_manager import AuthenticationManager
from rate_limiter import RateLimiter
from tor_manager import TorManager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

_CONFIG_PATH = Path(__file__).parent / "config" / "forums.yaml"
_STORAGE_ROOT = Path(__file__).parent / "raw_storage"
_HASH_INDEX_FILE = _STORAGE_ROOT / "seen_hashes.json"


# ---------------------------------------------------------------------------
# Storage helpers
# ---------------------------------------------------------------------------

def _load_seen_hashes() -> set:
    if _HASH_INDEX_FILE.exists():
        with open(_HASH_INDEX_FILE) as f:
            return set(json.load(f))
    return set()


def _save_seen_hashes(hashes: set) -> None:
    _HASH_INDEX_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(_HASH_INDEX_FILE, "w") as f:
        json.dump(sorted(hashes), f)


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()


def _save_raw_document(doc: dict) -> None:
    """Persist a raw document to disk as JSON."""
    out_dir = _STORAGE_ROOT / doc["forum_id"]
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{doc['content_hash'][:16]}_{int(time.time())}.json"
    with open(out_dir / filename, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)


def _save_crawl_job(job: dict) -> None:
    out_dir = _STORAGE_ROOT / "crawl_jobs"
    out_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{job['id']}.json"
    with open(out_dir / filename, "w") as f:
        json.dump(job, f, indent=2)


def _new_crawl_job(forum_id: str, section_url: str) -> dict:
    return {
        "id": f"{forum_id}_{int(time.time() * 1000)}",
        "forum_id": forum_id,
        "section_url": section_url,
        "status": "running",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "finished_at": None,
        "documents_found": 0,
        "documents_new": 0,
        "error_message": None,
    }


# ---------------------------------------------------------------------------
# HTML utilities
# ---------------------------------------------------------------------------

def _normalize_html(soup: BeautifulSoup) -> BeautifulSoup:
    """
    Strip noise from a parsed page: scripts, styles, ads, nav elements.
    Returns the same soup object (modified in place).
    """
    for tag in soup(["script", "style", "noscript", "iframe",
                     "nav", "header", "footer", "aside"]):
        tag.decompose()
    # Remove ad-like containers
    for tag in soup.find_all(class_=re.compile(r"ad|banner|sidebar|popup", re.I)):
        tag.decompose()
    return soup


def _safe_text(element, max_len: int = 2000) -> str:
    """Extract clean text from a BS4 element, truncated to max_len."""
    if element is None:
        return ""
    text = element.get_text(separator=" ", strip=True)
    return text[:max_len]


def _safe_attr(element, attr: str) -> str:
    if element is None:
        return ""
    return element.get(attr, "") or ""


# ---------------------------------------------------------------------------
# Main collector
# ---------------------------------------------------------------------------

class AuthenticatedForumCollector:
    """
    Authenticated darknet forum scraper for a single forum entry.

    Lifecycle:
        collector = AuthenticatedForumCollector(forum_config, global_defaults)
        collector.run()
        collector.close()
    """

    def __init__(self, forum_config: dict, defaults: dict):
        self.forum = forum_config
        self.defaults = defaults
        self.forum_id: str = forum_config["id"]
        self.base_url: str = forum_config.get("base_url") or forum_config.get("clearnet_url", "")
        self.sel: dict = forum_config.get("selectors", {})
        self.rate_cfg: dict = forum_config.get("rate_limit", {})

        # Tor
        rotate_every = defaults.get("rotate_circuit_every", 50)
        self.tor = TorManager(rotate_every=rotate_every)

        # Auth
        self.auth = AuthenticationManager(forum_config, self.tor)

        # Rate limiter
        self.limiter = RateLimiter(
            self.forum_id,
            self.rate_cfg,
            rotate_user_agent=defaults.get("user_agent_rotate", True),
        )

        # Dedup index
        self._seen_hashes: set = _load_seen_hashes()

        # Per-session stats
        self._docs_found = 0
        self._docs_new = 0

    # ------------------------------------------------------------------
    # Entry point
    # ------------------------------------------------------------------

    def run(self) -> dict:
        """
        Authenticate and scrape all enabled sections.
        Returns a summary dict.
        """
        logger.info(f"[{self.forum_id}] Starting collector run")

        # Auto account generation: register if enabled, then inject creds into env
        # so AuthenticationManager._resolve_env() picks them up automatically.
        generated_creds = self._maybe_register_account()
        if generated_creds:
            self._inject_credentials_to_env(generated_creds)

        if not self.auth.ensure_authenticated():
            logger.error(f"[{self.forum_id}] Cannot authenticate — skipping forum")
            return {"forum_id": self.forum_id, "error": "auth_failed"}

        for section in self.forum.get("sections", []):
            if not section.get("enabled", True):
                continue
            self._scrape_section(section)

        _save_seen_hashes(self._seen_hashes)
        logger.info(
            f"[{self.forum_id}] Run complete — "
            f"found={self._docs_found}, new={self._docs_new}"
        )
        return {
            "forum_id": self.forum_id,
            "documents_found": self._docs_found,
            "documents_new": self._docs_new,
        }

    def close(self) -> None:
        self.tor.close()

    # ------------------------------------------------------------------
    # Account generation
    # ------------------------------------------------------------------

    def _maybe_register_account(self) -> Optional[dict]:
        """
        If account_generation is enabled for this forum, register an account
        (or reuse an existing registered one).
        Returns the credential dict on success, None if disabled or failed.
        """
        gen_cfg = self.forum.get("account_generation", {})
        if not gen_cfg.get("enabled", False):
            return None
        credentials_file = gen_cfg.get("credentials_file", f"accounts/{self.forum_id}.json")
        registrar = AccountRegistrar(self.forum, self.tor)
        creds = registrar.register(credentials_file)
        if creds:
            logger.info(f"[{self.forum_id}] Using generated account: {creds['username']}")
        return creds

    def _inject_credentials_to_env(self, creds: dict) -> None:
        """
        Read auth.fields from config to find which env vars hold username/password,
        then set them in os.environ so AuthenticationManager._resolve_env() picks
        them up automatically.

        Uses setdefault so that real credentials in the environment take priority
        over generated ones — the user can always override by setting the env var.
        """
        fields = self.forum.get("auth", {}).get("fields", {})
        for field_name, field_val in fields.items():
            if field_name == "csrf_field":
                continue
            match = re.search(r"\$\{([^}]+)\}", str(field_val))
            if not match:
                continue
            env_var = match.group(1)
            field_lower = field_name.lower()
            if any(k in field_lower for k in ("user", "login", "name")):
                os.environ.setdefault(env_var, creds.get("username", ""))
                logger.debug(f"[{self.forum_id}] Injected {env_var} = {creds.get('username')}")
            elif "pass" in field_lower:
                os.environ.setdefault(env_var, creds.get("password", ""))
                logger.debug(f"[{self.forum_id}] Injected {env_var} = ***")
            elif "email" in field_lower:
                os.environ.setdefault(env_var, creds.get("email", ""))
                logger.debug(f"[{self.forum_id}] Injected {env_var} = {creds.get('email')}")

    # ------------------------------------------------------------------
    # Section scraping
    # ------------------------------------------------------------------

    def _scrape_section(self, section: dict) -> None:
        section_url = self._full_url(section["url"])
        max_pages = self.defaults.get("max_pages_per_section", 10)
        job = _new_crawl_job(self.forum_id, section_url)

        logger.info(f"[{self.forum_id}] Scraping section: {section['name']} ({section_url})")

        try:
            current_url: Optional[str] = section_url
            page = 0

            while current_url and page < max_pages:
                page += 1
                # _fetch_listing_page returns (posts, next_url) — no double fetch
                posts, next_url = self._fetch_listing_page(current_url, job["id"])
                self._docs_found += len(posts)

                for post in posts:
                    if self._is_new(post.get("content_hash", "")):
                        _save_raw_document(post)
                        self._seen_hashes.add(post["content_hash"])
                        self._docs_new += 1

                current_url = next_url

            job["status"] = "completed"

        except Exception as e:
            logger.error(f"[{self.forum_id}] Section error: {e}", exc_info=True)
            job["status"] = "error"
            job["error_message"] = str(e)

        finally:
            job["finished_at"] = datetime.now(timezone.utc).isoformat()
            job["documents_found"] = self._docs_found
            job["documents_new"] = self._docs_new
            _save_crawl_job(job)

    def _fetch_listing_page(self, url: str, crawl_job_id: str) -> tuple:
        """
        Fetch a listing page, extract posts and the next-page URL in one pass.
        Returns (posts: list, next_url: Optional[str])
        """
        start = time.time()
        self.limiter.wait(self.tor.session)

        resp = self._get_with_retry(url)
        delay = time.time() - start
        self.limiter.record_request()

        if resp is None:
            self.limiter.log_request(url, None, delay, error="no_response")
            return [], None

        self.limiter.log_request(url, resp.status_code, delay)

        soup = _normalize_html(BeautifulSoup(resp.content, "lxml"))
        posts = self._extract_posts(soup, url, crawl_job_id)
        next_url = self._extract_next_url(soup)
        return posts, next_url

    def _extract_posts(self, soup: BeautifulSoup, page_url: str, crawl_job_id: str) -> list:
        """Parse all post elements from a listing page."""
        container_sel = self.sel.get("post_item", "")
        if not container_sel:
            logger.warning(f"[{self.forum_id}] No post_item selector configured")
            return []

        elements = soup.select(container_sel)
        logger.info(f"[{self.forum_id}] Found {len(elements)} posts on {page_url}")

        posts = []
        for el in elements:
            try:
                post = self._parse_post_element(el, page_url, crawl_job_id)
                if post:
                    posts.append(post)
            except Exception as e:
                logger.warning(f"[{self.forum_id}] Post parse error: {e}")
        return posts

    def _is_high_risk(self, text: str) -> bool:
        """
        Pre-filter: compare text with the pre_filter.keywords list in forums.yaml.
        If there is a matching keyword, it returns True (high priority), if the list is empty, it also returns True.
        """
        keywords = self.forum.get("pre_filter", {}).get("keywords", [])
        if not keywords:
            return True
        text_lower = text.lower()
        return any(kw.lower() in text_lower for kw in keywords)

    def _parse_post_element(self, el, page_url: str, crawl_job_id: str = "") -> Optional[dict]:
        """Extract structured data from a single post element."""
        title_el = el.select_one(self.sel.get("title", ""))
        if not title_el:
            return None

        title = _safe_text(title_el, 300)
        if not title:
            return None

        author   = _safe_text(el.select_one(self.sel.get("author", "")), 100)
        body     = _safe_text(el.select_one(self.sel.get("body", "")), 2000)
        category = _safe_text(el.select_one(self.sel.get("category", "")), 100)

        ts_el     = el.select_one(self.sel.get("timestamp", ""))
        ts_attr   = self.sel.get("timestamp_attr", "datetime")
        timestamp = _safe_attr(ts_el, ts_attr) or _safe_text(ts_el, 50)

        # Thread link
        link_el    = title_el if title_el.name == "a" else title_el.find("a")
        thread_url = ""
        if link_el:
            thread_url = self._full_url(link_el.get("href", ""))

        raw_content  = f"{title}\n{author}\n{body}"
        content_hash = _sha256(raw_content)

        # For analyzer: full text cleaned from noise
        full_body_text = el.get_text(separator=" ", strip=True)

        # Extract all links in the element (except anchor and in-page)
        detected_links = [
            {"url": self._full_url(a["href"]), "text": a.get_text(strip=True) or a["href"]}
            for a in el.find_all("a", href=True)
            if a["href"] and not a["href"].startswith("#")
        ]

        # Pre-filter: high_risk tag
        high_risk = self._is_high_risk(title + " " + body)

        return {
            "forum_id":       self.forum_id,
            "forum_name":     self.forum.get("name", ""),
            "title":          title,
            "author":         author,
            "body_preview":   body[:500],
            "full_body_text": full_body_text,
            "detected_links": detected_links,
            "high_risk":      high_risk,
            "category":       category,
            "timestamp":      timestamp,
            "thread_url":     thread_url,
            "source_url":     page_url,
            "source_type":    "darknet_forum",
            "content_hash":   content_hash,
            "raw_content":    raw_content,
            "fetched_at":     datetime.now(timezone.utc).isoformat(),
            "crawl_job_id":   crawl_job_id,
        }

    def _extract_next_url(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract the next-page URL from an already-fetched and parsed page."""
        try:
            next_sel = self.sel.get("next_page", "")
            if not next_sel:
                return None
            next_el = soup.select_one(next_sel)
            if next_el and next_el.get("href"):
                return self._full_url(next_el["href"])
        except Exception as e:
            logger.warning(f"[{self.forum_id}] next_page extraction error: {e}")
        return None

    # ------------------------------------------------------------------
    # HTTP helpers
    # ------------------------------------------------------------------

    def _get_with_retry(self, url: str, max_retries: int = 3) -> Optional[object]:
        """
        GET request with:
          - Session expiry detection (re-auth on redirect to login)
          - HTTP 429 exponential backoff
          - Tor circuit rotation on network errors
        """
        timeout = self.defaults.get("request_timeout", 30)

        for attempt in range(max_retries):
            try:
                resp = self.tor.session.get(url, timeout=timeout)

                # Detect redirect to login page (session expired)
                if self._is_login_redirect(resp):
                    logger.warning(f"[{self.forum_id}] Session expired — re-authenticating")
                    self.auth.invalidate()
                    if not self.auth.ensure_authenticated():
                        return None
                    continue

                if resp.status_code == 429:
                    self.limiter.handle_429(retry=attempt)
                    continue

                resp.raise_for_status()
                return resp

            except Exception as e:
                logger.warning(
                    f"[{self.forum_id}] Request error (attempt {attempt + 1}/{max_retries}): {e}"
                )
                if attempt < max_retries - 1:
                    self.tor.get_new_circuit()

        return None

    def _is_login_redirect(self, resp) -> bool:
        """Heuristic: we ended up on the login page."""
        if resp is None:
            return False
        login_url = self.auth.auth_cfg.get("login_url", "/login")
        if login_url.rstrip("/") in resp.url:
            return True
        login_indicators = ["please login", "sign in to continue", "you must be logged"]
        return any(kw in resp.text.lower() for kw in login_indicators)

    def _full_url(self, path: str) -> str:
        if path.startswith("http"):
            return path
        return self.base_url.rstrip("/") + "/" + path.lstrip("/")

    def _is_new(self, content_hash: str) -> bool:
        return bool(content_hash) and content_hash not in self._seen_hashes


# ---------------------------------------------------------------------------
# Config loader
# ---------------------------------------------------------------------------

def load_config(config_path: Path = _CONFIG_PATH) -> tuple[list, dict]:
    """Load forums.yaml and return (forums_list, defaults_dict)."""
    with open(config_path) as f:
        cfg = yaml.safe_load(f)
    forums = [f for f in cfg.get("forums", []) if f.get("enabled", True)]
    defaults = cfg.get("defaults", {})
    return forums, defaults


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Darknet forum leak collector")
    parser.add_argument("--forum", help="Run only this forum ID (default: all enabled)")
    parser.add_argument("--config", default=str(_CONFIG_PATH), help="Path to forums.yaml")
    args = parser.parse_args()

    forums, defaults = load_config(Path(args.config))

    if args.forum:
        forums = [f for f in forums if f["id"] == args.forum]
        if not forums:
            print(f"Forum '{args.forum}' not found or not enabled in config")
            raise SystemExit(1)

    overall = {"total_found": 0, "total_new": 0, "errors": []}

    for forum_cfg in forums:
        collector = AuthenticatedForumCollector(forum_cfg, defaults)
        try:
            result = collector.run()
            overall["total_found"] += result.get("documents_found", 0)
            overall["total_new"] += result.get("documents_new", 0)
            if result.get("error"):
                overall["errors"].append(result)
        except KeyboardInterrupt:
            logger.info("Interrupted")
            break
        except Exception as e:
            logger.error(f"Unhandled error for {forum_cfg['id']}: {e}", exc_info=True)
            overall["errors"].append({"forum_id": forum_cfg["id"], "error": str(e)})
        finally:
            collector.close()

    print(f"\nDone — found={overall['total_found']}, new={overall['total_new']}, "
          f"errors={len(overall['errors'])}")
