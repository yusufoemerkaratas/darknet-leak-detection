# collectors/tests/test_collectors.py
#
# Unit tests for:
#   - account_generator.py
#   - authentication_manager.py
#   - rate_limiter.py
#   - darknet_forum_collector_authenticated.py (pure logic, no network)

import json
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Make collectors importable from this subdirectory
sys.path.insert(0, str(Path(__file__).parent.parent))

from account_generator import (
    generate_email,
    generate_password,
    generate_username,
    get_or_create_credentials,
    mark_inactive,
    mark_registered,
)
from authentication_manager import AuthenticationManager
from darknet_forum_collector_authenticated import (
    _new_crawl_job,
    _normalize_html,
    _safe_attr,
    _safe_text,
    _sha256,
    load_config,
    AuthenticatedForumCollector,
)
from rate_limiter import RateLimiter, _USER_AGENTS, random_user_agent

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_forum_config(forum_id="test_forum"):
    return {
        "id": forum_id,
        "name": "Test Forum",
        "enabled": True,
        "base_url": "http://testforum.onion",
        "auth": {
            "type": "form",
            "login_url": "/login",
            "login_method": "POST",
            "fields": {
                "username": "${TEST_USER}",
                "password": "${TEST_PASS}",
                "csrf_field": "csrf_token",
            },
            "success_indicator": "logout",
            "session_cookie_name": "session",
            "cookie_file": "",
            "session_ttl": 3600,
        },
        "account_generation": {"enabled": False},
        "sections": [],
        "selectors": {
            "post_item": "div.post",
            "title": "h2.title",
            "author": "span.author",
            "timestamp": "time",
            "timestamp_attr": "datetime",
            "body": "div.body",
            "category": "span.cat",
            "next_page": "a.next",
        },
        "rate_limit": {
            "min_delay": 0.0,
            "max_delay": 0.0,
            "max_requests_per_hour": 1000,
            "backoff_on_429": 1,
        },
    }


def _mock_defaults():
    return {
        "request_timeout": 10,
        "max_retries": 1,
        "rotate_circuit_every": 50,
        "user_agent_rotate": False,
        "max_pages_per_section": 2,
        "storage_dir": "raw_storage",
    }


# ===========================================================================
# account_generator
# ===========================================================================

class TestGenerateUsername(unittest.TestCase):
    def test_not_empty(self):
        for _ in range(20):
            u = generate_username()
            self.assertTrue(len(u) > 0)

    def test_no_spaces(self):
        for _ in range(20):
            self.assertNotIn(" ", generate_username())

    def test_ascii_only(self):
        for _ in range(20):
            generate_username().encode("ascii")  # raises if non-ASCII


class TestGeneratePassword(unittest.TestCase):
    def test_length(self):
        self.assertEqual(len(generate_password(16)), 16)
        self.assertEqual(len(generate_password(24)), 24)

    def test_complexity(self):
        for _ in range(20):
            pwd = generate_password()
            self.assertTrue(any(c.isupper() for c in pwd), "needs uppercase")
            self.assertTrue(any(c.islower() for c in pwd), "needs lowercase")
            self.assertTrue(any(c.isdigit() for c in pwd), "needs digit")
            self.assertTrue(any(c in "!@#$%^&*_-" for c in pwd), "needs special")


class TestGenerateEmail(unittest.TestCase):
    def test_contains_at(self):
        self.assertIn("@", generate_email("testuser"))

    def test_starts_with_username(self):
        email = generate_email("myuser")
        self.assertTrue(email.startswith("myuser"))


