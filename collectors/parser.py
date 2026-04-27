# collectors/parser.py
#
# Parsing pipeline: raw collector output → normalized ParsedDocument
#
# Components:
#   ForumParser   — title, body, author, timestamp, URL extraction
#   PasteParser   — title, body, language hint, code detection
#   HtmlCleaner   — removes scripts, styles, ads, nav
#   LanguageDetector — langdetect-based ISO 639-1 detection
#   CodeDetector  — heuristic code + programming language detection
#   NoiseFilter   — spam and short-content scoring
#   ExactDeduplicator  — SHA-256
#   FuzzyDeduplicator  — SequenceMatcher ≥ 0.80 similarity
#   ParserSelector — auto-picks parser from source_type

import hashlib
import logging
import re
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Optional

import chardet
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

try:
    from langdetect import detect as _langdetect
    _LANGDETECT_OK = True
except ImportError:
    _LANGDETECT_OK = False
    logger.warning("[parser] langdetect not installed — pip install langdetect")


# ---------------------------------------------------------------------------
# ParsedDocument schema
# ---------------------------------------------------------------------------

@dataclass
class ParsedDocument:
    source_type:   str    # "forum" | "paste"
    title:         str
    body:          str    # cleaned plain text
    author:        str
    timestamp:     str
    url:           str
    language:      str    # ISO 639-1 ("en", "de", "ru", "unknown")
    encoding:      str
    content_hash:  str    # SHA-256 of cleaned body
    is_code:       bool
    code_language: str    # programming language or ""
    is_spam:       bool
    noise_score:   float  # 0.0–1.0
    parsed_at:     str    # ISO 8601

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# HTML Cleaner
# ---------------------------------------------------------------------------

_NOISE_TAGS = {"script", "style", "nav", "header", "footer", "aside", "iframe", "noscript"}
_NOISE_CLASS_RE = re.compile(
    r"ad[-_]|banner|cookie|popup|sidebar|social|share|promo|newsletter|widget",
    re.IGNORECASE,
)


class HtmlCleaner:
    @staticmethod
    def clean(html: str) -> str:
        """Full HTML parse: remove noise tags/classes, return plain text."""
        if not html:
            return ""
        try:
            soup = BeautifulSoup(html, "lxml")
        except Exception:
            soup = BeautifulSoup(html, "html.parser")

        for tag in soup.find_all(_NOISE_TAGS):
            tag.decompose()

        for tag in soup.find_all(True):
            classes = " ".join(tag.get("class", []))
            if _NOISE_CLASS_RE.search(classes):
                tag.decompose()

        return soup.get_text(separator="\n", strip=True)

    @staticmethod
    def strip_html(text: str) -> str:
        """Light strip for plain-text content that may contain stray HTML."""
        return BeautifulSoup(text, "html.parser").get_text(separator=" ", strip=True)


# ---------------------------------------------------------------------------
# Language Detector
# ---------------------------------------------------------------------------

class LanguageDetector:
    @staticmethod
    def detect(text: str) -> str:
        if not _LANGDETECT_OK or not text or len(text.strip()) < 20:
            return "unknown"
        try:
            return _langdetect(text[:2000])
        except Exception:
            return "unknown"


# ---------------------------------------------------------------------------
# Code Detector
# ---------------------------------------------------------------------------

_CODE_PATTERNS = [
    r"\bdef\s+\w+\s*\(",          # Python function
    r"\bimport\s+\w+",            # Python import
    r"\bclass\s+\w+[\s:(]",       # Python/Java class
    r"\bSELECT\b.{1,60}\bFROM\b", # SQL
    r"\bINSERT\s+INTO\b",
    r"\bCREATE\s+TABLE\b",
    r"<\?php",                    # PHP
    r"\bfunction\s+\w+\s*\(",     # JS/PHP function
    r"\bconst\s+\w+\s*=",        # JS const
    r"\bvar\s+\w+\s*=",
]
_CODE_RE = [re.compile(p, re.MULTILINE | re.IGNORECASE) for p in _CODE_PATTERNS]

