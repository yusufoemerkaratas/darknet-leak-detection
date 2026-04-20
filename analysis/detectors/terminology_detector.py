"""
Terminology Detector Module.

Scans text for leak-related terminology defined in
analysis/config/terminology.yaml using case-insensitive keyword matching.
"""

import os
import re
from dataclasses import dataclass, field
from typing import List

import yaml


@dataclass
class TerminologyResult:
    """Single terminology match summary.

    Attributes:
        term:         The matched terminology string (e.g. 'combo list').
        priority:     Priority level as defined in the config ('high', 'medium', 'low').
        count:        Total number of occurrences found in the text.
        line_numbers: 1-based line numbers where each occurrence was found.
        context:      Surrounding text snippet for each occurrence.
    """

    term: str
    priority: str
    count: int
    line_numbers: List[int] = field(default_factory=list)
    context: List[str] = field(default_factory=list)


class TerminologyDetector:
    """Detects leak-related terminology in text.

    Loads terminology definitions from the YAML configuration file
    located at ``analysis/config/terminology.yaml`` and performs
    case-insensitive whole-phrase matching across the input text.

    Usage::

        detector = TerminologyDetector()
        results  = detector.detect(some_text)
        for r in results:
            print(r.term, r.priority, r.count)
    """

    def __init__(self, config_path: str = None) -> None:
        """Initialise the detector and load terminology definitions.

        Args:
            config_path: Optional override for the YAML config file path.
                         Defaults to ``analysis/config/terminology.yaml``
                         relative to the project root.
        """
        if config_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(
                os.path.abspath(__file__)
            )))
            config_path = os.path.join(base_dir, "analysis", "config", "terminology.yaml")

        self._terms: list = []
        self._load_terms(config_path)

    # ── private helpers ──────────────────────────────────────────────

    def _load_terms(self, config_path: str) -> None:
        """Parse the YAML config and build the internal term list."""
        try:
            with open(config_path, "r", encoding="utf-8") as fh:
                config = yaml.safe_load(fh)

            terminology = config.get("terminology", {})
            
            for priority_key in ("high_priority", "medium_priority", "low_priority", "industry_indicator"):
                section = terminology.get(priority_key, {})
                priority_label = priority_key.replace("_priority", "")

                for entry in section.get("terms", []):
                    term_text = entry.get("term", "")
                    if term_text:
                        # Compile a case-insensitive whole-word boundary regex
                        # for each term so multi-word phrases are matched correctly.
                        pattern = re.compile(
                            r"(?<!\w)" + re.escape(term_text) + r"(?!\w)",
                            re.IGNORECASE,
                        )
                        self._terms.append({
                            "term": term_text,
                            "priority": priority_label,
                            "regex": pattern,
                        })
        except Exception:
            # Fail gracefully — no terms means no detections.
            self._terms = []

    @staticmethod
    def _offset_to_line(text: str, offset: int) -> int:
        """Convert a character offset to a 1-based line number."""
        return text[:offset].count("\n") + 1

    @staticmethod
    def _extract_context(text: str, start: int, end: int, window: int = 50) -> str:
        """Return up to *window* characters before and after the match."""
        ctx_start = max(0, start - window)
        ctx_end = min(len(text), end + window)
        return text[ctx_start:ctx_end]
    
    @staticmethod
    def _is_educational_context(context_str: str) -> bool:
        """Check if surrounding words indicate a safe/educational context."""
        safe_words = {"tutorial", "example", "demo", "course", "documentation", "placeholder"}
        context_words = set(re.findall(r"\b[a-z]+\b", context_str.lower()))
        return bool(safe_words.intersection(context_words))

    # ── public API ───────────────────────────────────────────────────

    def detect(self, text: str) -> List[TerminologyResult]:
        """Scan *text* for all configured terminology terms.

        Performs case-insensitive matching. Each term that appears at
        least once in the text produces a single :class:`TerminologyResult`
        summarising all of its occurrences.

        Args:
            text: The input text to analyse.

        Returns:
            A list of :class:`TerminologyResult` objects.
            Returns an empty list if no terms match or if an error occurs.
        """
        results: List[TerminologyResult] = []

        if not text or not self._terms:
            return results

        try:
            for term_entry in self._terms:
                matches = list(term_entry["regex"].finditer(text))

                if not matches:
                    continue

                valid_line_numbers: List[int] = []
                valid_contexts: List[str] = []

                for m in matches:
                    ctx = self._extract_context(text, m.start(), m.end())
                    
                    # Context-aware filtering requirement
                    if self._is_educational_context(ctx):
                        continue
                        
                    valid_contexts.append(ctx)
                    valid_line_numbers.append(self._offset_to_line(text, m.start()))

                # Skip if all matches were filtered out
                if not valid_contexts:
                    continue

                results.append(TerminologyResult(
                    term=term_entry["term"],
                    priority=term_entry["priority"],
                    count=len(valid_contexts),
                    line_numbers=valid_line_numbers,
                    context=valid_contexts,
                ))
        except Exception:
            # Return whatever we collected so far rather than crashing.
            pass
        return results