class TestCredentialStorage(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
        self.tmp.close()
        self.creds_file = self.tmp.name
        # Start with empty file
        Path(self.creds_file).write_text("[]")

    def tearDown(self):
        os.unlink(self.creds_file)

    def test_creates_new_credentials(self):
        creds = get_or_create_credentials(self.creds_file, "forum_x")
        self.assertEqual(creds["forum_id"], "forum_x")
        self.assertIn("username", creds)
        self.assertIn("password", creds)
        self.assertIn("email", creds)
        self.assertFalse(creds["registered"])
        self.assertTrue(creds["active"])

    def test_reuses_registered_credentials(self):
        # Manually insert a registered record
        record = {
            "forum_id": "forum_x",
            "username": "existinguser",
            "password": "Pass1!",
            "email": "e@x.com",
            "created_at": "2024-01-01T00:00:00",
            "registered": True,
            "active": True,
        }
        Path(self.creds_file).write_text(json.dumps([record]))
        creds = get_or_create_credentials(self.creds_file, "forum_x")
        self.assertEqual(creds["username"], "existinguser")

    def test_generates_new_if_unregistered(self):
        record = {
            "forum_id": "forum_x",
            "username": "unreguser",
            "password": "Pass1!",
            "email": "e@x.com",
            "created_at": "2024-01-01T00:00:00",
            "registered": False,
            "active": True,
        }
        Path(self.creds_file).write_text(json.dumps([record]))
        creds = get_or_create_credentials(self.creds_file, "forum_x")
        # Should NOT reuse unregistered — generates a new one
        self.assertNotEqual(creds["username"], "unreguser")

    def test_mark_registered(self):
        creds = get_or_create_credentials(self.creds_file, "forum_x")
        mark_registered(self.creds_file, creds["username"])
        updated = get_or_create_credentials(self.creds_file, "forum_x")
        self.assertEqual(updated["username"], creds["username"])
        self.assertTrue(updated["registered"])

    def test_mark_inactive(self):
        creds = get_or_create_credentials(self.creds_file, "forum_x")
        mark_registered(self.creds_file, creds["username"])
        mark_inactive(self.creds_file, creds["username"])
        # After marking inactive a new one should be generated
        new_creds = get_or_create_credentials(self.creds_file, "forum_x")
        self.assertNotEqual(new_creds["username"], creds["username"])


# ===========================================================================
# authentication_manager
# ===========================================================================

class TestAuthenticationManager(unittest.TestCase):
    def _make_auth(self, cookie_file="", session_ttl=3600):
        cfg = _mock_forum_config()
        cfg["auth"]["cookie_file"] = cookie_file
        cfg["auth"]["session_ttl"] = session_ttl
        tor = MagicMock()
        tor.session = MagicMock()
        tor.session.cookies = MagicMock()
        tor.session.cookies.__iter__ = MagicMock(return_value=iter([]))
        tor.fetch = MagicMock(return_value=None)
        tor.post = MagicMock(return_value=None)
        return AuthenticationManager(cfg, tor)

    def test_no_auth_type_returns_true(self):
        cfg = _mock_forum_config()
        cfg["auth"]["type"] = "none"
        tor = MagicMock()
        auth = AuthenticationManager(cfg, tor)
        self.assertTrue(auth.ensure_authenticated())

    def test_session_expired_when_no_login_time(self):
        auth = self._make_auth()
        auth._login_time = None
        self.assertTrue(auth._session_expired())

    def test_session_not_expired_when_fresh(self):
        auth = self._make_auth(session_ttl=3600)
        auth._login_time = time.time()
        self.assertFalse(auth._session_expired())

    def test_session_expired_after_ttl(self):
        auth = self._make_auth(session_ttl=1)
        auth._login_time = time.time() - 2
        self.assertTrue(auth._session_expired())

    def test_resolve_env_substitutes(self):
        os.environ["TEST_USER"] = "alice"
        auth = self._make_auth()
        result = auth._resolve_env("${TEST_USER}")
        self.assertEqual(result, "alice")
        del os.environ["TEST_USER"]

    def test_resolve_env_missing_var(self):
        auth = self._make_auth()
        os.environ.pop("NONEXISTENT_VAR", None)
        result = auth._resolve_env("${NONEXISTENT_VAR}")
        self.assertEqual(result, "")

    def test_build_payload_excludes_csrf_field_key(self):
        os.environ["TEST_USER"] = "alice"
        os.environ["TEST_PASS"] = "secret"
        auth = self._make_auth()
        payload = auth._build_payload(csrf_token="tok123")
        self.assertIn("username", payload)
        self.assertIn("password", payload)
        self.assertNotIn("csrf_field", payload)
        self.assertEqual(payload.get("csrf_token"), "tok123")
        del os.environ["TEST_USER"]
        del os.environ["TEST_PASS"]

    def test_login_returns_false_on_no_response(self):
        auth = self._make_auth()
        auth.tor.post.return_value = None
        self.assertFalse(auth._login())

    def test_login_success_on_indicator(self):
        auth = self._make_auth()
        mock_resp = MagicMock()
        mock_resp.text = "Welcome back! <a href='/logout'>logout</a>"
        mock_resp.status_code = 200
        auth.tor.post.return_value = mock_resp
        with patch.object(auth, "_save_cookies"):
            result = auth._login()
        self.assertTrue(result)
        self.assertTrue(auth._logged_in)

    def test_login_failure_on_keyword(self):
        auth = self._make_auth()
        mock_resp = MagicMock()
        mock_resp.text = "Invalid password, try again."
        mock_resp.status_code = 200
        auth.tor.post.return_value = mock_resp
        self.assertFalse(auth._login())

    def test_cookie_save_and_load(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            cookie_file = os.path.join(tmpdir, "cookies.json")
            auth = self._make_auth(cookie_file=cookie_file)
            auth._login_time = time.time()
            auth.tor.session.cookies = {"session": "abc123"}
            auth._save_cookies()
            # Load into a fresh instance
            auth2 = self._make_auth(cookie_file=cookie_file)
            result = auth2._load_cookies()
            self.assertTrue(result)
            self.assertIsNotNone(auth2._login_time)

    def test_invalidate_deletes_cookie_file(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            cookie_file = os.path.join(tmpdir, "cookies.json")
            Path(cookie_file).write_text("{}")
            auth = self._make_auth(cookie_file=cookie_file)
            auth.invalidate()
            self.assertFalse(Path(cookie_file).exists())


# ===========================================================================
# rate_limiter
# ===========================================================================

class TestRateLimiter(unittest.TestCase):
    def _make(self, min_delay=0.0, max_delay=0.0, max_per_hour=1000, backoff=1):
        return RateLimiter("test", {
            "min_delay": min_delay,
            "max_delay": max_delay,
            "max_requests_per_hour": max_per_hour,
            "backoff_on_429": backoff,
        })

    def test_random_user_agent_returns_known_string(self):
        ua = random_user_agent()
        self.assertIn(ua, _USER_AGENTS)

    def test_user_agent_rotation_updates_session(self):
        rl = self._make()
        session = MagicMock()
        session.headers = {}
        rl._rotate_user_agent(session)
        self.assertIn("User-Agent", session.headers)

    def test_log_request_no_crash(self):
        rl = self._make()
        rl.log_request("http://x.onion/", 200, 1.5)
        rl.log_request("http://x.onion/", None, 0.0, error="timeout")

    def test_record_request_increments_window(self):
        rl = self._make()
        rl.record_request()
        rl.record_request()
        self.assertEqual(len(rl._timestamps), 2)

    def test_prune_old_removes_expired(self):
        rl = self._make()
        rl._timestamps.append(time.time() - 3700)  # older than 1h
        rl._timestamps.append(time.time())
        rl._prune_old()
        self.assertEqual(len(rl._timestamps), 1)

    def test_handle_429_backoff_increases(self):
        rl = self._make(backoff=1)
        with patch("rate_limiter.time.sleep") as mock_sleep:
            rl.handle_429(retry=0)
            rl.handle_429(retry=1)
            rl.handle_429(retry=2)
        calls = [c.args[0] for c in mock_sleep.call_args_list]
        self.assertEqual(calls, [1, 2, 4])

    def test_handle_429_capped_at_600(self):
        rl = self._make(backoff=300)
        with patch("rate_limiter.time.sleep") as mock_sleep:
            rl.handle_429(retry=5)
        self.assertEqual(mock_sleep.call_args.args[0], 600)

    def test_wait_zero_delay_no_sleep(self):
        rl = self._make(min_delay=0.0, max_delay=0.0)
        rl._last_request_time = 0.0  # long ago — no wait needed
        with patch("rate_limiter.time.sleep") as mock_sleep:
            rl.wait()
        mock_sleep.assert_not_called()


# ===========================================================================
# darknet_forum_collector_authenticated (pure logic)
# ===========================================================================

class TestSha256(unittest.TestCase):
    def test_deterministic(self):
        self.assertEqual(_sha256("hello"), _sha256("hello"))

    def test_different_inputs(self):
        self.assertNotEqual(_sha256("hello"), _sha256("world"))

    def test_length(self):
        self.assertEqual(len(_sha256("x")), 64)


class TestSafeText(unittest.TestCase):
    from bs4 import BeautifulSoup as _BS

    def test_none_returns_empty(self):
        self.assertEqual(_safe_text(None), "")

    def test_extracts_text(self):
        from bs4 import BeautifulSoup
        el = BeautifulSoup("<p>  Hello World  </p>", "lxml").find("p")
        self.assertEqual(_safe_text(el), "Hello World")

    def test_truncates(self):
        from bs4 import BeautifulSoup
        el = BeautifulSoup(f"<p>{'x' * 100}</p>", "lxml").find("p")
        self.assertEqual(len(_safe_text(el, max_len=10)), 10)


class TestSafeAttr(unittest.TestCase):
    def test_none_returns_empty(self):
        self.assertEqual(_safe_attr(None, "href"), "")

    def test_existing_attr(self):
        from bs4 import BeautifulSoup
        el = BeautifulSoup('<time datetime="2024-01-01">', "lxml").find("time")
        self.assertEqual(_safe_attr(el, "datetime"), "2024-01-01")

    def test_missing_attr(self):
        from bs4 import BeautifulSoup
        el = BeautifulSoup("<span>x</span>", "lxml").find("span")
        self.assertEqual(_safe_attr(el, "nonexistent"), "")


class TestNormalizeHtml(unittest.TestCase):
    def test_removes_scripts(self):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup("<div><script>bad()</script><p>good</p></div>", "lxml")
        _normalize_html(soup)
        self.assertIsNone(soup.find("script"))
        self.assertIsNotNone(soup.find("p"))

    def test_removes_nav_header_footer(self):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(
            "<nav>nav</nav><header>hdr</header><footer>ftr</footer><main>content</main>",
            "lxml"
        )
        _normalize_html(soup)
        for tag in ["nav", "header", "footer"]:
            self.assertIsNone(soup.find(tag))
        self.assertIsNotNone(soup.find("main"))

    def test_removes_ad_class(self):
        from bs4 import BeautifulSoup
        soup = BeautifulSoup('<div class="ad-banner">ad</div><p>text</p>', "lxml")
        _normalize_html(soup)
        self.assertIsNone(soup.find(class_="ad-banner"))


class TestNewCrawlJob(unittest.TestCase):
    def test_shape(self):
        job = _new_crawl_job("forum_x", "http://x.onion/leaks/")
        self.assertEqual(job["forum_id"], "forum_x")
        self.assertEqual(job["section_url"], "http://x.onion/leaks/")
        self.assertEqual(job["status"], "running")
        self.assertIsNone(job["finished_at"])
        self.assertIn("started_at", job)
        self.assertTrue(job["id"].startswith("forum_x_"))


class TestLoadConfig(unittest.TestCase):
    def test_loads_forums_yaml(self):
        config_path = Path(__file__).parent.parent / "config" / "forums.yaml"
        if not config_path.exists():
            self.skipTest("forums.yaml not found")
        forums, defaults = load_config(config_path)
        self.assertIsInstance(forums, list)
        self.assertGreater(len(forums), 0)
        self.assertIsInstance(defaults, dict)
        for f in forums:
            self.assertIn("id", f)
            self.assertIn("selectors", f)

    def test_enabled_filter(self):
        import yaml
        with tempfile.NamedTemporaryFile(mode="w", suffix=".yaml", delete=False) as f:
            yaml.dump({
                "forums": [
                    {"id": "a", "enabled": True, "selectors": {}},
                    {"id": "b", "enabled": False, "selectors": {}},
                ],
                "defaults": {}
            }, f)
            fname = f.name
        try:
            forums, _ = load_config(Path(fname))
            ids = [f["id"] for f in forums]
            self.assertIn("a", ids)
            self.assertNotIn("b", ids)
        finally:
            os.unlink(fname)


class TestParsePostElement(unittest.TestCase):
    def _make_collector(self):
        cfg = _mock_forum_config()
        with patch("darknet_forum_collector_authenticated.TorManager"):
            collector = AuthenticatedForumCollector.__new__(AuthenticatedForumCollector)
            collector.forum = cfg
            collector.forum_id = cfg["id"]
            collector.base_url = cfg["base_url"]
            collector.sel = cfg["selectors"]
            collector._seen_hashes = set()
        return collector

    def test_returns_none_without_title(self):
        from bs4 import BeautifulSoup
        collector = self._make_collector()
        el = BeautifulSoup('<div class="post"><span class="author">bob</span></div>', "lxml")
        result = collector._parse_post_element(el.find("div"), "http://x.onion/", "job1")
        self.assertIsNone(result)

    def test_extracts_title_and_author(self):
        from bs4 import BeautifulSoup
        html = """
        <div class="post">
          <h2 class="title"><a href="/thread/1">Leak: ACME Corp DB</a></h2>
          <span class="author">hacker99</span>
          <time datetime="2024-06-01T12:00:00">June 1</time>
          <div class="body">500k records exposed</div>
        </div>
        """
        collector = self._make_collector()
        el = BeautifulSoup(html, "lxml").find("div", class_="post")
        result = collector._parse_post_element(el, "http://x.onion/", "job42")
        self.assertIsNotNone(result)
        self.assertEqual(result["title"], "Leak: ACME Corp DB")
        self.assertEqual(result["author"], "hacker99")
        self.assertEqual(result["timestamp"], "2024-06-01T12:00:00")
        self.assertIn("500k records", result["body_preview"])
        self.assertEqual(result["crawl_job_id"], "job42")
        self.assertEqual(len(result["content_hash"]), 64)

    def test_dedup_is_new(self):
        collector = self._make_collector()
        collector._seen_hashes = {"abc123"}
        self.assertTrue(collector._is_new("xyz789"))
        self.assertFalse(collector._is_new("abc123"))
        self.assertFalse(collector._is_new(""))

    def test_extract_next_url(self):
        from bs4 import BeautifulSoup
        collector = self._make_collector()
        html = '<a class="next" href="/page/2">Next</a>'
        soup = BeautifulSoup(html, "lxml")
        url = collector._extract_next_url(soup)
        self.assertEqual(url, "http://testforum.onion/page/2")

    def test_extract_next_url_none_when_missing(self):
        from bs4 import BeautifulSoup
        collector = self._make_collector()
        soup = BeautifulSoup("<p>no next</p>", "lxml")
        self.assertIsNone(collector._extract_next_url(soup))


# ===========================================================================
# _inject_credentials_to_env
# ===========================================================================

class TestInjectCredentialsToEnv(unittest.TestCase):
    def _make_collector(self):
        cfg = _mock_forum_config()
        # auth.fields: username → ${TEST_USER}, password → ${TEST_PASS}
        with patch("darknet_forum_collector_authenticated.TorManager"):
            collector = AuthenticatedForumCollector.__new__(AuthenticatedForumCollector)
            collector.forum = cfg
            collector.forum_id = cfg["id"]
            collector.base_url = cfg["base_url"]
            collector.sel = cfg["selectors"]
            collector._seen_hashes = set()
        return collector

    def test_injects_username_and_password(self):
        collector = self._make_collector()
        # Remove env vars so setdefault actually sets them
        os.environ.pop("TEST_USER", None)
        os.environ.pop("TEST_PASS", None)
        creds = {"username": "gen_user42", "password": "Gen!Pass99", "email": "gen@x.com"}
        collector._inject_credentials_to_env(creds)
        self.assertEqual(os.environ.get("TEST_USER"), "gen_user42")
        self.assertEqual(os.environ.get("TEST_PASS"), "Gen!Pass99")
        # Cleanup
        os.environ.pop("TEST_USER", None)
        os.environ.pop("TEST_PASS", None)

    def test_does_not_override_existing_env_var(self):
        collector = self._make_collector()
        os.environ["TEST_USER"] = "real_user"
        creds = {"username": "generated_user", "password": "x"}
        collector._inject_credentials_to_env(creds)
        # setdefault must not overwrite an existing value
        self.assertEqual(os.environ.get("TEST_USER"), "real_user")
        os.environ.pop("TEST_USER", None)

    def test_no_inject_when_generation_disabled(self):
        collector = self._make_collector()
        os.environ.pop("TEST_USER", None)
        # _maybe_register_account returns None when disabled → no inject called
        with patch("darknet_forum_collector_authenticated.AccountRegistrar") as MockReg:
            result = collector._maybe_register_account()
        self.assertIsNone(result)
        MockReg.assert_not_called()
        self.assertNotIn("TEST_USER", os.environ)


if __name__ == "__main__":
    unittest.main(verbosity=2)
