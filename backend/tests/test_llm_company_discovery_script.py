import importlib.util
from pathlib import Path


SCRIPT_PATH = (
    Path(__file__).resolve().parents[1]
    / "scripts"
    / "discover_unknown_companies_with_llm.py"
)

spec = importlib.util.spec_from_file_location("discover_unknown_companies_with_llm", SCRIPT_PATH)
script = importlib.util.module_from_spec(spec)
spec.loader.exec_module(script)


def test_parse_llm_json_accepts_fenced_json():
    payload = script.parse_llm_json(
        '```json\n{"results":[{"record_id":1,"company_name":"Acme Corp","confidence":0.9}]}\n```'
    )

    assert payload["results"][0]["company_name"] == "Acme Corp"


def test_validated_result_filters_low_confidence_and_generic_names():
    assert script.validated_result(
        {"record_id": 1, "company_name": "Unknown", "confidence": 0.95},
        {1},
        0.8,
    ) is None
    assert script.validated_result(
        {"record_id": 1, "company_name": "Acme Corp", "confidence": 0.4},
        {1},
        0.8,
    ) is None


def test_validated_result_accepts_confident_company_name():
    result = script.validated_result(
        {
            "record_id": 7,
            "company_name": "Apex Financial Group",
            "confidence": 0.91,
            "evidence": "Apex Financial Group credential archive",
        },
        {7},
        0.8,
    )

    assert result["company_name"] == "Apex Financial Group"
    assert result["confidence"] == 0.91
    assert result["evidence"] == "Apex Financial Group credential archive"
