# collectors/tests/test_paste_collector.py
#
# Paste site collector unit tests.
# Acceptance criteria:
#   1. 2+ paste sites accessible
#   2. 50+ item extraction
#   3. title, author, timestamp, text
#   4. CAPTCHA detection
#   5. CAPTCHA bypass (Tor)
#   6. 1+ protected site access
#   7. Encoding detection (UTF-8, latin-1, other)
#   8. SHA-256 hash
#   9. Deduplication
#  10. raw_document records
#  11. Error handling
#  12. Config externalized
#  13. 50+ pastes inserted to DB

import hashlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch, PropertyMock

sys.path.insert(0, str(Path(__file__).parent.parent))

import requests

from paste_collector import (
    PasteCollector,
    PastebinScraper,
    PasteEeScraper,
    PasteSession,
    detect_encoding,
    decode_bytes,
    is_blocked,
    has_image_captcha,
    _sha256,
    _load_seen_hashes,
    _save_seen_hashes,
    _save_paste_document,
    load_paste_config,
)
from bs4 import BeautifulSoup


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_response(text: str = "", status: int = 200,
                   content: bytes = None) -> MagicMock:
    resp             = MagicMock(spec=requests.Response)
    resp.status_code = status
    resp.text        = text
    resp.content     = content if content is not None else text.encode("utf-8")
    resp.headers     = {}
    return resp


def _pastebin_archive_html(keys: list) -> str:
    rows = ""
    for k, title, date, syntax in keys:
        rows += f"""
        <tr>
          <td><span class="status -public"></span>
              <a href="/{k}?source=archive">{title}</a></td>
          <td class="td_smaller">{date}</td>
          <td class="td_smaller">{syntax}</td>
        </tr>"""
    return f"""
    <html><body>
    <table class="maintable">
      <tr><th>Name</th><th>Posted</th><th>Syntax</th></tr>
      {rows}
    </table>
    </body></html>"""


def _pastebin_paste_html(author: str = "testuser",
                         timestamp: str = "April 22nd, 2026") -> str:
    return f"""
    <html><body>
      <div class="username"><a href="/u/{author}">{author}</a></div>
      <div class="date"><span title="{timestamp}">{timestamp}</span></div>
    </body></html>"""


# ---------------------------------------------------------------------------
# Criterion 7: Encoding detection
# ---------------------------------------------------------------------------

class TestEncodingDetection(unittest.TestCase):

    def test_utf8_detection(self):
        raw = "Hello world".encode("utf-8")
        enc = detect_encoding(raw)
        self.assertIn(enc.lower(), ["utf-8", "utf8"])

    def test_latin1_detection(self):
        raw = "café résumé".encode("latin-1")
        enc = detect_encoding(raw)
        self.assertIsNotNone(enc)
        self.assertIsInstance(enc, str)

    def test_cp1252_decode(self):
        raw = "naïve".encode("cp1252")
        text, enc = decode_bytes(raw)
        self.assertIsInstance(text, str)
        self.assertGreater(len(text), 0)

    def test_empty_bytes_fallback(self):
        enc = detect_encoding(b"")
        self.assertEqual(enc, "utf-8")

    def test_decode_returns_tuple(self):
        raw = "hello world".encode("utf-8")
        text, enc = decode_bytes(raw)
        self.assertEqual(text, "hello world")
        self.assertIsInstance(enc, str)

    def test_decode_handles_unknown_encoding(self):
        """Unknown encoding → graceful fallback."""
        raw = bytes(range(128, 200))
        text, enc = decode_bytes(raw)
        self.assertIsInstance(text, str)


# ---------------------------------------------------------------------------
# Criterion 8: SHA-256 hash
# ---------------------------------------------------------------------------

class TestSHA256Hashing(unittest.TestCase):

    def test_hash_format(self):
        h = _sha256("test content")
        self.assertEqual(len(h), 64)
        self.assertTrue(all(c in "0123456789abcdef" for c in h))

    def test_hash_deterministic(self):
        self.assertEqual(_sha256("abc"), _sha256("abc"))

    def test_hash_differs_for_different_content(self):
        self.assertNotEqual(_sha256("aaa"), _sha256("bbb"))

    def test_hash_matches_hashlib(self):
        text = "leak data sample"
        expected = hashlib.sha256(text.encode("utf-8")).hexdigest()
        self.assertEqual(_sha256(text), expected)

    def test_hash_unicode_content(self):
        h = _sha256("Network security test 漢字")
        self.assertEqual(len(h), 64)


