import argparse
import os
import sys
from pathlib import Path


os.environ["LLM_ANALYSIS_ENABLED"] = "false"
sys.path.append(str(Path(__file__).resolve().parents[1]))
sys.path.append(str(Path(__file__).resolve().parents[2]))

from analysis.analysis_engine import AnalysisEngine  # noqa: E402
from db import SessionLocal  # noqa: E402
from models import Alert, AnalysisResult, Company, LeakRecord  # noqa: E402


def get_or_create_company(db, company_name):
    company = db.query(Company).filter(Company.name == company_name).first()
    if company:
        return company

    company = Company(name=company_name)
    db.add(company)
    db.flush()
    return company


def build_analysis_text(record):
    return "\n".join(
        part
        for part in [
            record.title or "",
            record.raw_content_text or "",
            record.raw_url or "",
        ]
        if part
    )


def should_update_company(record, best_company_name, include_known=False):
    if not best_company_name:
        return False

    current_name = record.company.name if record.company else None
    if current_name == best_company_name:
        return False

    return include_known or current_name in {None, "", "Unknown"}


def iter_candidate_record_ids(db, last_id=0, batch_size=100, include_known=False):
    query = (
        db.query(LeakRecord.id)
        .join(Company, LeakRecord.company_id == Company.id)
        .outerjoin(AnalysisResult, AnalysisResult.leak_record_id == LeakRecord.id)
        .filter(LeakRecord.raw_content_text.isnot(None))
        .filter(LeakRecord.id > last_id)
        .order_by(LeakRecord.id.asc())
    )

    if not include_known:
        query = query.filter(Company.name == "Unknown")

    return [row.id for row in query.limit(batch_size).all()]


def backfill_company_matches(
    limit=None,
    apply=False,
    include_known=False,
    batch_size=100,
    quiet=False,
):
    engine = AnalysisEngine()
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
            record_ids = iter_candidate_record_ids(
                db,
                last_id=last_id,
                batch_size=current_batch_size,
                include_known=include_known,
            )
            if not record_ids:
                break

            for record_id in record_ids:
                last_id = record_id
                record = db.query(LeakRecord).filter(LeakRecord.id == record_id).first()
                if not record:
                    continue

                inspected += 1
                analysis = engine.analyze(build_analysis_text(record))
                best_company_name = analysis.best_company_name

                if not should_update_company(
                    record,
                    best_company_name,
                    include_known=include_known,
                ):
                    continue

                matched += 1
                old_company_name = record.company.name if record.company else "Unknown"
                if not quiet:
                    print(f"{record.id}: {old_company_name} -> {best_company_name}")

                if not apply:
                    continue

                company = get_or_create_company(db, best_company_name)
                record.company_id = company.id

                if record.analysis_result:
                    record.analysis_result.matched_companies = analysis.matched_companies

                db.query(Alert).filter(Alert.leak_record_id == record.id).update(
                    {Alert.company_id: company.id},
                    synchronize_session=False,
                )
                updated += 1

            if apply:
                db.commit()

        print(
            "Backfill complete: "
            f"inspected={inspected}, matched={matched}, updated={updated}, "
            f"apply={apply}"
        )
    finally:
        db.close()


def parse_args():
    parser = argparse.ArgumentParser(
        description="Backfill company matches for existing leak records.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist company_id and matched_companies updates.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit the number of records inspected.",
    )
    parser.add_argument(
        "--include-known",
        action="store_true",
        help="Also reassign records that already have a non-Unknown company.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=100,
        help="Number of records fetched per database batch.",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Only print the final summary.",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    backfill_company_matches(
        limit=args.limit,
        apply=args.apply,
        include_known=args.include_known,
        batch_size=args.batch_size,
        quiet=args.quiet,
    )
