# collectors/rate_limiter.py

import logging
import random
import time
from collections import deque
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# User-Agent pool  (realistic browser strings)
# ---------------------------------------------------------------------------

_USER_AGENTS = [
    # Firefox on Linux (Tor Browser baseline)
    "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (X11; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0",
    # Firefox on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    # Chrome on Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    # Chrome on Linux
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
]


def random_user_agent() -> str:
    return random.choice(_USER_AGENTS)


# ---------------------------------------------------------------------------
# RateLimiter
# ---------------------------------------------------------------------------

class RateLimiter:
    """
    Per-forum rate limiter with:
      - Random delay between requests (min_delay … max_delay seconds)
      - Per-hour request cap (sliding window)
      - HTTP 429 exponential backoff
      - User-Agent rotation on each request
      - Structured request logging
    """

    def __init__(self, forum_id: str, rate_cfg: dict, rotate_user_agent: bool = True):
        self.forum_id = forum_id
        self.min_delay: float = rate_cfg.get("min_delay", 2.0)
        self.max_delay: float = rate_cfg.get("max_delay", 6.0)
        self.max_per_hour: int = rate_cfg.get("max_requests_per_hour", 120)
        self.backoff_429: int = rate_cfg.get("backoff_on_429", 60)
        self.rotate_ua = rotate_user_agent

        # Sliding window: timestamps of the last N requests (last hour)
        self._timestamps: deque = deque()
        self._last_request_time: float = 0.0

    # ------------------------------------------------------------------
    # Public
    # ------------------------------------------------------------------

    def wait(self, session=None) -> None:
        """
        Block until it is safe to send the next request:
          1. Enforce random delay since the last request.
          2. Enforce hourly cap (sleep until the oldest request falls outside the window).
          3. Optionally rotate the User-Agent header.
        """
        self._enforce_random_delay()
        self._enforce_hourly_cap()
        if session and self.rotate_ua:
            self._rotate_user_agent(session)

    def handle_429(self, retry: int = 0) -> None:
        """
        Called when the server returns HTTP 429.
        Waits backoff_429 * 2^retry seconds (capped at 10 min).
        """
        wait = min(self.backoff_429 * (2 ** retry), 600)
        logger.warning(
            f"[{self.forum_id}] HTTP 429 — backing off {wait}s (retry #{retry + 1})"
        )
        time.sleep(wait)

    def log_request(
        self,
        url: str,
        status: Optional[int],
        delay: float,
        error: Optional[str] = None,
    ) -> None:
        """Write a structured log line for every request attempt."""
        ts = datetime.now(timezone.utc).isoformat(timespec="seconds")
        if error:
            logger.warning(
                f"[{self.forum_id}] {ts} | {url} | status={status} | "
                f"delay={delay:.2f}s | error={error}"
            )
        else:
            logger.info(
                f"[{self.forum_id}] {ts} | {url} | status={status} | delay={delay:.2f}s"
            )

    def record_request(self) -> None:
        """Record that a request was just sent (call after the request completes)."""
        now = time.time()
        self._timestamps.append(now)
        self._last_request_time = now
        self._prune_old()

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _enforce_random_delay(self) -> None:
        elapsed = time.time() - self._last_request_time
        delay = random.uniform(self.min_delay, self.max_delay)
        remaining = delay - elapsed
        if remaining > 0:
            logger.debug(f"[{self.forum_id}] Sleeping {remaining:.2f}s")
            time.sleep(remaining)

    def _enforce_hourly_cap(self) -> None:
        self._prune_old()
        while len(self._timestamps) >= self.max_per_hour:
            oldest = self._timestamps[0]
            wait = 3600 - (time.time() - oldest) + 1
            if wait > 0:
                logger.info(
                    f"[{self.forum_id}] Hourly cap reached ({self.max_per_hour} req/h) "
                    f"— sleeping {wait:.0f}s"
                )
                time.sleep(wait)
            self._prune_old()

    def _prune_old(self) -> None:
        """Remove timestamps older than 1 hour from the sliding window."""
        cutoff = time.time() - 3600
        while self._timestamps and self._timestamps[0] < cutoff:
            self._timestamps.popleft()

    def _rotate_user_agent(self, session) -> None:
        ua = random_user_agent()
        session.headers.update({"User-Agent": ua})
        logger.debug(f"[{self.forum_id}] User-Agent → {ua[:60]}…")