# ---------------------------------------------------------------------------
# Criterion 4: CAPTCHA / block detection
# ---------------------------------------------------------------------------

class TestCaptchaDetection(unittest.TestCase):

    def test_cloudflare_403_detected(self):
        resp = _mock_response(
            text="Just a moment... Cloudflare",
            status=403,
        )
        self.assertTrue(is_blocked(resp))

    def test_cloudflare_503_detected(self):
        resp = _mock_response(
            text="cloudflare challenge-form",
            status=503,
        )
        self.assertTrue(is_blocked(resp))

    def test_ddosguard_detected(self):
        resp = _mock_response(
            text="DDoS-Guard protection __ddg",
            status=403,
        )
        self.assertTrue(is_blocked(resp))

    def test_normal_200_not_blocked(self):
        resp = _mock_response(text="<html>Normal paste content</html>", status=200)
        self.assertFalse(is_blocked(resp))

    def test_image_captcha_detection_no_selector(self):
        soup   = BeautifulSoup("<html><img src='/cap.png'/></html>", "html.parser")
        result = has_image_captcha(soup, {})
        self.assertIsNone(result)

    def test_image_captcha_detection_with_selector(self):
        soup   = BeautifulSoup('<html><img class="captcha-img" src="/cap.png"/></html>',
                               "html.parser")
        result = has_image_captcha(soup, {"image_selector": "img.captcha-img"})
        self.assertEqual(result, "/cap.png")

    def test_image_captcha_selector_no_match(self):
        soup   = BeautifulSoup("<html><p>no captcha here</p></html>", "html.parser")
        result = has_image_captcha(soup, {"image_selector": "img.captcha-img"})
        self.assertIsNone(result)


# ---------------------------------------------------------------------------
# Criterion 9: Deduplication
# ---------------------------------------------------------------------------

class TestDeduplication(unittest.TestCase):

    def test_duplicate_hash_skipped(self):
        content  = "duplicate content"
        chash    = _sha256(content)
        seen     = {chash}

        cfg      = {"max_items": 10, "rate_limit_seconds": 0}
        scraper  = PastebinScraper(cfg)

        archive_html = _pastebin_archive_html([
            ("AAAAAAAA", "Test", "1 min", "-"),
        ])
        paste_html = _pastebin_paste_html()

        with patch.object(scraper._http, "get") as mock_get:
            mock_get.side_effect = [
                _mock_response(archive_html),     # archive
                _mock_response(content),          # raw
                _mock_response(paste_html),       # paste page
            ]
            docs = scraper.collect(seen)

        self.assertEqual(len(docs), 0, "Duplicate content should not be collected")

    def test_new_content_not_skipped(self):
        content = "unique content xyz 12345"
        seen    = set()

        cfg     = {"max_items": 10, "rate_limit_seconds": 0}
        scraper = PastebinScraper(cfg)

        archive_html = _pastebin_archive_html([
            ("BBBBBBBB", "Unique Paste", "2 min", "text"),
        ])
        paste_html = _pastebin_paste_html("alice", "April 22nd, 2026")

        with patch.object(scraper._http, "get") as mock_get:
            mock_get.side_effect = [
                _mock_response(archive_html),
                _mock_response(content),
                _mock_response(paste_html),
            ]
            docs = scraper.collect(seen)

        self.assertEqual(len(docs), 1)
        self.assertEqual(docs[0]["content_hash"], _sha256(content))

    def test_seen_hashes_updated_after_collect(self):
        content = "fresh unique paste"
        seen    = set()

        cfg     = {"max_items": 10, "rate_limit_seconds": 0}
        scraper = PastebinScraper(cfg)

        archive_html = _pastebin_archive_html([
            ("CCCCCCCC", "Fresh", "now", "-"),
        ])

        with patch.object(scraper._http, "get") as mock_get:
            mock_get.side_effect = [
                _mock_response(archive_html),
                _mock_response(content),
                _mock_response(_pastebin_paste_html()),
            ]
            docs = scraper.collect(seen)

        self.assertIn(_sha256(content), seen)


