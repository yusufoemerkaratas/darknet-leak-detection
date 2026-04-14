# collectors/account_generator.py
#
# Generates realistic forum accounts (username / password / email) and
# optionally registers them on the target forum via its registration form.
#
# Dependencies: faker, requests (via TorManager)

import json
import logging
import random
import string
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup
from faker import Faker

logger = logging.getLogger(__name__)
fake = Faker()


# ---------------------------------------------------------------------------
# Credential generation
# ---------------------------------------------------------------------------

_USER_ADJECTIVES = [
    "dark", "shadow", "ghost", "cyber", "silent", "void",
    "anon", "stealth", "ultra", "neon", "crypto", "proxy",
]
_USER_NOUNS = [
    "hunter", "walker", "coder", "node", "proxy", "shell",
    "byte", "root", "signal", "vector", "thread", "packet",
]


def generate_username() -> str:
    """
    Generate a plausible forum username.
    Darknet forums typically use handles like 'shadowhunter42' or 'n3oncoder'.
    """
    style = random.choice(["word_word_num", "l33t", "faker_username"])

    if style == "word_word_num":
        adj = random.choice(_USER_ADJECTIVES)
        noun = random.choice(_USER_NOUNS)
        num = random.randint(1, 9999)
        return f"{adj}{noun}{num}"

    if style == "l33t":
        base = fake.user_name()
        l33t_map = {"a": "4", "e": "3", "i": "1", "o": "0", "s": "5"}
        return "".join(l33t_map.get(c, c) for c in base)

    return fake.user_name() + str(random.randint(10, 99))


def generate_password(length: int = 16) -> str:
    """
    Generate a strong random password.
    Meets most forum requirements: upper, lower, digit, special char.
    """
    chars = string.ascii_letters + string.digits + "!@#$%^&*_-"
    while True:
        pwd = "".join(random.choices(chars, k=length))
        if (any(c.isupper() for c in pwd)
                and any(c.islower() for c in pwd)
                and any(c.isdigit() for c in pwd)
                and any(c in "!@#$%^&*_-" for c in pwd)):
            return pwd


def generate_email(username: str) -> str:
    """
    Generate a disposable-looking email for the given username.
    Uses common free / temp-mail domain patterns.
    """
    domains = [
        "protonmail.com", "tutanota.com", "guerrillamail.com",
        "mailinator.com", "tempmail.net", "sharklasers.com",
        "yopmail.com", "dispostable.com", "trashmail.com",
    ]
    suffix = random.randint(1, 999)
    domain = random.choice(domains)
    return f"{username}{suffix}@{domain}"


# ---------------------------------------------------------------------------
# Credential storage
# ---------------------------------------------------------------------------

def _load_credentials(path: str) -> list:
    p = Path(path)
    if p.exists():
        with open(p) as f:
            return json.load(f)
    return []


def _save_credentials(path: str, records: list) -> None:
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w") as f:
        json.dump(records, f, indent=2)


def get_or_create_credentials(credentials_file: str, forum_id: str) -> dict:
    """
    Return an existing unused credential set for `forum_id`, or generate a new one.
    Credentials are stored in `credentials_file` (JSON list).

    Each record shape:
      {
        "forum_id": "...",
        "username": "...",
        "password": "...",
        "email": "...",
        "created_at": "ISO-8601",
        "registered": false,
        "active": true
      }
    """
    records = _load_credentials(credentials_file)
    # Find an active, registered credential
    for rec in records:
        if rec.get("forum_id") == forum_id and rec.get("registered") and rec.get("active"):
            return rec

    # None found — generate a new one
    username = generate_username()
    record = {
        "forum_id": forum_id,
        "username": username,
        "password": generate_password(),
        "email": generate_email(username),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "registered": False,
        "active": True,
    }
    records.append(record)
    _save_credentials(credentials_file, records)
    logger.info(f"Generated new credentials for {forum_id}: {username}")
    return record


def mark_registered(credentials_file: str, username: str) -> None:
    """Mark credentials as successfully registered."""
    records = _load_credentials(credentials_file)
    for rec in records:
        if rec.get("username") == username:
            rec["registered"] = True
            break
    _save_credentials(credentials_file, records)


def mark_inactive(credentials_file: str, username: str) -> None:
    """Mark credentials as banned / inactive."""
    records = _load_credentials(credentials_file)
    for rec in records:
        if rec.get("username") == username:
            rec["active"] = False
            break
    _save_credentials(credentials_file, records)


# ---------------------------------------------------------------------------
# Forum registration
# ---------------------------------------------------------------------------

class AccountRegistrar:
    """
    Handles automatic account registration on a forum using its registration form.
    Requires a configured TorManager session.
    """

    def __init__(self, forum_config: dict, tor_manager):
        self.forum = forum_config
        self.tor = tor_manager
        self.base_url = forum_config.get("base_url") or forum_config.get("clearnet_url", "")
        self.gen_cfg = forum_config.get("account_generation", {})

    def _full_url(self, path: str) -> str:
        return self.base_url.rstrip("/") + "/" + path.lstrip("/")

    def _fetch_csrf_token(self, register_url: str, csrf_field: Optional[str]) -> Optional[str]:
        """Fetch the registration page and extract a CSRF token."""
        if not csrf_field:
            return None
        try:
            resp = self.tor.fetch(register_url, timeout=30)
            if resp is None:
                return None
            soup = BeautifulSoup(resp.content, "html.parser")
            token_input = (
                soup.find("input", {"name": csrf_field})
                or soup.find("input", {"id": csrf_field})
            )
            if token_input:
                return token_input.get("value")
        except Exception as e:
            logger.warning(f"Could not fetch CSRF token: {e}")
        return None

    def register(self, credentials_file: str) -> Optional[dict]:
        """
        Generate credentials and register a new account on the forum.

        Returns the credential dict on success, None on failure.
        """
        if not self.gen_cfg.get("enabled", False):
            logger.info(f"Account generation disabled for {self.forum['id']}")
            return None

        if self.gen_cfg.get("captcha", "none") != "none":
            logger.warning(
                f"Forum {self.forum['id']} requires captcha — auto-registration skipped"
            )
            return None

        creds = get_or_create_credentials(credentials_file, self.forum["id"])
        if creds.get("registered"):
            logger.info(f"Already registered as {creds['username']} on {self.forum['id']}")
            return creds

        register_path = self.gen_cfg.get("register_url", "/register")
        register_url = self._full_url(register_path)
        auth_cfg = self.forum.get("auth", {})
        csrf_field = auth_cfg.get("fields", {}).get("csrf_field")

        csrf_token = self._fetch_csrf_token(register_url, csrf_field)

        # Build POST payload from config template
        field_map = self.gen_cfg.get("fields", {})
        payload = {}
        for key, val in field_map.items():
            val = val.replace("{generated_username}", creds["username"])
            val = val.replace("{generated_password}", creds["password"])
            val = val.replace("{generated_email}", creds["email"])
            payload[key] = val

        if csrf_token and csrf_field:
            payload[csrf_field] = csrf_token

        logger.info(f"Registering {creds['username']} on {self.forum['id']}...")
        resp = self.tor.post(register_url, data=payload, timeout=30)

        if resp is None:
            logger.error("Registration request failed (no response)")
            return None

        # Heuristic success check — look for username in response
        if creds["username"].lower() in resp.text.lower():
            mark_registered(credentials_file, creds["username"])
            logger.info(f"✓ Registered {creds['username']} on {self.forum['id']}")
            return creds

        logger.warning(
            f"Registration may have failed for {creds['username']} "
            f"(status {resp.status_code}) — check manually"
        )
        return None
