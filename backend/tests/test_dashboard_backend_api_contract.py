import sys
from pathlib import Path


sys.path.append(str(Path(__file__).resolve().parents[1]))

from main import app  # noqa: E402


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