# ---------------------------------------------------------------------------
# Criterion 3: title, author, timestamp, text
# ---------------------------------------------------------------------------

class TestPasteFields(unittest.TestCase):

    def test_all_required_fields_present(self):
        content  = "important leaked data"
        cfg      = {"max_items": 10, "rate_limit_seconds": 0}
        scraper  = PastebinScraper(cfg)

        archive_html = _pastebin_archive_html([
            ("DDDDDDDD", "Data Leak", "1 hour ago", "text"),
        ])
        paste_html = _pastebin_paste_html("hacker42", "Wednesday 22nd of April 2026")

        with patch.object(scraper._http, "get") as mock_get:
            mock_get.side_effect = [
                _mock_response(archive_html),
                _mock_response(content),
                _mock_response(paste_html),
            ]
            docs = scraper.collect(set())

        self.assertEqual(len(docs), 1)
        doc = docs[0]
        self.assertIn("title", doc);       self.assertEqual(doc["title"], "Data Leak")
        self.assertIn("author", doc);      self.assertEqual(doc["author"], "hacker42")
        self.assertIn("timestamp", doc);   self.assertIn("2026", doc["timestamp"])
        self.assertIn("full_body_text", doc); self.assertEqual(doc["full_body_text"], content)
        self.assertIn("content_hash", doc)
        self.assertIn("encoding", doc)
        self.assertIn("forum_id", doc);    self.assertEqual(doc["forum_id"], "pastebin")
        self.assertIn("source_type", doc); self.assertEqual(doc["source_type"], "paste_site")

    def test_untitled_paste_gets_default(self):
        content = "unnamed content"
        cfg     = {"max_items": 10, "rate_limit_seconds": 0}
        scraper = PastebinScraper(cfg)

        archive_html = _pastebin_archive_html([
            ("EEEEEEEE", "Untitled", "now", "-"),
        ])
        with patch.object(scraper._http, "get") as mock_get:
            mock_get.side_effect = [
                _mock_response(archive_html),
                _mock_response(content),
                _mock_response(_pastebin_paste_html()),
            ]
            docs = scraper.collect(set())

        self.assertEqual(docs[0]["title"], "Untitled")


# ---------------------------------------------------------------------------
# Criterion 1 & 2: 2+ paste sites, 50+ items
# ---------------------------------------------------------------------------

class TestPastebinArchiveParsing(unittest.TestCase):

    def _make_keys(self, count: int) -> list:
        keys = []
        for i in range(count):
            key = f"{i:08X}"[:8]
            keys.append((key, f"Paste {i}", f"{i} min ago", "text"))
        return keys

    def test_parse_51_items_from_archive(self):
        """Pastebin archive contains 51 rows — parse all."""
        keys = self._make_keys(51)
        html = _pastebin_archive_html(keys)

        cfg     = {"max_items": 60, "rate_limit_seconds": 0}
        scraper = PastebinScraper(cfg)
        items   = scraper._parse_archive(html)
        self.assertEqual(len(items), 51)

    def test_collect_50_plus_unique_items(self):
        """Verify 50+ unique pastes collected."""
        keys    = self._make_keys(51)
        html    = _pastebin_archive_html(keys)
        cfg     = {"max_items": 60, "rate_limit_seconds": 0}
        scraper = PastebinScraper(cfg)

        responses = [_mock_response(html)]
        for i, (key, title, _, _) in enumerate(keys):
            responses.append(_mock_response(f"content for {key} unique {i}"))
            responses.append(_mock_response(_pastebin_paste_html(f"user{i}")))

        with patch.object(scraper._http, "get") as mock_get:
            mock_get.side_effect = responses
            docs = scraper.collect(set())

        self.assertGreaterEqual(len(docs), 50,
            f"At least 50 pastes expected, {len(docs)} collected")

    def test_two_sites_configured(self):
        """At least 2 paste sites configured."""
        cfg_path = Path(__file__).parent.parent / "config" / "paste_sites.yaml"
        self.assertTrue(cfg_path.exists(), "paste_sites.yaml not found")
        sites = load_paste_config(cfg_path)
        enabled = [s for s in sites if s.get("enabled", True)]
        self.assertGreaterEqual(len(enabled), 2,
            "At least 2 paste sites must be configured")