_LANG_MAP = {
    "python": "python", "py": "python",
    "sql": "sql", "mysql": "sql", "postgresql": "sql", "sqlite": "sql",
    "php": "php",
    "javascript": "javascript", "js": "javascript",
    "typescript": "typescript", "ts": "typescript",
    "bash": "bash", "shell": "bash", "sh": "bash",
    "ruby": "ruby", "java": "java", "go": "go",
    "c#": "csharp", "csharp": "csharp",
    "c++": "cpp", "cpp": "cpp",
    "html": "html", "xml": "xml",
    "json": "json", "yaml": "yaml",
    "powershell": "powershell",
}


class CodeDetector:
    @staticmethod
    def detect(text: str, category_hint: str = "") -> tuple:
        """Returns (is_code: bool, code_language: str)."""
        hint = _LANG_MAP.get(category_hint.lower().strip(), "")
        if hint:
            return True, hint

        if not text:
            return False, ""

        special = sum(1 for c in text if c in "{}()[];=<>/\\|@#$%")
        if special / max(len(text), 1) > 0.08:
            return True, ""

        matches = sum(1 for p in _CODE_RE if p.search(text[:3000]))
        if matches >= 2:
            return True, ""

        return False, ""


# ---------------------------------------------------------------------------
# Noise Filter
# ---------------------------------------------------------------------------

_SPAM_RE = re.compile(
    r"buy now|click here|free offer|make money|earn \$|casino online"
    r"|viagra|cialis|adult content|xxx|hot singles|limited time offer"
    r"|discount code|work from home|get rich",
    re.IGNORECASE,
)


class NoiseFilter:
    MIN_LEN = 50

    @classmethod
    def score(cls, body: str) -> float:
        """Noise score 0.0–1.0. Higher = more noise/spam."""
        if not body:
            return 1.0
        score = 0.0
        length = len(body)

        if length < cls.MIN_LEN:
            score += 0.5

        urls = len(re.findall(r"https?://\S+", body))
        if urls and length:
            score += min(urls * 30 / length, 1.0) * 0.3

        spam_matches = _SPAM_RE.findall(body)
        if spam_matches:
            unique_hits = len(set(m.lower() for m in spam_matches))
            score += min(0.2 + unique_hits * 0.15, 0.7)

        non_print = sum(1 for c in body if not c.isprintable())
        score += min(non_print / max(length, 1) * 2, 0.2)

        return min(round(score, 3), 1.0)

    @classmethod
    def is_spam(cls, body: str, threshold: float = 0.6) -> bool:
        return cls.score(body) >= threshold


# ---------------------------------------------------------------------------
# Exact Deduplicator
# ---------------------------------------------------------------------------

def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", errors="replace")).hexdigest()


class ExactDeduplicator:
    def __init__(self):
        self._seen: set = set()

    def is_duplicate(self, content_hash: str) -> bool:
        if content_hash in self._seen:
            return True
        self._seen.add(content_hash)
        return False


# ---------------------------------------------------------------------------
# Fuzzy Deduplicator
# ---------------------------------------------------------------------------

class FuzzyDeduplicator:
    def __init__(self, threshold: float = 0.80, window: int = 200):
        self.threshold = threshold
        self._window   = window
        self._seen:    list = []

    def is_duplicate(self, body: str) -> bool:
        snippet = body[:2000]
        for seen in self._seen[-self._window:]:
            if SequenceMatcher(None, snippet, seen).ratio() >= self.threshold:
                return True
        self._seen.append(snippet)
        return False


# ---------------------------------------------------------------------------
# Encoding helpers
# ---------------------------------------------------------------------------

def _detect_encoding(raw_bytes: bytes) -> str:
    if not raw_bytes:
        return "utf-8"
    enc = chardet.detect(raw_bytes).get("encoding") or "utf-8"
    return "utf-8" if enc.lower() == "ascii" else enc


def _decode(raw_bytes: bytes) -> tuple:
    enc = _detect_encoding(raw_bytes)
    for e in [enc, "utf-8", "latin-1", "cp1252"]:
        try:
            return raw_bytes.decode(e, errors="strict"), e
        except (UnicodeDecodeError, LookupError):
            continue
    return raw_bytes.decode("utf-8", errors="replace"), "utf-8"


