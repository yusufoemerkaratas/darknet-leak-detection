import sys
from pathlib import Path
from types import SimpleNamespace


sys.path.append(str(Path(__file__).resolve().parents[1]))

from main import app  # noqa: E402
from routers.dashboard import _build_llm_explanation_state  # noqa: E402


def test_dashboard_backend_issue_31_paths_are_documented():
    openapi = app.openapi()
    paths = openapi["paths"]

    for path in [
        "/findings",
        "/findings/{finding_id}",
        "/alerts",
        "/stats/overview",
        "/stats/findings-by-day",
        "/stats/alerts-by-severity",
        "/companies",
        "/companies/",
    ]:
        assert path in paths


def test_findings_list_documents_required_filters():
    openapi = app.openapi()
    parameters = openapi["paths"]["/findings"]["get"]["parameters"]
    parameter_names = {parameter["name"] for parameter in parameters}

    assert {
        "company_id",
        "classification",
        "severity",
        "date_from",
        "date_to",
        "page",
        "size",
    }.issubset(parameter_names)


def test_alerts_list_documents_required_filters():
    openapi = app.openapi()
    parameters = openapi["paths"]["/alerts"]["get"]["parameters"]
    parameter_names = {parameter["name"] for parameter in parameters}

    assert {
        "company_id",
        "severity",
        "date_from",
        "date_to",
        "page",
        "size",
    }.issubset(parameter_names)


def test_dashboard_finding_detail_documents_llm_explanation_state():
    openapi = app.openapi()
    schemas = openapi["components"]["schemas"]
    detail_schema = schemas["DashboardFindingDetailOut"]
    llm_schema = schemas["DashboardLLMExplanationOut"]

    assert "llm_explanation" in detail_schema["properties"]
    assert {
        "status",
        "text",
        "source",
        "is_available",
        "fallback_reason",
    }.issubset(llm_schema["properties"])
    assert {
        "status",
        "source",
        "is_available",
    }.issubset(set(llm_schema["required"]))


def test_dashboard_finding_detail_uses_fallback_when_llm_metadata_is_missing():
    record = SimpleNamespace(analysis_result=None)

    explanation = _build_llm_explanation_state(record, "Deterministic fallback summary.")

    assert explanation.status == "fallback"
    assert explanation.source == "deterministic-fallback"
    assert explanation.is_available is False
    assert "deterministic" in explanation.fallback_reason.lower()
