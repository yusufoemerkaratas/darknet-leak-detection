import argparse
import json
import re
import sys
import time
from pathlib import Path
from typing import Any

import requests


sys.path.append(str(Path(__file__).resolve().parents[1]))
sys.path.append(str(Path(__file__).resolve().parents[2]))

from analysis.llm_enrichment import LLMEnrichmentConfig  # noqa: E402
from db import SessionLocal  # noqa: E402
from models import Alert, AnalysisResult, Company, LeakRecord  # noqa: E402


GENERIC_COMPANY_NAMES = {
    "unknown",
    "none",
    "n/a",
    "not available",
    "not specified",
    "redacted",
    "admin",
    "customer",
    "customers",
    "user",
    "users",
    "database",
    "telegram",
    "dark web",
}


def build_record_sample(record: LeakRecord, max_text_chars: int) -> dict[str, Any]:
    text_parts = [
        f"Title: {record.title or ''}",
        f"URL: {record.raw_url or ''}",
        f"Content: {(record.raw_content_text or '')[:max_text_chars]}",
    ]
    return {
        "record_id": record.id,
        "text": "\n".join(text_parts),
    }


def build_prompt(samples: list[dict[str, Any]]) -> str:
    return (
        "Extract the most likely affected company or organization name for each "
        "data leak record. Use only names explicitly present or strongly implied "
        "by the record text. Do not guess from common vendors, software names, "
        "email providers, or generic words. Return strict JSON only, with this "
        'shape: {"results":[{"record_id":123,"company_name":"Acme Corp",'
        '"confidence":0.91,"evidence":"short supporting phrase"}]}. '
        "If no reliable company is present, use company_name null and confidence 0.\n\n"
        f"Records:\n{json.dumps(samples, ensure_ascii=False)}"
    )


def build_payload(config: LLMEnrichmentConfig, prompt: str) -> dict[str, Any]:
    if config.provider in {"github-models", "openai-compatible"}:
        return {
            "model": config.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You extract organization names from leak records as strict JSON.",
                },
                {"role": "user", "content": prompt},
            ],
        }

    return {
        "model": config.model,
        "prompt": prompt,
        "stream": False,
    }


def build_headers(config: LLMEnrichmentConfig) -> dict[str, str] | None:
    if config.provider not in {"github-models", "openai-compatible"}:
        return None

    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
    }
    if config.api_key:
        headers["Authorization"] = f"Bearer {config.api_key}"
    return headers


def extract_text(payload: dict[str, Any]) -> str:
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


