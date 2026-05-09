from analysis.analysis_engine import AnalysisEngine
from analysis.classifier import FindingClassifier


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
