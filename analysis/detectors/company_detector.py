"""
Company Detector Module.

Identifies company references in text using four matching strategies:
exact match, domain match, alias match, and fuzzy match (Levenshtein ratio ≥ 0.90).
"""

import re
from dataclasses import dataclass
from typing import Dict, List

from Levenshtein import ratio as levenshtein_ratio


@dataclass
class CompanyResult:
    """Single company reference match.

    Attributes:
        company_name:     Canonical company name from the profile.
        match_type:       One of 'exact', 'domain', 'alias', or 'fuzzy'.
        matched_term:     The actual term that produced the match.
        confidence:       Confidence score (1.0 for exact/alias, ratio for fuzzy).
        similarity_score: Levenshtein ratio (1.0 for exact/alias, 0.9+ for fuzzy).
    """

    company_name: str
    match_type: str
    matched_term: str
    confidence: float
    similarity_score: float


class CompanyDetector:
    """Detects company name references in text.

    Accepts a list of company profiles, each containing a canonical name,
    a list of aliases, and a list of domains. The detector applies four
    matching strategies in order of priority:

    1. **Exact match** — case-insensitive verbatim match of the canonical name.
    2. **Domain match** — detects company domains (exact, subdomain, or @email).
    3. **Alias match** — case-insensitive match against any registered alias.
    4. **Fuzzy match** — Levenshtein ratio comparison with a minimum threshold
       of 0.90, applied only when no exact, domain, or alias match is found.

    Usage::

        profiles = [
            {"name": "Microsoft", "aliases": ["MSFT", "MS"], "domains": ["microsoft.com"]},
            {"name": "Amazon",    "aliases": ["AMZN", "AWS"], "domains": ["amazon.com"]},
        ]
        detector = CompanyDetector(profiles)
        results  = detector.detect(some_text)
        for r in results:
            print(r.company_name, r.match_type, r.similarity_score)
    """

    FUZZY_THRESHOLD: float = 0.90

    def __init__(self, company_profiles: List[Dict] = None) -> None:
        """Initialise the detector with company profiles.

        Args:
            company_profiles: A list of dicts, each with keys
                ``name`` (str), ``aliases`` (list[str]), and
                ``domains`` (list[str]).  Defaults to an empty list.
        """
        self._profiles: List[Dict] = []
        self._load_profiles(company_profiles or [])

    # ── private helpers ──────────────────────────────────────────────

    def _load_profiles(self, profiles: List[Dict]) -> None:
        """Normalise and store company profiles for fast lookup."""
        try:
            for profile in profiles:
                name = profile.get("name", "")
                aliases = profile.get("aliases", [])
                domains = profile.get("domains", [])

                if not name:
                    continue

                alias_patterns = []
                for alias in aliases:
                    if not alias:
                        continue
                    alias_patterns.append((alias, self._compile_alias_pattern(alias)))

                self._profiles.append({
                    "name": name,
                    "name_lower": name.lower(),
                    "aliases": alias_patterns,
                    "domains": [d.lower() for d in domains],
                })
        except Exception:
            self._profiles = []

    @staticmethod
    def _compile_alias_pattern(alias: str) -> re.Pattern:
        """Compile alias as regex; fall back to literal match if invalid."""
        try:
            return re.compile(alias, re.IGNORECASE)
        except re.error:
            return re.compile(re.escape(alias), re.IGNORECASE)

    @staticmethod
    def _extract_words(text: str) -> List[str]:
        """Split text into word tokens for fuzzy comparison."""
        return re.findall(r"\b[a-zA-Z0-9.]+\b", text)

    # ── public API ───────────────────────────────────────────────────

    def detect(self, text: str) -> List[CompanyResult]:
        """Scan *text* for company name references.

        Applies exact, domain, alias, and fuzzy matching for each
        configured company profile. A company can appear at most once
        in the results — the highest-priority match type is kept.

        Args:
            text: The input text to analyse.

        Returns:
            A list of :class:`CompanyResult` objects.
            Returns an empty list if no companies match or if an error occurs.
        """
        results: List[CompanyResult] = []

        if not text or not self._profiles:
            return results

        text_lower = text.lower()

        try:
            for profile in self._profiles:
                # ── Strategy 1: Exact match ──────────────────────
                if profile["name_lower"] in text_lower:
                    results.append(CompanyResult(
                        company_name=profile["name"],
                        match_type="exact",
                        matched_term=profile["name"],
                        confidence=1.0,
                        similarity_score=1.0,
                    ))
                    continue

                # ── Strategy 2: Domain match ─────────────────────
                domain_matched = False
                for domain in profile["domains"]:
                    # Exact domain or subdomain (e.g. microsoft.com,
                    # internal.microsoft.com) and email domain
                    # (e.g. user@microsoft.com)
                    if domain in text_lower:
                        results.append(CompanyResult(
                            company_name=profile["name"],
                            match_type="domain",
                            matched_term=domain,
                            confidence=1.0,
                            similarity_score=1.0,
                        ))
                        domain_matched = True
                        break

                if domain_matched:
                    continue

                # ── Strategy 3: Alias match ──────────────────────
                alias_matched = False
                for alias, pattern in profile["aliases"]:
                    if pattern.search(text):
                        results.append(CompanyResult(
                            company_name=profile["name"],
                            match_type="alias",
                            matched_term=alias,
                            confidence=1.0,
                            similarity_score=1.0,
                        ))
                        alias_matched = True
                        break

                if alias_matched:
                    continue

                # ── Strategy 4: Fuzzy match ──────────────────────
                words = self._extract_words(text)
                best_score = 0.0
                best_word = ""

                for word in words:
                    score = levenshtein_ratio(
                        profile["name_lower"], word.lower()
                    )
                    if score > best_score:
                        best_score = score
                        best_word = word

                if best_score >= self.FUZZY_THRESHOLD:
                    results.append(CompanyResult(
                        company_name=profile["name"],
                        match_type="fuzzy",
                        matched_term=best_word,
                        confidence=best_score,
                        similarity_score=best_score,
                    ))
        except Exception:
            # Return whatever we collected so far rather than crashing.
            pass

        return results
