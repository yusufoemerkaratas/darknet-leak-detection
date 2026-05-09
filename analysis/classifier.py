from dataclasses import dataclass
from typing import Dict


@dataclass
class ClassificationResult:
    classification: str
    classification_rule: str


class FindingClassifier:
    """Classify findings based on score and signal flags."""

    def classify(self, risk_score: int, signal_flags: Dict) -> ClassificationResult:
        has_credential = bool(signal_flags.get("has_credential"))
        has_company = bool(signal_flags.get("has_company"))
        has_domain = bool(signal_flags.get("has_domain"))
        has_database_dump = bool(signal_flags.get("has_database_dump"))
        signal_group_count = int(signal_flags.get("signal_group_count", 0))

        if (
            risk_score >= 81
            and has_credential
            and (has_company or has_domain or has_database_dump)
        ):
            return ClassificationResult(
                classification="high-risk",
                classification_rule=(
                    "High-Risk because the score is at least 81 and credential "
                    "evidence appears together with company, domain, or database "
                    "dump evidence."
                ),
            )

        if risk_score >= 51 and signal_group_count >= 2:
            return ClassificationResult(
                classification="suspicious",
                classification_rule=(
                    "Suspicious because the score is at least 51 and multiple "
                    "independent risk signals were detected."
                ),
            )

        if risk_score >= 31 or has_company or has_domain:
            return ClassificationResult(
                classification="related",
                classification_rule=(
                    "Related because the document contains a monitored company/domain "
                    "or weak-to-medium risk indicators, but not enough evidence for "
                    "a suspicious or high-risk classification."
                ),
            )

        return ClassificationResult(
            classification="irrelevant",
            classification_rule=(
                "Irrelevant because no monitored company, credential pattern, "
                "database dump, or strong leak signal was detected."
            ),
        )