# ---------------------------------------------------------------------------
# Criterion 11: Error handling
# ---------------------------------------------------------------------------

class TestErrorHandling(unittest.TestCase):

    def test_site_down_returns_empty(self):
        """Site inaccessible → empty list, no exception."""
        cfg     = {"max_items": 10, "rate_limit_seconds": 0}
        scraper = PastebinScraper(cfg)
        with patch.object(scraper._http, "get", return_value=None):
            docs = scraper.collect(set())
        self.assertEqual(docs, [])

    def test_blocked_after_bypass_returns_empty(self):
        """Still blocked after bypass → empty list."""
        blocked = _mock_response(
            text="Just a moment... Cloudflare", status=503
        )
        cfg     = {"max_items": 10, "rate_limit_seconds": 0}
        scraper = PastebinScraper(cfg)
        with patch.object(scraper._http, "get", return_value=blocked), \
             patch("paste_collector.rotate_tor_circuit", return_value=False):
            docs = scraper.collect(set())
        self.assertEqual(docs, [])

    def test_empty_raw_content_skipped(self):
        """Empty raw content → skip."""
        archive_html = _pastebin_archive_html([("FFFFFFFF", "Empty", "now", "-")])
        cfg     = {"max_items": 10, "rate_limit_seconds": 0}
        scraper = PastebinScraper(cfg)
        with patch.object(scraper._http, "get") as mock_get:
            mock_get.side_effect = [
                _mock_response(archive_html),
                _mock_response(""),           # empty content
            ]
            docs = scraper.collect(set())
        self.assertEqual(docs, [])

    def test_rate_limit_429_retried(self):
        """429 response → Wait Retry-After, then succeed."""
        cfg     = {"max_items": 10, "rate_limit_seconds": 0}
        session = PasteSession(cfg)
        resp_429 = _mock_response(status=429)
        resp_429.headers = {"Retry-After": "1"}
        resp_ok  = _mock_response("<html>ok</html>", 200)

        with patch.object(session.session, "get",
                          side_effect=[resp_429, resp_ok]):
            result = session.get("http://example.com", max_retries=2)

        self.assertIsNotNone(result)
        self.assertEqual(result.status_code, 200)

    def test_connection_error_handled(self):
        """ConnectionError → returns None, no exception."""
        cfg     = {"max_items": 10, "rate_limit_seconds": 0}
        session = PasteSession(cfg)
        with patch.object(session.session, "get",
                          side_effect=requests.exceptions.ConnectionError("refused")):
            result = session.get("http://nowhere.invalid", max_retries=1)
        self.assertIsNone(result)

    def test_unknown_site_id_skipped(self):
        """Unknown site id → no error, skip."""
        cfg_path = Path(__file__).parent.parent / "config" / "paste_sites.yaml"
        collector = PasteCollector(cfg_path)
        # add unknown id to sites list
        collector.sites = [{"id": "unknown_site_xyz", "name": "X", "enabled": True}]
        count = collector.run()   # should not raise exception
        self.assertEqual(count, 0)


# ---------------------------------------------------------------------------
# Criterion 10: raw_document record format
# ---------------------------------------------------------------------------