def parse_llm_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    fence_match = re.search(r"```(?:json)?\s*(.*?)```", cleaned, flags=re.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(cleaned[start : end + 1])


def normalize_company_name(value: Any) -> str | None:
    if not isinstance(value, str):
        return None

    name = " ".join(value.strip().split())
    if not name:
        return None
    if name.lower() in GENERIC_COMPANY_NAMES:
        return None
    if len(name) < 2 or len(name) > 120:
        return None
    if "@" in name or "://" in name:
        return None
    if not re.search(r"[A-Za-z0-9]", name):
        return None

    return name


def validated_result(item: Any, record_ids: set[int], min_confidence: float) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None

    try:
        record_id = int(item.get("record_id"))
        confidence = float(item.get("confidence") or 0)
    except (TypeError, ValueError):
        return None

    if record_id not in record_ids or confidence < min_confidence:
        return None

    company_name = normalize_company_name(item.get("company_name"))
    if not company_name:
        return None

    evidence = item.get("evidence")
    if not isinstance(evidence, str):
        evidence = company_name

    return {
        "record_id": record_id,
        "company_name": company_name,
        "confidence": min(confidence, 1.0),
        "evidence": evidence[:250],
    }


def fetch_unknown_records(db, last_id: int, limit: int, batch_size: int) -> list[LeakRecord]:
    return (
        db.query(LeakRecord)
        .join(Company, LeakRecord.company_id == Company.id)
        .outerjoin(AnalysisResult, AnalysisResult.leak_record_id == LeakRecord.id)
        .filter(Company.name == "Unknown")
        .filter(LeakRecord.id > last_id)
        .filter(LeakRecord.raw_content_text.isnot(None))
        .order_by(LeakRecord.id.asc())
        .limit(min(limit, batch_size))
        .all()
    )


def get_or_create_company(db, company_name: str) -> Company:
    company = db.query(Company).filter(Company.name == company_name).first()
    if company:
        return company

    company = Company(name=company_name)
    db.add(company)
    db.flush()
    return company


def apply_company_match(db, record: LeakRecord, result: dict[str, Any]) -> None:
    company = get_or_create_company(db, result["company_name"])
    record.company_id = company.id

    match_payload = [
        {
            "company_name": result["company_name"],
            "match_type": "llm_inferred",
            "matched_term": result["evidence"],
            "confidence": result["confidence"],
            "similarity_score": None,
        }
    ]
    if record.analysis_result:
        record.analysis_result.matched_companies = match_payload

    db.query(Alert).filter(Alert.leak_record_id == record.id).update(
        {Alert.company_id: company.id},
        synchronize_session=False,
    )


def call_llm(config: LLMEnrichmentConfig, samples: list[dict[str, Any]]) -> dict[str, Any]:
    payload = build_payload(config, build_prompt(samples))
    response = requests.post(
        config.endpoint_url,
        json=payload,
        headers=build_headers(config),
        timeout=config.timeout_seconds,
    )
    response.raise_for_status()
    return parse_llm_json(extract_text(response.json()))


def call_llm_with_retries(
    config: LLMEnrichmentConfig,
    samples: list[dict[str, Any]],
    retries: int,
    retry_sleep_seconds: float,
) -> dict[str, Any] | None:
    for attempt in range(retries + 1):
        try:
            return call_llm(config, samples)
        except requests.HTTPError as exc:
            status_code = exc.response.status_code if exc.response is not None else None
            if status_code != 429 or attempt >= retries:
                print(f"LLM request failed: HTTP {status_code or 'unknown'}")
                return None
            wait_time = retry_sleep_seconds * (attempt + 1)
            print(f"LLM rate limited; retrying in {wait_time:.1f}s")
            time.sleep(wait_time)
        except Exception as exc:
            print(f"LLM request failed: {exc}")
            return None

    return None


def discover_unknown_companies(
    limit: int,
    batch_size: int,
    min_confidence: float,
    max_text_chars: int,
    sleep_seconds: float,
    retries: int,
    retry_sleep_seconds: float,
    apply: bool,
) -> None:
    config = LLMEnrichmentConfig.from_env()
    if not config.enabled:
        raise RuntimeError("LLM_ANALYSIS_ENABLED must be true for LLM company discovery.")
    if config.provider in {"github-models", "openai-compatible"} and not config.api_key:
        raise RuntimeError("LLM_ANALYSIS_API_KEY is required for the configured provider.")

    db = SessionLocal()
    inspected = 0
    accepted = 0
    updated = 0
    last_id = 0

    try:
        while inspected < limit:
            records = fetch_unknown_records(db, last_id, limit - inspected, batch_size)
            if not records:
                break

            inspected += len(records)
            last_id = records[-1].id
            samples = [build_record_sample(record, max_text_chars) for record in records]
            record_map = {record.id: record for record in records}
            record_ids = set(record_map)
            payload = call_llm_with_retries(
                config,
                samples,
                retries=retries,
                retry_sleep_seconds=retry_sleep_seconds,
            )
            if payload is None:
                break

            raw_results = payload.get("results", [])
            if not isinstance(raw_results, list):
                raw_results = []

            for item in raw_results:
                result = validated_result(item, record_ids, min_confidence)
                if not result:
                    continue

                accepted += 1
                record = record_map[result["record_id"]]
                print(
                    f"{record.id}: Unknown -> {result['company_name']} "
                    f"(confidence={result['confidence']:.2f})"
                )

                if apply:
                    apply_company_match(db, record, result)
                    updated += 1

            if apply:
                db.commit()

            if sleep_seconds > 0:
                time.sleep(sleep_seconds)

        print(
            "LLM discovery complete: "
            f"inspected={inspected}, accepted={accepted}, updated={updated}, apply={apply}"
        )
    finally:
        db.close()


def parse_args():
    parser = argparse.ArgumentParser(
        description="Use the configured LLM to infer companies for Unknown leak records.",
    )
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=5)
    parser.add_argument("--min-confidence", type=float, default=0.8)
    parser.add_argument("--max-text-chars", type=int, default=1200)
    parser.add_argument("--sleep-seconds", type=float, default=1.0)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--retry-sleep-seconds", type=float, default=10.0)
    parser.add_argument("--apply", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    discover_unknown_companies(
        limit=max(args.limit, 1),
        batch_size=min(max(args.batch_size, 1), 10),
        min_confidence=min(max(args.min_confidence, 0.0), 1.0),
        max_text_chars=max(args.max_text_chars, 200),
        sleep_seconds=max(args.sleep_seconds, 0),
        retries=max(args.retries, 0),
        retry_sleep_seconds=max(args.retry_sleep_seconds, 0),
        apply=args.apply,
    )