# ---------------------------------------------------------------------------
# Forum Parser
# ---------------------------------------------------------------------------

class ForumParser:
    def parse(self, raw: dict) -> Optional[ParsedDocument]:
        try:
            body_raw = (
                raw.get("full_body_text")
                or raw.get("body_preview")
                or raw.get("body")
                or ""
            )
            body = HtmlCleaner.clean(body_raw) if "<" in body_raw else body_raw.strip()

            if not body:
                logger.warning(f"[parser/forum] Empty body: {raw.get('thread_url', '?')}")
                return None

            title     = (raw.get("title") or "Untitled").strip()[:255]
            author    = (raw.get("author") or "anonymous").strip()
            timestamp = raw.get("timestamp") or raw.get("fetched_at") or ""
            url       = raw.get("thread_url") or raw.get("source_url") or ""
            encoding  = raw.get("encoding", "utf-8")

            content_hash        = _sha256(body)
            language            = LanguageDetector.detect(body)
            is_code, code_lang  = CodeDetector.detect(body)
            noise               = NoiseFilter.score(body)

            return ParsedDocument(
                source_type   = "forum",
                title         = title,
                body          = body,
                author        = author,
                timestamp     = timestamp,
                url           = url,
                language      = language,
                encoding      = encoding,
                content_hash  = content_hash,
                is_code       = is_code,
                code_language = code_lang,
                is_spam       = noise >= 0.6,
                noise_score   = noise,
                parsed_at     = datetime.now(timezone.utc).isoformat(),
            )
        except Exception as e:
            logger.error(
                f"[parser/forum] Error: {raw.get('thread_url', '?')}: {e}",
                exc_info=True,
            )
            return None


# ---------------------------------------------------------------------------
# Paste Parser
# ---------------------------------------------------------------------------

class PasteParser:
    def parse(self, raw: dict) -> Optional[ParsedDocument]:
        try:
            body_raw = raw.get("full_body_text") or raw.get("raw_content") or ""
            body = HtmlCleaner.strip_html(body_raw) if "<" in body_raw else body_raw.strip()

            if not body:
                logger.warning(f"[parser/paste] Empty body: {raw.get('thread_url', '?')}")
                return None

            title     = (raw.get("title") or "Untitled").strip()[:255]
            author    = (raw.get("author") or "anonymous").strip()
            timestamp = raw.get("timestamp") or raw.get("fetched_at") or ""
            url       = raw.get("thread_url") or raw.get("source_url") or ""
            encoding  = raw.get("encoding", "utf-8")
            category  = raw.get("category") or ""

            content_hash        = _sha256(body)
            language            = LanguageDetector.detect(body)
            is_code, code_lang  = CodeDetector.detect(body, category_hint=category)
            noise               = NoiseFilter.score(body)

            return ParsedDocument(
                source_type   = "paste",
                title         = title,
                body          = body,
                author        = author,
                timestamp     = timestamp,
                url           = url,
                language      = language,
                encoding      = encoding,
                content_hash  = content_hash,
                is_code       = is_code,
                code_language = code_lang,
                is_spam       = noise >= 0.6,
                noise_score   = noise,
                parsed_at     = datetime.now(timezone.utc).isoformat(),
            )
        except Exception as e:
            logger.error(
                f"[parser/paste] Error: {raw.get('thread_url', '?')}: {e}",
                exc_info=True,
            )
            return None


# ---------------------------------------------------------------------------
# Parser Selector
# ---------------------------------------------------------------------------

class ParserSelector:
    def __init__(self):
        self._forum = ForumParser()
        self._paste = PasteParser()

    def parse(self, raw: dict) -> Optional[ParsedDocument]:
        source_type = raw.get("source_type", "")
        if source_type in ("paste_site", "paste"):
            return self._paste.parse(raw)
        if source_type == "forum":
            return self._forum.parse(raw)
        # Fallback: guess from fields
        if "category" in raw or "raw_content" in raw:
            logger.debug(f"[parser] Guessing PasteParser for source_type='{source_type}'")
            return self._paste.parse(raw)
        logger.debug(f"[parser] Guessing ForumParser for source_type='{source_type}'")
        return self._forum.parse(raw)
