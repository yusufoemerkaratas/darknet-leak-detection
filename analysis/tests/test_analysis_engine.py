from analysis.analysis_engine import AnalysisEngine
from analysis.classifier import FindingClassifier
from analysis.scorer import RiskScorer

import pytest


@pytest.fixture(autouse=True)
def disable_live_llm(monkeypatch):
    monkeypatch.setenv("LLM_ANALYSIS_ENABLED", "false")


def test_high_risk_analysis_engine():
    engine = AnalysisEngine()
    text = (
        "Microsoft breach leaked credentials in a recent database dump. "
        "user@microsoft.com:Passw0rd! CREATE TABLE users (id int);"
    )

    result = engine.analyze(text)

    assert result.risk_score >= 81
    assert result.classification == "high-risk"
    assert result.best_company_name is not None
    assert any(p.get("pattern_type") == "email_password_colon" for p in result.detected_patterns)
    assert result.score_breakdown.get("credential_pattern", 0) > 0
    assert result.score_breakdown.get("database_dump", 0) > 0
    assert result.score_breakdown.get("company_match", 0) > 0


def test_irrelevant_or_related_content():
    engine = AnalysisEngine()
    text = "Exclusive summer sale for new customers with free onboarding."

    result = engine.analyze(text)

    assert result.risk_score < 51
    assert result.classification in {"irrelevant", "related"}


def test_suspicious_signals_without_credentials():
    engine = AnalysisEngine()
    text = (
        "Database dump includes user data from 2023. "
        "CREATE TABLE accounts (id int, email text);"
    )

    result = engine.analyze(text)

    assert result.risk_score >= 51
    assert result.classification in {"suspicious", "high-risk"}


def test_classifier_requires_credentials_for_high_risk():
    classifier = FindingClassifier()

    flags_without_credential = {
        "has_credential": False,
        "has_company": True,
        "has_domain": False,
        "has_database_dump": False,
        "signal_group_count": 2,
    }
    result = classifier.classify(90, flags_without_credential)
    assert result.classification != "high-risk"

    flags_with_credential = {
        "has_credential": True,
        "has_company": True,
        "has_domain": False,
        "has_database_dump": False,
        "signal_group_count": 2,
    }
    result = classifier.classify(90, flags_with_credential)
    assert result.classification == "high-risk"


def test_scorer_applies_compromised_company_and_unclear_context_adjustments():
    scorer = RiskScorer()

    result = scorer.score(
        patterns=[{"pattern_type": "config_api_key", "confidence": 0.8, "context_unclear": True}],
        terminology=[],
        companies=[{"company_name": "Microsoft", "match_type": "exact", "known_compromised": True}],
    )

    assert result.score_breakdown["known_compromised_company"] == 10
    assert result.score_breakdown["context_unclear_adjustment"] == -5
    assert result.signal_flags["has_known_compromised_company"] is True
    assert result.signal_flags["has_unclear_context"] is True


class FakeLLMEnricher:
    def __init__(self):
        self.calls = []

    def enrich(self, text, analysis):
        self.calls.append((text, analysis))
        return {
            "status": "ok",
            "model": "fake-school-model",
            "explanation": "This finding indicates exposed credentials tied to a known company.",
        }


class FailingLLMEnricher:
    def enrich(self, text, analysis):
        raise RuntimeError("school llm unavailable")


def test_llm_enrichment_runs_after_deterministic_analysis():
    enricher = FakeLLMEnricher()
    engine = AnalysisEngine(llm_enricher=enricher)
    text = (
        "Microsoft breach leaked credentials in a recent database dump. "
        "user@microsoft.com:Passw0rd!"
    )

    result = engine.analyze(text)

    assert result.classification == "high-risk"
    assert result.llm_enrichment["status"] == "ok"
    assert result.llm_enrichment["explanation"].startswith("This finding")
    assert len(enricher.calls) == 1
    _, deterministic_analysis = enricher.calls[0]
    assert deterministic_analysis["risk_score"] == result.risk_score
    assert deterministic_analysis["classification"] == result.classification


def test_llm_enrichment_failure_does_not_break_analysis():
    engine = AnalysisEngine(llm_enricher=FailingLLMEnricher())
    text = (
        "Microsoft breach leaked credentials in a recent database dump. "
        "user@microsoft.com:Passw0rd!"
    )

    result = engine.analyze(text)

    assert result.classification == "high-risk"
    assert result.risk_score >= 81
    assert result.llm_enrichment["status"] == "error"
    assert result.llm_enrichment["explanation"] is None
