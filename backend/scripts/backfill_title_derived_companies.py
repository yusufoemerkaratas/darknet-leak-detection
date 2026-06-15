import argparse
import re
import sys
from pathlib import Path


sys.path.append(str(Path(__file__).resolve().parents[1]))

from db import SessionLocal  # noqa: E402
from models import Alert, AnalysisResult, Company, LeakRecord  # noqa: E402


GENERIC_TITLES = {
    "announcement",
    "announcement: ftp",
    "for press",
    "home in brussels",
    "our first post",
    "our first",
    "waiting for next",
    "welcome to new customers",
    "complete",
    "update",
    "updates",
    "new leak",
    "data leak",
    "compilation of many breaches (comb)",
}

GENERIC_WORDS = {
    "company",
    "chemical company",
    "medical company",
    "cosmetics and fragrance company",
    "school",
    "medical",
    "limited",
    "insurance",
    "associates",
    "industrial",
}

PREFIX_PATTERNS = [
    r"^new files for leak\s+",
    r"^new links for\s+",
    r"^updates? with files in\s+",
    r"^new data leak post from\s+",
    r"^data leak post from\s+",
    r"^leakage from company\s+",
    r"^leakage from\s+",
    r"^leak from\s+",
    r"^new leak from\s+",
    r"^victim website:\s*title:\s*",
    r"^\[[a-z]{2,4}\]\s+",
]


def normalize_title(title: str | None) -> str | None:
    if not title:
        return None

    candidate = " ".join(title.strip().split())
    if not candidate:
        return None

    candidate = re.sub(r"\s+", " ", candidate)
    candidate = candidate.strip(" -:;|")

    for pattern in PREFIX_PATTERNS:
        candidate = re.sub(pattern, "", candidate, flags=re.IGNORECASE).strip()

    candidate = re.sub(r"\s+LEAKED$", "", candidate, flags=re.IGNORECASE).strip()
    candidate = re.sub(r"\s+breach information.*$", "", candidate, flags=re.IGNORECASE).strip()
    candidate = re.sub(r"\s+was founded.*$", "", candidate, flags=re.IGNORECASE).strip()
    candidate = re.sub(r"\s+supplies\s+.*$", "", candidate, flags=re.IGNORECASE).strip()
    candidate = re.sub(r"\s+-\s+Full$", "", candidate, flags=re.IGNORECASE).strip()

    url_match = re.search(r"https?://(?:www\.)?([^/\s.]+(?:\.[^/\s.]+)+)", candidate, flags=re.IGNORECASE)
    if url_match:
        candidate = url_match.group(1)

    if "," in candidate and re.search(r"\b(?:ste|suite|ave|street|road|drive|nh|ny|ca|tx|\d{4,})\b", candidate, flags=re.IGNORECASE):
        candidate = candidate.split(",", 1)[0].strip()

    candidate = re.sub(r"\s+post$", "", candidate, flags=re.IGNORECASE).strip()
    candidate = re.sub(r"\((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+\)", "", candidate, flags=re.IGNORECASE).strip()

    domain_match = re.fullmatch(r"(?:www\.)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)\.?", candidate, flags=re.IGNORECASE)
    if domain_match:
        candidate = domain_match.group(1).lower()

    if candidate.endswith("..."):
        candidate = candidate[:-3].strip()

    candidate = candidate.strip(" .,-:;|\"'")
    candidate = re.sub(r"\s+", " ", candidate)

    if not is_usable_candidate(candidate):
        return None

    return candidate


def is_usable_candidate(candidate: str) -> bool:
    lowered = candidate.casefold()
    if lowered in GENERIC_TITLES or lowered in GENERIC_WORDS:
        return False
    if any(marker in lowered for marker in ["breaking news", "hello world", "next leak will be"]):
        return False
    if any(marker in lowered for marker in ["announce", "announcement", "compilation of many breaches", "lawyers france"]):
        return False
    if re.search(r"[\u0400-\u04FF]", candidate):
        return False
    if candidate.startswith(("http://", "https://", "www.")):
        return False
    if re.search(r"\.[a-z]$", lowered) and " " not in candidate and "," not in candidate:
        return False
    if "*" in candidate or "?" in candidate:
        return False
    if len(candidate) < 4 or len(candidate) > 120:
        return False
    if len(candidate.split()) > 10:
        return False
    if re.fullmatch(r"\d+(?:/\d+)?", candidate):
        return False
    if not re.search(r"[A-Za-zÀ-ÿ]", candidate):
        return False
    return True


def get_or_create_company(db, company_name: str) -> Company:
    company = db.query(Company).filter(Company.name == company_name).first()
    if company:
        return company

    company = Company(name=company_name)
    db.add(company)
    db.flush()
    return company


def iter_unknown_records(db, last_id: int, batch_size: int):
    return (
        db.query(LeakRecord)
        .join(Company, LeakRecord.company_id == Company.id)
        .filter(Company.name == "Unknown")
        .filter(LeakRecord.id > last_id)
        .order_by(LeakRecord.id.asc())
        .limit(batch_size)
        .all()
    )


def apply_title_match(db, record: LeakRecord, company_name: str) -> None:
    company = get_or_create_company(db, company_name)
    record.company_id = company.id

    match_payload = [
        {
            "company_name": company_name,
            "match_type": "title_derived",
            "matched_term": record.title,
            "confidence": 0.65,
            "similarity_score": None,
        }
    ]
    if record.analysis_result:
        record.analysis_result.matched_companies = match_payload

    db.query(Alert).filter(Alert.leak_record_id == record.id).update(
        {Alert.company_id: company.id},
        synchronize_session=False,
    )


def backfill_title_derived(limit=None, batch_size=100, apply=False, quiet=False):
    db = SessionLocal()
    inspected = 0
    matched = 0
    updated = 0
    last_id = 0

    try:
        while True:
            remaining = None if limit is None else max(limit - inspected, 0)
            if remaining == 0:
                break

            current_batch_size = batch_size if remaining is None else min(batch_size, remaining)
            records = iter_unknown_records(db, last_id, current_batch_size)
            if not records:
                break

            for record in records:
                inspected += 1
                last_id = record.id
                company_name = normalize_title(record.title)
                if not company_name:
                    continue

                matched += 1
                if not quiet:
                    print(f"{record.id}: Unknown -> {company_name}")

                if apply:
                    apply_title_match(db, record, company_name)
                    updated += 1

            if apply:
                db.commit()

        print(
            "Title-derived backfill complete: "
            f"inspected={inspected}, matched={matched}, updated={updated}, apply={apply}"
        )
    finally:
        db.close()


def parse_args():
    parser = argparse.ArgumentParser(
        description="Assign remaining Unknown records from cleaned leak titles.",
    )
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--quiet", action="store_true")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    backfill_title_derived(
        limit=args.limit,
        batch_size=args.batch_size,
        apply=args.apply,
        quiet=args.quiet,
    )
