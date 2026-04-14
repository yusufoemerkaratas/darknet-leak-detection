# collectors/authentication_manager.py

import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class AuthenticationManager:
    """
    Manages login state for a single forum.

    Usage:
        auth = AuthenticationManager(forum_config, tor_manager)
        if auth.ensure_authenticated():
            # session is ready
    """

    def __init__(self, forum_config: dict, tor_manager):
        self.forum = forum_config
        self.tor = tor_manager
        self.auth_cfg = forum_config.get("auth", {})
        self.base_url = forum_config.get("base_url") or forum_config.get("clearnet_url", "")
        self._logged_in = False
        self._login_time: Optional[float] = None
        self._cookie_path = Path(
            self.auth_cfg.get("cookie_file", f"cookies/{forum_config['id']}.json")
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def ensure_authenticated(self) -> bool:
        """
        Guarantee the session is authenticated and not expired.
        Loads cookies from disk if available, otherwise logs in fresh.
        """
        if self.auth_cfg.get("type") == "none":
            return True

        if self._load_cookies():
            if not self._session_expired():
                logger.info(f"[{self.forum['id']}] Restored session from cookies")
                return True
            logger.info(f"[{self.forum['id']}] Session expired — re-logging in")

        return self._login()

    def invalidate(self) -> None:
        """Force a fresh login on the next ensure_authenticated() call."""
        self._logged_in = False
        self._login_time = None
        if self._cookie_path.exists():
            self._cookie_path.unlink()
        logger.info(f"[{self.forum['id']}] Session invalidated")

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _full_url(self, path: str) -> str:
        return self.base_url.rstrip("/") + "/" + path.lstrip("/")

    def _session_expired(self) -> bool:
        ttl = self.auth_cfg.get("session_ttl", 3600)
        if self._login_time is None:
            return True
        return (time.time() - self._login_time) >= ttl

    def _resolve_env(self, value: str) -> str:
        """Replace ${ENV_VAR} placeholders with environment values."""
        for match in re.findall(r"\$\{([^}]+)\}", value):
            env_val = os.environ.get(match, "")
            if not env_val:
                logger.warning(f"Env var {match} not set")
            value = value.replace(f"${{{match}}}", env_val)
        return value

    def _fetch_csrf_token(self, url: str) -> Optional[str]:
        csrf_field = self.auth_cfg.get("fields", {}).get("csrf_field", "")
        if not csrf_field:
            return None
        try:
            resp = self.tor.fetch(url, timeout=30)
            if resp is None:
                return None
            soup = BeautifulSoup(resp.content, "html.parser")
            el = (
                soup.find("input", {"name": csrf_field})
                or soup.find("input", {"id": csrf_field})
                or soup.find("meta", {"name": csrf_field})
            )
            if el:
                return el.get("value") or el.get("content")
        except Exception as e:
            logger.warning(f"[{self.forum['id']}] CSRF fetch error: {e}")
        return None

    def _build_payload(self, csrf_token: Optional[str]) -> dict:
        fields = self.auth_cfg.get("fields", {})
        csrf_field = fields.get("csrf_field", "")
        payload = {}
        for key, val in fields.items():
            if key == "csrf_field":
                continue
            payload[key] = self._resolve_env(val)
        if csrf_token and csrf_field:
            payload[csrf_field] = csrf_token
        return payload

    def _login(self) -> bool:
        login_url = self._full_url(self.auth_cfg.get("login_url", "/login"))
        csrf_token = self._fetch_csrf_token(login_url)
        payload = self._build_payload(csrf_token)

        logger.info(f"[{self.forum['id']}] Logging in at {login_url}...")
        resp = self.tor.post(login_url, data=payload, timeout=30)

        if resp is None:
            logger.error(f"[{self.forum['id']}] Login request returned no response")
            return False

        success_kw = self.auth_cfg.get("success_indicator", "logout")
        if success_kw.lower() in resp.text.lower():
            self._logged_in = True
            self._login_time = time.time()
            self._save_cookies()
            logger.info(f"[{self.forum['id']}] ✓ Login successful")
            return True

        for kw in ["invalid password", "wrong password", "login failed", "incorrect"]:
            if kw in resp.text.lower():
                logger.error(f"[{self.forum['id']}] ✗ Login failed: '{kw}' in response")
                return False

        logger.warning(
            f"[{self.forum['id']}] Login outcome unclear (status {resp.status_code})"
        )
        return False

    # ------------------------------------------------------------------
    # Cookie persistence
    # ------------------------------------------------------------------

    def _save_cookies(self) -> None:
        self._cookie_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "cookies": dict(self.tor.session.cookies),
            "saved_at": datetime.now(timezone.utc).isoformat(),
            "login_time": self._login_time,
        }
        with open(self._cookie_path, "w") as f:
            json.dump(data, f, indent=2)

    def _load_cookies(self) -> bool:
        if not self._cookie_path.exists():
            return False
        try:
            with open(self._cookie_path) as f:
                data = json.load(f)
            for name, value in data.get("cookies", {}).items():
                self.tor.session.cookies.set(name, value)
            self._login_time = data.get("login_time", time.time())
            self._logged_in = True
            return True
        except Exception as e:
            logger.warning(f"[{self.forum['id']}] Could not load cookies: {e}")
            return False
