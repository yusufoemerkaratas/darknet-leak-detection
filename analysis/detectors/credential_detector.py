"""
Credential Detector Module.

Scans text for credential patterns (email:password combos, hashed
credentials, database dumps, private keys, API keys, and config secrets)
using regex definitions loaded from analysis/config/patterns.yaml.
"""

import os
import re
from dataclasses import dataclass
from typing import List

import yaml


@dataclass
class DetectionResult:
    """Single credential or secret pattern match.

    Attributes:
        pattern_type:  Name of the matched pattern (e.g. 'email_password_colon').
        matched_text:  The text fragment that matched, truncated to 100 characters.
        context:       Up to 50 characters before and after the match for review.
        confidence:    Confidence score defined in the pattern configuration.
        line_number:   1-based line number where the match was found.
    """

    pattern_type: str
    matched_text: str
    context: str
    confidence: float
    line_number: int


class CredentialDetector:
    """Detects credential and secret patterns in text.

    Loads compiled regex patterns from the YAML configuration file
    located at ``analysis/config/patterns.yaml`` and scans input text
    for all defined pattern types.

    Usage::

        detector = CredentialDetector()
        results  = detector.detect(some_text)
        for r in results:
            print(r.pattern_type, r.confidence)
    """

    def __init__(self, config_path: str = None) -> None:
        """Initialise the detector and compile regex patterns.

        Args:
            config_path: Optional override for the YAML config file path.
                         Defaults to ``analysis/config/patterns.yaml``
                         relative to the project root.
        """
        if config_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(
                os.path.abspath(__file__)
            )))
            config_path = os.path.join(base_dir, "analysis", "config", "patterns.yaml")

        self._patterns: list = []
        self._load_patterns(config_path)

    # ── private helpers ──────────────────────────────────────────────

    def _load_patterns(self, config_path: str) -> None:
        """Parse the YAML config and compile every regex pattern."""
        try:
            with open(config_path, "r", encoding="utf-8") as fh:
                config = yaml.safe_load(fh)

            for entry in config.get("patterns", []):
                flags = re.IGNORECASE if entry.get("case_insensitive", False) else 0
                compiled = re.compile(entry["regex"], flags)
                self._patterns.append({
                    "pattern_type": entry["pattern_type"],
                    "regex": compiled,
                    "confidence": float(entry["confidence"]),
                })
        except Exception:
            # Fail gracefully — an empty pattern list means no detections,
            # rather than an unhandled crash in a production pipeline.
            self._patterns = []

    @staticmethod
    def _truncate(text: str, max_length: int) -> str:
        """Return *text* truncated to *max_length* characters."""
        if len(text) <= max_length:
            return text
        return text[:max_length]

    @staticmethod
    def _extract_context(full_text: str, start: int, end: int, window: int = 50) -> str:
        """Return up to *window* characters before and after the match."""
        ctx_start = max(0, start - window)
        ctx_end = min(len(full_text), end + window)
        return full_text[ctx_start:ctx_end]

    @staticmethod
    def _offset_to_line(text: str, offset: int) -> int:
        """Convert a character offset to a 1-based line number."""
        return text[:offset].count("\n") + 1

    # ── public API ───────────────────────────────────────────────────

    def detect(self, text: str) -> List[DetectionResult]:
        """Scan *text* for all configured credential patterns.

        Args:
            text: The input text to analyse.

        Returns:
            A list of :class:`DetectionResult` objects, one per match.
            Returns an empty list if no patterns match or if an error occurs.
        """
        results: List[DetectionResult] = []

        if not text or not self._patterns:
            return results

        try:
            for pattern in self._patterns:
                for match in pattern["regex"].finditer(text):
                    matched_text = self._truncate(match.group(), 100)
                    context = self._extract_context(text, match.start(), match.end())
                    line_number = self._offset_to_line(text, match.start())

                    results.append(DetectionResult(
                        pattern_type=pattern["pattern_type"],
                        matched_text=matched_text,
                        context=context,
                        confidence=pattern["confidence"],
                        line_number=line_number,
                    ))
        except Exception:
            # Return whatever we collected so far rather than crashing.
            pass

        return results
