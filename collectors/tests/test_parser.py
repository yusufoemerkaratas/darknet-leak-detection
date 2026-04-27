# collectors/tests/test_parser.py
#
# Acceptance criteria:
#  1.  Forum parser extracts: title, body, author, timestamp, URL
#  2.  Paste parser extracts: title, body, language, code detection
#  3.  HTML cleaning removes scripts, styles, ads
#  4.  Encoding detection handles UTF-8, latin-1, other
#  5.  Language detection working (langdetect)
#  6.  Exact deduplication via SHA-256
#  7.  Fuzzy deduplication detects 80%+ similar content
#  8.  200+ documents parsed and stored (mocked batch)
#  9.  ParsedDocument schema consistent between parsers
# 10.  Error logging: all failures logged with context
# 11.  Noise filtering removes obvious spam

import sys
import logging
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from parser import (
    ParsedDocument,
    ForumParser,
    PasteParser,
    ParserSelector,
    HtmlCleaner,
    LanguageDetector,
    CodeDetector,
    NoiseFilter,
    ExactDeduplicator,
    FuzzyDeduplicator,
    _sha256,
    _detect_encoding,
    _decode,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _forum_doc(**kwargs) -> dict:
    base = {
        "source_type":    "forum",
        "title":          "ACME Corp 500k user database leak",
        "full_body_text": "Username, password, email exposed. 500k records from ACME Corp.",
        "author":         "darkuser99",
        "timestamp":      "2026-04-01T12:00:00",
        "thread_url":     "http://forum.onion/thread/123",
        "source_url":     "http://forum.onion/",
        "encoding":       "utf-8",
    }
    base.update(kwargs)
    return base


def _paste_doc(**kwargs) -> dict:
    base = {
        "source_type":    "paste_site",
        "title":          "Leaked credentials",
        "full_body_text": "admin:password123\nroot:toor\nuser@example.com:secret",
        "author":         "anon",
        "timestamp":      "2026-04-10T08:00:00",
        "thread_url":     "https://pastebin.com/ABCD1234",
        "source_url":     "https://pastebin.com/archive",
        "encoding":       "utf-8",
        "category":       "text",
    }
    base.update(kwargs)
    return base


# ===========================================================================
# Criterion 1: Forum parser extracts title, body, author, timestamp, URL
# ===========================================================================

class TestForumParser(unittest.TestCase):
    def setUp(self):
        self.parser = ForumParser()

    def test_extracts_all_required_fields(self):
        doc = self.parser.parse(_forum_doc())
        self.assertIsNotNone(doc)
        self.assertEqual(doc.title, "ACME Corp 500k user database leak")
        self.assertIn("ACME Corp", doc.body)
        self.assertEqual(doc.author, "darkuser99")
        self.assertEqual(doc.timestamp, "2026-04-01T12:00:00")
        self.assertEqual(doc.url, "http://forum.onion/thread/123")

    def test_source_type_is_forum(self):
        doc = self.parser.parse(_forum_doc())
        self.assertEqual(doc.source_type, "forum")

    def test_title_truncated_at_255(self):
        long_title = "A" * 300
        doc = self.parser.parse(_forum_doc(title=long_title))
        self.assertLessEqual(len(doc.title), 255)

    def test_fallback_author_anonymous(self):
        doc = self.parser.parse(_forum_doc(author=""))
        self.assertEqual(doc.author, "anonymous")

    def test_fallback_title_untitled(self):
        doc = self.parser.parse(_forum_doc(title=""))
        self.assertEqual(doc.title, "Untitled")

    def test_uses_body_preview_fallback(self):
        raw = _forum_doc()
        del raw["full_body_text"]
        raw["body_preview"] = "Preview content here"
        doc = self.parser.parse(raw)
        self.assertIsNotNone(doc)
        self.assertIn("Preview", doc.body)

    def test_empty_body_returns_none(self):
        doc = self.parser.parse(_forum_doc(full_body_text=""))
        self.assertIsNone(doc)

    def test_parsed_at_is_iso_format(self):
        doc = self.parser.parse(_forum_doc())
        self.assertIn("T", doc.parsed_at)
        self.assertIn("+", doc.parsed_at)

    def test_content_hash_is_sha256(self):
        doc = self.parser.parse(_forum_doc())
        self.assertEqual(len(doc.content_hash), 64)
        self.assertTrue(all(c in "0123456789abcdef" for c in doc.content_hash))


# ===========================================================================
# Criterion 2: Paste parser extracts title, body, language, code detection
# ===========================================================================

class TestPasteParser(unittest.TestCase):
    def setUp(self):
        self.parser = PasteParser()

    def test_extracts_title_body_author_timestamp_url(self):
        doc = self.parser.parse(_paste_doc())
        self.assertIsNotNone(doc)
        self.assertEqual(doc.title, "Leaked credentials")
        self.assertIn("admin", doc.body)
        self.assertEqual(doc.author, "anon")
        self.assertEqual(doc.timestamp, "2026-04-10T08:00:00")
        self.assertEqual(doc.url, "https://pastebin.com/ABCD1234")

    def test_source_type_is_paste(self):
        doc = self.parser.parse(_paste_doc())
        self.assertEqual(doc.source_type, "paste")

    def test_code_detected_from_category_python(self):
        doc = self.parser.parse(_paste_doc(
            category="Python",
            full_body_text="def hello():\n    print('world')\n\nhello()",
        ))
        self.assertTrue(doc.is_code)
        self.assertEqual(doc.code_language, "python")

    def test_code_detected_from_category_sql(self):
        doc = self.parser.parse(_paste_doc(
            category="SQL",
            full_body_text="SELECT * FROM users WHERE id = 1;",
        ))
        self.assertTrue(doc.is_code)
        self.assertEqual(doc.code_language, "sql")

    def test_no_code_for_plain_text(self):
        doc = self.parser.parse(_paste_doc(
            category="",
            full_body_text="This is a normal text about a data breach.",
        ))
        self.assertFalse(doc.is_code)

    def test_language_field_present(self):
        doc = self.parser.parse(_paste_doc())
        self.assertIsInstance(doc.language, str)
        self.assertGreater(len(doc.language), 0)

    def test_empty_body_returns_none(self):
        doc = self.parser.parse(_paste_doc(full_body_text=""))
        self.assertIsNone(doc)


# ===========================================================================
# Criterion 3: HTML cleaning removes scripts, styles, ads
# ===========================================================================

class TestHtmlCleaner(unittest.TestCase):

    def test_removes_script_tags(self):
        html = "<div><script>alert('xss')</script><p>Real content</p></div>"
        result = HtmlCleaner.clean(html)
        self.assertNotIn("alert", result)
        self.assertIn("Real content", result)

    def test_removes_style_tags(self):
        html = "<style>.ad { display:none }</style><p>Content</p>"
        result = HtmlCleaner.clean(html)
        self.assertNotIn("display", result)
        self.assertIn("Content", result)

    def test_removes_nav_header_footer(self):
        html = "<nav>Navigation</nav><header>Header</header><main>Main</main><footer>Footer</footer>"
        result = HtmlCleaner.clean(html)
        self.assertNotIn("Navigation", result)
        self.assertNotIn("Header", result)
        self.assertNotIn("Footer", result)
        self.assertIn("Main", result)

    def test_removes_ad_class_elements(self):
        html = '<div class="ad-banner">Buy now!</div><p>Leak data here</p>'
        result = HtmlCleaner.clean(html)
        self.assertNotIn("Buy now", result)
        self.assertIn("Leak data", result)

    def test_removes_sidebar(self):
        html = '<div class="sidebar">Side content</div><article>Article</article>'
        result = HtmlCleaner.clean(html)
        self.assertNotIn("Side content", result)

    def test_empty_html_returns_empty(self):
        self.assertEqual(HtmlCleaner.clean(""), "")
        self.assertEqual(HtmlCleaner.strip_html(""), "")

    def test_strip_html_removes_stray_tags(self):
        text = "Hello <b>world</b>, this is <em>text</em>."
        result = HtmlCleaner.strip_html(text)
        self.assertNotIn("<b>", result)
        self.assertIn("Hello", result)
        self.assertIn("world", result)

    def test_forum_parser_cleans_html_body(self):
        raw = _forum_doc(
            full_body_text="<p>Leak data</p><script>bad()</script><nav>nav</nav>"
        )
        doc = ForumParser().parse(raw)
        self.assertIsNotNone(doc)
        self.assertNotIn("<script>", doc.body)
        self.assertIn("Leak data", doc.body)


# ===========================================================================
# Criterion 4: Encoding detection handles UTF-8, latin-1, other
# ===========================================================================

class TestEncodingDetection(unittest.TestCase):

    def test_utf8_detected(self):
        raw = "Hello world".encode("utf-8")
        enc = _detect_encoding(raw)
        self.assertIn(enc.lower(), ["utf-8", "utf8"])

    def test_latin1_detected(self):
        raw = "café résumé naïve".encode("latin-1")
        enc = _detect_encoding(raw)
        self.assertIsNotNone(enc)
        self.assertIsInstance(enc, str)

    def test_cp1252_decoded(self):
        raw = "naïve".encode("cp1252")
        text, enc = _decode(raw)
        self.assertIsInstance(text, str)
        self.assertGreater(len(text), 0)

    def test_empty_bytes_fallback_utf8(self):
        self.assertEqual(_detect_encoding(b""), "utf-8")

    def test_decode_returns_string_tuple(self):
        text, enc = _decode("hello".encode("utf-8"))
        self.assertEqual(text, "hello")
        self.assertIsInstance(enc, str)

    def test_forum_parser_preserves_encoding_field(self):
        doc = ForumParser().parse(_forum_doc(encoding="latin-1"))
        self.assertEqual(doc.encoding, "latin-1")


# ===========================================================================
# Criterion 5: Language detection (langdetect)
# ===========================================================================

class TestLanguageDetection(unittest.TestCase):

    def test_returns_string(self):
        lang = LanguageDetector.detect("Hello world, this is a test.")
        self.assertIsInstance(lang, str)

    def test_unknown_for_empty(self):
        self.assertEqual(LanguageDetector.detect(""), "unknown")

    def test_unknown_for_short_text(self):
        self.assertEqual(LanguageDetector.detect("hi"), "unknown")

    def test_detects_english(self):
        lang = LanguageDetector.detect(
            "This is a major data breach affecting thousands of users worldwide."
        )
        self.assertIn(lang, ["en", "unknown"])

    def test_detects_german(self):
        lang = LanguageDetector.detect(
            "Dies ist ein Datenleck das viele Benutzer betrifft und sehr gefährlich ist."
        )
        self.assertIn(lang, ["de", "unknown"])

    def test_langdetect_error_returns_unknown(self):
        with patch("parser._LANGDETECT_OK", True), \
             patch("parser._langdetect", side_effect=Exception("fail")):
            result = LanguageDetector.detect("some text to test language detection")
        self.assertEqual(result, "unknown")

    def test_forum_doc_has_language_field(self):
        doc = ForumParser().parse(_forum_doc())
        self.assertIsNotNone(doc.language)

    def test_paste_doc_has_language_field(self):
        doc = PasteParser().parse(_paste_doc())
        self.assertIsNotNone(doc.language)


# ===========================================================================
# Criterion 6: Exact deduplication via SHA-256
# ===========================================================================

class TestExactDeduplication(unittest.TestCase):

    def test_sha256_format(self):
        h = _sha256("test")
        self.assertEqual(len(h), 64)
        self.assertTrue(all(c in "0123456789abcdef" for c in h))

    def test_sha256_deterministic(self):
        self.assertEqual(_sha256("abc"), _sha256("abc"))

    def test_sha256_different_inputs(self):
        self.assertNotEqual(_sha256("aaa"), _sha256("bbb"))

    def test_exact_dedup_marks_second_as_duplicate(self):
        dedup = ExactDeduplicator()
        h = _sha256("same content")
        self.assertFalse(dedup.is_duplicate(h))
        self.assertTrue(dedup.is_duplicate(h))

    def test_exact_dedup_different_content_not_duplicate(self):
        dedup = ExactDeduplicator()
        self.assertFalse(dedup.is_duplicate(_sha256("content A")))
        self.assertFalse(dedup.is_duplicate(_sha256("content B")))

    def test_parsed_docs_have_same_hash_for_same_body(self):
        raw = _forum_doc()
        doc1 = ForumParser().parse(raw)
        doc2 = ForumParser().parse(raw)
        self.assertEqual(doc1.content_hash, doc2.content_hash)


# ===========================================================================
# Criterion 7: Fuzzy deduplication detects 80%+ similar content
# ===========================================================================

class TestFuzzyDeduplication(unittest.TestCase):

    def test_identical_content_is_duplicate(self):
        dedup = FuzzyDeduplicator(threshold=0.80)
        text = "leaked credentials from company database containing 500k records"
        dedup.is_duplicate(text)
        self.assertTrue(dedup.is_duplicate(text))

    def test_80_percent_similar_is_duplicate(self):
        dedup = FuzzyDeduplicator(threshold=0.80)
        base = "leaked credentials from company database " * 10
        similar = "leaked credentials from company database " * 9 + "slightly different end"
        dedup.is_duplicate(base)
        self.assertTrue(dedup.is_duplicate(similar))

    def test_completely_different_not_duplicate(self):
        dedup = FuzzyDeduplicator(threshold=0.80)
        dedup.is_duplicate("hello world this is document one about data leaks")
        self.assertFalse(dedup.is_duplicate(
            "python script select from database insert into table create view"
        ))

    def test_threshold_respected(self):
        dedup_strict  = FuzzyDeduplicator(threshold=0.99)
        dedup_lenient = FuzzyDeduplicator(threshold=0.50)
        text_a = "data breach 500k records email password" * 5
        text_b = "data breach 500k records email password" * 4 + "some extra different text here"
        dedup_strict.is_duplicate(text_a)
        dedup_lenient.is_duplicate(text_a)
        strict_result  = dedup_strict.is_duplicate(text_b)
        lenient_result = dedup_lenient.is_duplicate(text_b)
        self.assertFalse(strict_result)
        self.assertTrue(lenient_result)

    def test_first_document_never_duplicate(self):
        dedup = FuzzyDeduplicator(threshold=0.80)
        self.assertFalse(dedup.is_duplicate("any content whatsoever"))


# ===========================================================================
# Criterion 8: 200+ documents parsed (mocked batch)
# ===========================================================================

class TestBatchParsing(unittest.TestCase):

    def test_200_forum_docs_parsed(self):
        parser = ForumParser()
        docs = []
        for i in range(210):
            raw = _forum_doc(
                title=f"Leak #{i}",
                full_body_text=f"Unique content for document number {i} with enough text to pass.",
                thread_url=f"http://forum.onion/thread/{i}",
            )
            doc = parser.parse(raw)
            if doc:
                docs.append(doc)
        self.assertGreaterEqual(len(docs), 200)

    def test_200_paste_docs_parsed(self):
        parser = PasteParser()
        docs = []
        for i in range(210):
            raw = _paste_doc(
                title=f"Paste #{i}",
                full_body_text=f"admin{i}:password{i}\nuser{i}@example.com:secret{i}",
                thread_url=f"https://pastebin.com/{i:08X}",
            )
            doc = parser.parse(raw)
            if doc:
                docs.append(doc)
        self.assertGreaterEqual(len(docs), 200)

    def test_parser_selector_handles_mixed_batch(self):
        selector = ParserSelector()
        docs = []
        for i in range(105):
            docs.append(selector.parse(_forum_doc(
                full_body_text=f"Forum content {i} with enough text here.",
                thread_url=f"http://f.onion/{i}",
            )))
        for i in range(105):
            docs.append(selector.parse(_paste_doc(
                full_body_text=f"admin{i}:pass{i} user{i}@x.com:pwd{i}",
                thread_url=f"https://pastebin.com/{i}",
            )))
        valid = [d for d in docs if d is not None]
        self.assertGreaterEqual(len(valid), 200)


# ===========================================================================
# Criterion 9: ParsedDocument schema consistent between parsers
# ===========================================================================

class TestSchemaConsistency(unittest.TestCase):

    REQUIRED_FIELDS = [
        "source_type", "title", "body", "author", "timestamp", "url",
        "language", "encoding", "content_hash", "is_code", "code_language",
        "is_spam", "noise_score", "parsed_at",
    ]

    def test_forum_doc_has_all_fields(self):
        doc = ForumParser().parse(_forum_doc())
        d = doc.to_dict()
        for field in self.REQUIRED_FIELDS:
            self.assertIn(field, d, f"Missing field: {field}")

    def test_paste_doc_has_all_fields(self):
        doc = PasteParser().parse(_paste_doc())
        d = doc.to_dict()
        for field in self.REQUIRED_FIELDS:
            self.assertIn(field, d, f"Missing field: {field}")

    def test_field_types_consistent(self):
        forum = ForumParser().parse(_forum_doc())
        paste = PasteParser().parse(_paste_doc())
        self.assertIsInstance(forum.is_code, bool)
        self.assertIsInstance(paste.is_code, bool)
        self.assertIsInstance(forum.noise_score, float)
        self.assertIsInstance(paste.noise_score, float)
        self.assertIsInstance(forum.is_spam, bool)
        self.assertIsInstance(paste.is_spam, bool)

    def test_to_dict_serializable(self):
        import json
        doc = ForumParser().parse(_forum_doc())
        self.assertIsInstance(doc.to_dict(), dict)
        json.dumps(doc.to_dict())  # must not raise


# ===========================================================================
# Criterion 10: Error logging
# ===========================================================================

class TestErrorLogging(unittest.TestCase):

    def test_forum_parser_logs_warning_on_empty_body(self):
        with self.assertLogs("parser", level="WARNING") as cm:
            ForumParser().parse(_forum_doc(full_body_text=""))
        self.assertTrue(any("Empty body" in m for m in cm.output))

    def test_paste_parser_logs_warning_on_empty_body(self):
        with self.assertLogs("parser", level="WARNING") as cm:
            PasteParser().parse(_paste_doc(full_body_text=""))
        self.assertTrue(any("Empty body" in m for m in cm.output))

    def test_forum_parser_logs_error_on_exception(self):
        with self.assertLogs("parser", level="ERROR") as cm:
            with patch("parser.HtmlCleaner.clean", side_effect=RuntimeError("boom")):
                ForumParser().parse(_forum_doc(
                    full_body_text="<p>content with html tag</p>"
                ))
        self.assertTrue(any("Error" in m for m in cm.output))

    def test_parser_returns_none_not_exception(self):
        with patch("parser.HtmlCleaner.clean", side_effect=RuntimeError("boom")):
            result = ForumParser().parse(_forum_doc(full_body_text="<p>x</p>"))
        self.assertIsNone(result)


# ===========================================================================
# Criterion 11: Noise filtering removes obvious spam
# ===========================================================================

class TestNoiseFilter(unittest.TestCase):

    def test_empty_body_is_max_noise(self):
        self.assertEqual(NoiseFilter.score(""), 1.0)

    def test_short_body_high_noise(self):
        score = NoiseFilter.score("hi")
        self.assertGreater(score, 0.4)

    def test_spam_keywords_increase_score(self):
        score_clean = NoiseFilter.score(
            "Database breach with 500k user records including emails and passwords."
        )
        score_spam = NoiseFilter.score(
            "Buy now! Click here! Free offer! Make money fast! Casino online! Viagra! " * 3
        )
        self.assertGreater(score_spam, score_clean)

    def test_clean_content_low_noise(self):
        score = NoiseFilter.score(
            "A major data breach at ACME Corp has exposed 500,000 user records including "
            "email addresses, hashed passwords and personal information. The breach occurred "
            "in March 2026 and was discovered by security researchers."
        )
        self.assertLess(score, 0.3)

    def test_is_spam_true_for_spammy_content(self):
        spam = "Buy now! Click here! Free offer! Make money fast! Casino online! " * 5
        self.assertTrue(NoiseFilter.is_spam(spam))

    def test_is_spam_false_for_clean_content(self):
        clean = (
            "Leaked database containing 500k records from ACME Corp. "
            "Includes usernames, email addresses, and bcrypt password hashes."
        )
        self.assertFalse(NoiseFilter.is_spam(clean))

    def test_forum_parser_marks_spam_in_doc(self):
        spam_body = "Buy now! Click here! Free offer! Make money fast! Casino online! " * 5
        doc = ForumParser().parse(_forum_doc(full_body_text=spam_body))
        self.assertIsNotNone(doc)
        self.assertTrue(doc.is_spam)

    def test_forum_parser_marks_clean_in_doc(self):
        clean = (
            "Large scale database breach containing 500k user records from ACME Corp. "
            "Leaked data includes email addresses, usernames, and password hashes. "
            "Posted on darknet forum in April 2026 by threat actor known as x0x."
        )
        doc = ForumParser().parse(_forum_doc(full_body_text=clean))
        self.assertIsNotNone(doc)
        self.assertFalse(doc.is_spam)


# ===========================================================================
# ParserSelector
# ===========================================================================

class TestParserSelector(unittest.TestCase):

    def test_selects_paste_parser_for_paste_site(self):
        selector = ParserSelector()
        doc = selector.parse(_paste_doc(source_type="paste_site"))
        self.assertIsNotNone(doc)
        self.assertEqual(doc.source_type, "paste")

    def test_selects_paste_parser_for_paste(self):
        selector = ParserSelector()
        doc = selector.parse(_paste_doc(source_type="paste"))
        self.assertEqual(doc.source_type, "paste")

    def test_selects_forum_parser_for_forum(self):
        selector = ParserSelector()
        doc = selector.parse(_forum_doc(source_type="forum"))
        self.assertEqual(doc.source_type, "forum")

    def test_fallback_guesses_paste_when_category_present(self):
        selector = ParserSelector()
        raw = _paste_doc(source_type="unknown_type")
        doc = selector.parse(raw)
        self.assertIsNotNone(doc)

    def test_fallback_guesses_forum_when_no_paste_fields(self):
        selector = ParserSelector()
        raw = _forum_doc(source_type="")
        doc = selector.parse(raw)
        self.assertIsNotNone(doc)


if __name__ == "__main__":
    unittest.main(verbosity=2)
