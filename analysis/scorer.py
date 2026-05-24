from dataclasses import dataclass, field
from typing import Any, Dict, List


DATABASE_PATTERN_TYPES = {"database_dump"}

CREDENTIAL_PATTERN_TYPES = {
    "email_password_colon",
    "email_password_pipe",
    "email_password_double_colon",
    "username_md5",
    "username_sha1",
    "username_bcrypt",
    "rsa_private_key",
    "openssh_private_key",
    "pgp_private_key",
    "aws_api_key",
    "stripe_api_key",
    "github_token",
    "config_db_password",
    "config_api_key",
    "config_secret_token",
}


@dataclass
class ScoreResult:
    risk_score: int
    score_breakdown: Dict[str, Any] = field(default_factory=dict)
    signal_flags: Dict[str, Any] = field(default_factory=dict)


class RiskScorer:
    """
    Converts detector outputs into a 0-100 risk score.

    The scorer does not classify findings.
    It only calculates the numeric score and explains which signals contributed.
    """

    LOW_CONFIDENCE_THRESHOLD = 0.85

    def score(
        self,
        patterns: List[Dict[str, Any]],
        terminology: List[Dict[str, Any]],
        companies: List[Dict[str, Any]],
    ) -> ScoreResult:
        breakdown: Dict[str, Any] = {
            "company_match": 0,
            "domain_match": 0,
            "credential_pattern": 0,
            "database_dump": 0,
            "terminology_high": 0,
            "terminology_medium": 0,
            "terminology_low_conditional": 0,
            "industry_indicator": 0,
            "multiple_signals_bonus": 0,
            "fuzzy_match_adjustment": 0,
            "low_confidence_adjustment": 0,
            "subtotal_before_cap": 0,
            "final_score": 0,
        }

        signal_groups = set()

        pattern_types = {
            pattern.get("pattern_type")
            for pattern in patterns
            if pattern.get("pattern_type")
        }

        has_company = bool(companies)
        has_domain = any(
            company.get("match_type") == "domain"
            for company in companies
        )
        has_fuzzy_company = any(
            company.get("match_type") == "fuzzy"
            for company in companies
        )

        has_credential = bool(pattern_types.intersection(CREDENTIAL_PATTERN_TYPES))
        has_database_dump = bool(pattern_types.intersection(DATABASE_PATTERN_TYPES))

        high_terms = {
            term.get("term")
            for term in terminology
            if term.get("priority") == "high"
        }

        medium_terms = {
            term.get("term")
            for term in terminology
            if term.get("priority") == "medium"
        }

        low_terms = {
            term.get("term")
            for term in terminology
            if term.get("priority") == "low"
        }

        industry_terms = {
            term.get("term")
            for term in terminology
            if term.get("priority") == "industry_indicator"
        }

        if has_company:
            breakdown["company_match"] = 25
            signal_groups.add("company")

        if has_domain:
            breakdown["domain_match"] = 20
            signal_groups.add("domain")

        if has_credential:
            breakdown["credential_pattern"] = 30
            signal_groups.add("credential")

        if has_database_dump:
            breakdown["database_dump"] = 35
            signal_groups.add("database_dump")

        if high_terms:
            breakdown["terminology_high"] = 15 * len(high_terms)
            signal_groups.add("terminology_high")

        if medium_terms:
            breakdown["terminology_medium"] = 10 * len(medium_terms)
            signal_groups.add("terminology_medium")

        # Low-priority terms are weak signals.
        # They only count if another stronger signal exists.
        if low_terms and signal_groups:
            breakdown["terminology_low_conditional"] = 5
            signal_groups.add("terminology_low")

        if industry_terms:
            breakdown["industry_indicator"] = 5
            signal_groups.add("industry")

        if len(signal_groups) >= 3:
            breakdown["multiple_signals_bonus"] = 5

        if has_fuzzy_company:
            breakdown["fuzzy_match_adjustment"] = -3

        low_confidence_patterns = [
            pattern for pattern in patterns
            if float(pattern.get("confidence", 1.0)) < self.LOW_CONFIDENCE_THRESHOLD
        ]

        if low_confidence_patterns and not has_credential and not has_database_dump:
            breakdown["low_confidence_adjustment"] = -5

        subtotal = sum(
            value for value in breakdown.values()
            if isinstance(value, int)
        )

        final_score = max(0, min(100, subtotal))

        breakdown["subtotal_before_cap"] = subtotal
        breakdown["final_score"] = final_score

        flags = {
            "has_company": has_company,
            "has_domain": has_domain,
            "has_fuzzy_company": has_fuzzy_company,
            "has_credential": has_credential,
            "has_database_dump": has_database_dump,
            "has_high_terminology": bool(high_terms),
            "has_medium_terminology": bool(medium_terms),
            "signal_group_count": len(signal_groups),
        }

        return ScoreResult(
            risk_score=final_score,
            score_breakdown=breakdown,
            signal_flags=flags,
        )