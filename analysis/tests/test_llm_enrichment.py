import requests

from analysis.llm_enrichment import LLMEnrichmentConfig, LLMEnrichmentService


def test_llm_config_reads_environment(monkeypatch):
    monkeypatch.setenv("LLM_ANALYSIS_ENABLED", "true")
    monkeypatch.setenv("LLM_ANALYSIS_PROVIDER", "github-models")
    monkeypatch.setenv("LLM_ANALYSIS_URL", "http://localhost:9999/api/generate")
    monkeypatch.setenv("LLM_ANALYSIS_MODEL", "school-model")
    monkeypatch.setenv("LLM_ANALYSIS_TIMEOUT", "12")
    monkeypatch.setenv("LLM_ANALYSIS_API_KEY", "test-token")

    config = LLMEnrichmentConfig.from_env()

    assert config.enabled is True
    assert config.provider == "github-models"
    assert config.endpoint_url == "http://localhost:9999/api/generate"
    assert config.model == "school-model"
    assert config.timeout_seconds == 12
    assert config.api_key == "test-token"


def test_llm_service_disabled_does_not_call_session():
    session = NoCallSession()
    service = LLMEnrichmentService(
        config=LLMEnrichmentConfig(
            enabled=False,
            provider="ollama",
            endpoint_url="http://localhost:9999/api/generate",
            model="school-model",
            timeout_seconds=30,
        ),
        session=session,
    )

    result = service.enrich("sample", {"classification": "high-risk"})

    assert result == {"status": "disabled", "explanation": None}
    assert session.called is False


def test_llm_service_skips_irrelevant_findings():
    session = NoCallSession()
    service = LLMEnrichmentService(
        config=LLMEnrichmentConfig(
            enabled=True,
            provider="ollama",
            endpoint_url="http://localhost:9999/api/generate",
            model="school-model",
            timeout_seconds=30,
        ),
        session=session,
    )

    result = service.enrich("sample", {"classification": "irrelevant"})

    assert result["status"] == "skipped"
    assert result["reason"] == "classification_irrelevant"
    assert session.called is False


def test_llm_service_returns_concise_explanation():
    session = FakeSession({"response": "  Potential credential exposure.\nInvestigate quickly.  "})
    service = LLMEnrichmentService(
        config=LLMEnrichmentConfig(
            enabled=True,
            provider="ollama",
            endpoint_url="http://localhost:9999/api/generate",
            model="school-model",
            timeout_seconds=30,
        ),
        session=session,
    )

    result = service.enrich("leaked credentials", _analysis())

    assert result["status"] == "ok"
    assert result["model"] == "school-model"
    assert result["explanation"] == "Potential credential exposure. Investigate quickly."
    assert session.payload["model"] == "school-model"
    assert session.payload["stream"] is False
    assert session.headers is None
    assert session.timeout == 30


def test_github_models_service_uses_chat_completion_payload():
    session = FakeSession(
        {
            "choices": [
                {
                    "message": {
                        "content": "Credential exposure may affect customer accounts.",
                    },
                },
            ],
        }
    )
    service = LLMEnrichmentService(
        config=LLMEnrichmentConfig(
            enabled=True,
            provider="github-models",
            endpoint_url="https://models.github.ai/inference/chat/completions",
            model="openai/gpt-5",
            timeout_seconds=60,
            api_key="test-token",
        ),
        session=session,
    )

    result = service.enrich("leaked credentials", _analysis())

    assert result["status"] == "ok"
    assert result["model"] == "openai/gpt-5"
    assert result["explanation"] == "Credential exposure may affect customer accounts."
    assert session.payload["model"] == "openai/gpt-5"
    assert "messages" in session.payload
    assert session.payload["messages"][0]["role"] == "system"
    assert session.payload["messages"][1]["role"] == "user"
    assert session.headers["Authorization"] == "Bearer test-token"
    assert session.headers["Content-Type"] == "application/json"
    assert session.timeout == 60


def test_llm_service_handles_request_failure():
    service = LLMEnrichmentService(
        config=LLMEnrichmentConfig(
            enabled=True,
            provider="ollama",
            endpoint_url="http://localhost:9999/api/generate",
            model="school-model",
            timeout_seconds=30,
        ),
        session=FailingSession(),
    )

    result = service.enrich("leaked credentials", _analysis())

    assert result["status"] == "error"
    assert result["explanation"] is None


def _analysis():
    return {
        "classification": "high-risk",
        "risk_score": 92,
        "classification_rule": "credential and company signals",
        "matched_companies": [{"company_name": "Microsoft"}],
        "detected_patterns": [{"pattern_type": "email_password_colon"}],
        "terminology_hits": [{"term": "database dump"}],
    }


class NoCallSession:
    called = False

    def post(self, *args, **kwargs):
        self.called = True
        raise AssertionError("session should not be called")


class FakeSession:
    def __init__(self, payload):
        self._payload = payload
        self.payload = None
        self.headers = None
        self.timeout = None

    def post(self, url, json, timeout, headers=None):
        self.url = url
        self.payload = json
        self.headers = headers
        self.timeout = timeout
        return FakeResponse(self._payload)


class FailingSession:
    def post(self, *args, **kwargs):
        raise requests.RequestException("connection refused")


class FakeResponse:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return self._payload