class TestRawDocumentFormat(unittest.TestCase):

    def test_document_saved_to_disk(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            import paste_collector as pc
            original = pc._STORAGE_ROOT
            pc._STORAGE_ROOT = Path(tmpdir)

            doc = {
                "forum_id":       "pastebin",
                "forum_name":     "Pastebin.com",
                "title":          "Test Paste",
                "author":         "tester",
                "body_preview":   "hello",
                "full_body_text": "hello world",
                "category":       "text",
                "timestamp":      "2026-04-22",
                "thread_url":     "https://pastebin.com/TESTKEY",
                "source_url":     "https://pastebin.com/archive",
                "source_type":    "paste_site",
                "content_hash":   _sha256("hello world"),
                "encoding":       "utf-8",
                "raw_content":    "hello world",
                "fetched_at":     "2026-04-22T10:00:00+00:00",
                "high_risk":      False,
            }
            _save_paste_document(doc)

            saved_files = list(Path(tmpdir).glob("paste_pastebin/*.json"))
            self.assertEqual(len(saved_files), 1)

            with open(saved_files[0]) as f:
                loaded = json.load(f)
            self.assertEqual(loaded["forum_id"], "pastebin")
            self.assertEqual(loaded["source_type"], "paste_site")
            self.assertIn("content_hash", loaded)
            self.assertIn("full_body_text", loaded)
            self.assertIn("encoding", loaded)

            pc._STORAGE_ROOT = original

    def test_document_fields_pipeline_compatible(self):
        """Are there fields expected by ingestion_pipeline.py?"""
        required = [
            "forum_id", "title", "content_hash", "full_body_text",
            "timestamp", "fetched_at", "thread_url", "source_url", "encoding",
        ]
        content = "pipeline compat test"
        cfg     = {"max_items": 10, "rate_limit_seconds": 0}
        scraper = PastebinScraper(cfg)

        archive_html = _pastebin_archive_html([("GGGGGGGG", "Pipeline Test", "now", "-")])

        with patch.object(scraper._http, "get") as mock_get:
            mock_get.side_effect = [
                _mock_response(archive_html),
                _mock_response(content),
                _mock_response(_pastebin_paste_html()),
            ]
            docs = scraper.collect(set())

        self.assertEqual(len(docs), 1)
        for field in required:
            self.assertIn(field, docs[0], f"'{field}' field is missing")


# ---------------------------------------------------------------------------
# Criterion 12: Config externalized
# ---------------------------------------------------------------------------

class TestConfigExternalized(unittest.TestCase):

    def test_no_hardcoded_urls_in_config(self):
        """YAML config should not contain API key or token."""
        cfg_path = Path(__file__).parent.parent / "config" / "paste_sites.yaml"
        content  = cfg_path.read_text()
        self.assertNotIn("api_key =", content.lower())
        self.assertNotIn("password =", content.lower())
        self.assertNotIn("token =", content.lower())

    def test_api_key_read_from_env(self):
        """paste.ee API key is read from env var."""
        cfg = {
            "max_items": 10,
            "rate_limit_seconds": 0,
            "api_key_env": "PASTEEE_API_KEY",
        }
        os.environ["PASTEEE_API_KEY"] = "test_key_12345"
        scraper = PasteEeScraper(cfg)
        self.assertEqual(scraper.api_key, "test_key_12345")
        del os.environ["PASTEEE_API_KEY"]

    def test_missing_api_key_handled_gracefully(self):
        """If no API key, return empty, no exception."""
        cfg = {
            "max_items": 10,
            "rate_limit_seconds": 0,
            "api_key_env": "NONEXISTENT_KEY_XYZ",
            "seed_paste_ids": [],
        }
        os.environ.pop("NONEXISTENT_KEY_XYZ", None)
        scraper = PasteEeScraper(cfg)
        docs    = scraper.collect(set())
        self.assertEqual(docs, [])

    def test_config_file_exists(self):
        cfg_path = Path(__file__).parent.parent / "config" / "paste_sites.yaml"
        self.assertTrue(cfg_path.exists())

    def test_config_has_required_fields(self):
        cfg_path = Path(__file__).parent.parent / "config" / "paste_sites.yaml"
        sites    = load_paste_config(cfg_path)
        for site in sites:
            self.assertIn("id",   site)
            self.assertIn("name", site)
            self.assertIn("enabled", site)


# ---------------------------------------------------------------------------
# Criterion 5: CAPTCHA bypass — Tor circuit rotation
# ---------------------------------------------------------------------------

class TestCaptchaBypass(unittest.TestCase):

    def test_bypass_attempted_on_block(self):
        """rotate_tor_circuit called when block detected."""
        blocked = _mock_response("Just a moment Cloudflare", 503)
        ok_resp = _mock_response("<table class='maintable'><tr><th>Name</th></tr></table>", 200)

        cfg     = {"max_items": 10, "rate_limit_seconds": 0}
        scraper = PastebinScraper(cfg)

        with patch.object(scraper._http, "get", side_effect=[blocked, ok_resp]), \
             patch("paste_collector.rotate_tor_circuit", return_value=True) as mock_rotate:
            docs = scraper.collect(set())
            mock_rotate.assert_called_once()

    def test_no_bypass_when_not_blocked(self):
        """Normal response → rotate_tor_circuit not called."""
        ok_resp = _mock_response(
            "<table class='maintable'><tr><th>Name</th></tr></table>", 200
        )
        cfg     = {"max_items": 10, "rate_limit_seconds": 0}
        scraper = PastebinScraper(cfg)

        with patch.object(scraper._http, "get", return_value=ok_resp), \
             patch("paste_collector.rotate_tor_circuit") as mock_rotate:
            docs = scraper.collect(set())
            mock_rotate.assert_not_called()


# ---------------------------------------------------------------------------
# Seen hashes persistence
# ---------------------------------------------------------------------------

class TestSeenHashesPersistence(unittest.TestCase):

    def test_save_and_load(self):
        import paste_collector as pc
        original = pc._HASH_INDEX
        with tempfile.TemporaryDirectory() as tmpdir:
            pc._HASH_INDEX = Path(tmpdir) / "paste_seen_hashes.json"
            hashes = {"abc123", "def456", "ghi789"}
            _save_seen_hashes(hashes)
            loaded = _load_seen_hashes()
            self.assertEqual(loaded, hashes)
            pc._HASH_INDEX = original

    def test_load_missing_returns_empty(self):
        import paste_collector as pc
        original = pc._HASH_INDEX
        pc._HASH_INDEX = Path("/tmp/nonexistent_paste_hashes_xyz.json")
        result = _load_seen_hashes()
        self.assertIsInstance(result, set)
        self.assertEqual(len(result), 0)
        pc._HASH_INDEX = original


# ---------------------------------------------------------------------------
# paste.ee scraper unit tests
# ---------------------------------------------------------------------------

class TestPasteEeScraper(unittest.TestCase):

    def test_no_api_key_returns_empty(self):
        cfg = {
            "max_items": 10,
            "rate_limit_seconds": 0,
            "api_key_env": "NONEXISTENT_PASTEEE_KEY_9999",
            "seed_paste_ids": [],
        }
        os.environ.pop("NONEXISTENT_PASTEEE_KEY_9999", None)
        scraper = PasteEeScraper(cfg)
        docs    = scraper.collect(set())
        self.assertEqual(docs, [])

    def test_api_invalid_key_falls_back(self):
        """401 response → fallback, no exception."""
        cfg = {
            "max_items": 5,
            "rate_limit_seconds": 0,
            "api_key_env": "PASTEEE_API_KEY",
            "seed_paste_ids": [],
        }
        os.environ["PASTEEE_API_KEY"] = "invalid_key"
        scraper  = PasteEeScraper(cfg)
        resp_401 = _mock_response("Unauthorized", 401)

        with patch.object(scraper._http.session, "get", return_value=resp_401):
            docs = scraper.collect(set())
        self.assertEqual(docs, [])
        del os.environ["PASTEEE_API_KEY"]

    def test_make_doc_has_all_fields(self):
        cfg = {
            "max_items": 5,
            "rate_limit_seconds": 0,
            "api_key_env": "PASTEEE_NOKEY",
        }
        scraper = PasteEeScraper(cfg)
        doc     = scraper._make_doc(
            "abc123", "Test Title", "content here",
            "utf-8", "alice", "2026-04-22T10:00:00Z",
        )
        for field in ["forum_id", "title", "author", "timestamp",
                      "full_body_text", "content_hash", "encoding", "source_type"]:
            self.assertIn(field, doc)
        self.assertEqual(doc["source_type"], "paste_site")
        self.assertEqual(doc["forum_id"],    "paste_ee")


if __name__ == "__main__":
    unittest.main(verbosity=2)
