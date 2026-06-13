import logging
import os
from dataclasses import dataclass
from typing import Any, Dict, Optional

import requests

logger = logging.getLogger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class LLMEnrichmentConfig:
    enabled: bool
    endpoint_url: str
    model: str
    timeout_seconds: int

    @classmethod
    def from_env(cls) -> "LLMEnrichmentConfig":
        timeout_raw = os.environ.get("LLM_ANALYSIS_TIMEOUT", "30")
        try:
            timeout = int(timeout_raw)
        except ValueError:
            timeout = 30

        return cls(
            enabled=_env_flag("LLM_ANALYSIS_ENABLED", False),
            endpoint_url=os.environ.get(
                "LLM_ANALYSIS_URL",
                "http://localhost:9999/api/generate",
            ),
            model=os.environ.get("LLM_ANALYSIS_MODEL", "llama3.1"),
            timeout_seconds=max(timeout, 1),
        )


class LLMEnrichmentService:
    def __init__(
        self,
        config: Optional[LLMEnrichmentConfig] = None,
        session: Optional[requests.Session] = None,
    ) -> None:
        self.config = config or LLMEnrichmentConfig.from_env()
        self._session = session or requests.Session()

    def enrich(
        self,
        text: str,
        analysis: Dict[str, Any],
    ) -> Dict[str, Any]:
        if not self.config.enabled:
            return {"status": "disabled", "explanation": None}

        if analysis.get("classification") == "irrelevant":
            return {"status": "skipped", "reason": "classification_irrelevant"}

        prompt = _build_prompt(text, analysis)
        payload = {
            "model": self.config.model,
            "prompt": prompt,
            "stream": False,
        }

        try:
            response = self._session.post(
                self.config.endpoint_url,
                json=payload,
                timeout=self.config.timeout_seconds,
            )
            response.raise_for_status()
            explanation = _extract_text(response.json())
            if not explanation:
                return {"status": "empty", "explanation": None}
            return {
                "status": "ok",
                "model": self.config.model,
                "explanation": _normalize_explanation(explanation),
            }
        except Exception as exc:
            logger.warning("LLM enrichment failed: %s", exc)
            return {"status": "error", "explanation": None, "error": str(exc)}


def _build_prompt(text: str, analysis: Dict[str, Any]) -> str:
    sample = text[:2500]
    return (
        "You are assisting a data leak analyst. "
        "Use the deterministic analysis result as the source of truth. "
        "Do not change the score or classification. "
        "Write one concise threat explanation in 2-3 sentences.\n\n"
        f"Classification: {analysis.get('classification')}\n"
        f"Risk score: {analysis.get('risk_score')}\n"
        f"Classification rule: {analysis.get('classification_rule')}\n"
        f"Matched companies: {analysis.get('matched_companies')}\n"
        f"Detected patterns: {analysis.get('detected_patterns')}\n"
        f"Terminology hits: {analysis.get('terminology_hits')}\n\n"
        f"Leak text sample:\n{sample}"
    )


def _extract_text(payload: Dict[str, Any]) -> str:
    if isinstance(payload.get("response"), str):
        return payload["response"]
    if isinstance(payload.get("text"), str):
        return payload["text"]
    if isinstance(payload.get("output"), str):
        return payload["output"]

    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        first = choices[0]
        if isinstance(first, dict):
            if isinstance(first.get("text"), str):
                return first["text"]
            message = first.get("message")
            if isinstance(message, dict) and isinstance(message.get("content"), str):
                return message["content"]

    return ""


def _normalize_explanation(text: str) -> str:
    return " ".join(text.strip().split())
