from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

from analysis.classifier import FindingClassifier
from analysis.detectors.company_detector import CompanyDetector
from analysis.detectors.credential_detector import CredentialDetector
from analysis.detectors.terminology_detector import TerminologyDetector
from analysis.scorer import RiskScorer


@dataclass
class AnalysisEngineResult:
    risk_score: int
    classification: str
    classification_rule: str
    detected_patterns: List[Dict[str, Any]] = field(default_factory=list)
    terminology_hits: List[Dict[str, Any]] = field(default_factory=list)
    matched_companies: List[Dict[str, Any]] = field(default_factory=list)
    score_breakdown: Dict[str, Any] = field(default_factory=dict)
    signal_flags: Dict[str, Any] = field(default_factory=dict)

    @property
    def best_company_name(self) -> Optional[str]:
        if not self.matched_companies:
            return None
        best = max(
            self.matched_companies,
            key=lambda item: float(item.get("confidence", 0.0)),
        )
        return best.get("company_name")

    def as_dict(self) -> Dict[str, Any]:
        return {
            "risk_score": self.risk_score,
            "classification": self.classification,
            "classification_rule": self.classification_rule,
            "detected_patterns": self.detected_patterns,
            "terminology_hits": self.terminology_hits,
            "matched_companies": self.matched_companies,
            "score_breakdown": self.score_breakdown,
            "signal_flags": self.signal_flags,
            "best_company_name": self.best_company_name,
        }


class AnalysisEngine:
    def __init__(self, company_profile_path: Optional[str] = None) -> None:
        self._credential_detector = CredentialDetector()
        self._terminology_detector = TerminologyDetector()
        profiles = self._load_company_profiles(company_profile_path)
        self._company_detector = CompanyDetector(profiles)
        self._scorer = RiskScorer()
        self._classifier = FindingClassifier()

    def analyze(self, text: str) -> AnalysisEngineResult:
        credential_results = self._credential_detector.detect(text)
        terminology_results = self._terminology_detector.detect(text)
        company_results = self._company_detector.detect(text)

        patterns = [_serialize_credential_result(r) for r in credential_results]
        terminology = [_serialize_terminology_result(r) for r in terminology_results]
        companies = [_serialize_company_result(r) for r in company_results]

        score = self._scorer.score(patterns, terminology, companies)
        classification = self._classifier.classify(score.risk_score, score.signal_flags)

        return AnalysisEngineResult(
            risk_score=score.risk_score,
            classification=classification.classification,
            classification_rule=classification.classification_rule,
            detected_patterns=patterns,
            terminology_hits=terminology,
            matched_companies=companies,
            score_breakdown=score.score_breakdown,
            signal_flags=score.signal_flags,
        )

    @staticmethod
    def _load_company_profiles(company_profile_path: Optional[str]) -> List[Dict[str, Any]]:
        if company_profile_path:
            profile_path = Path(company_profile_path)
        else:
            base_dir = Path(__file__).resolve().parent.parent
            profile_path = base_dir / "analysis" / "config" / "company_profiles.yaml"

        if not profile_path.exists():
            return []

        try:
            with profile_path.open("r", encoding="utf-8") as fh:
                config = yaml.safe_load(fh) or {}
            return config.get("companies", [])
        except Exception:
            return []


def _get_attr(source: Any, name: str, default: Any = None) -> Any:
    if isinstance(source, dict):
        return source.get(name, default)
    return getattr(source, name, default)


def _serialize_credential_result(result: Any) -> Dict[str, Any]:
    return {
        "pattern_type": _get_attr(result, "pattern_type"),
        "matched_text": _get_attr(result, "matched_text"),
        "context": _get_attr(result, "context"),
        "confidence": _get_attr(result, "confidence"),
        "line_number": _get_attr(result, "line_number"),
    }


def _serialize_terminology_result(result: Any) -> Dict[str, Any]:
    return {
        "term": _get_attr(result, "term"),
        "priority": _get_attr(result, "priority"),
        "count": _get_attr(result, "count"),
        "line_numbers": _get_attr(result, "line_numbers", []),
        "context": _get_attr(result, "context", []),
    }


def _serialize_company_result(result: Any) -> Dict[str, Any]:
    return {
        "company_name": _get_attr(result, "company_name"),
        "match_type": _get_attr(result, "match_type"),
        "matched_term": _get_attr(result, "matched_term"),
        "confidence": _get_attr(result, "confidence"),
        "similarity_score": _get_attr(result, "similarity_score"),
    }
