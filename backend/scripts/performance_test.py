import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import time
import hashlib
from datetime import datetime, timezone

from db import SessionLocal
from models import Source, Company, LeakRecord
from crud import bulk_insert_leak_records


def get_or_create_source(db):
    source = db.query(Source).filter(Source.name == "Performance Test Source").first()
    if source:
        return source

    source = Source(name="Performance Test Source", url="https://performance-test.local")
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


def get_or_create_company(db):
    company = db.query(Company).filter(Company.name == "Performance Test Company").first()
    if company:
        return company

    company = Company(name="Performance Test Company")
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


def generate_records(source_id, company_id, amount=5000):
    records = []

    for i in range(amount):
        text = f"performance-test-record-{i}"
        content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

        records.append({
            "source_id": source_id,
            "company_id": company_id,
            "title": f"Performance Test Leak Record {i}",
            "content_hash": content_hash,
            "raw_url": f"https://performance-test.local/leak/{i}",
            "severity": "medium",
            "published_at": datetime.now(timezone.utc),
        })

    return records


def main():
    db = SessionLocal()

    try:
        source = get_or_create_source(db)
        company = get_or_create_company(db)

        records = generate_records(source.id, company.id, 5000)

        start_time = time.time()
        result = bulk_insert_leak_records(db, records)
        duration = time.time() - start_time

        documents_per_minute = int((result["inserted"] / duration) * 60) if duration > 0 else 0

        print("Performance Test Result")
        print("-----------------------")
        print(f"Total records: {len(records)}")
        print(f"Inserted records: {result['inserted']}")
        print(f"Duplicates skipped: {result['duplicates_skipped']}")
        print(f"Duration: {duration:.4f} seconds")
        print(f"Throughput: {documents_per_minute} documents/minute")

        start_time = time.time()
        duplicate_result = bulk_insert_leak_records(db, records)
        duplicate_duration = time.time() - start_time

        print("\nDuplicate Test Result")
        print("---------------------")
        print(f"Inserted records: {duplicate_result['inserted']}")
        print(f"Duplicates skipped: {duplicate_result['duplicates_skipped']}")
        print(f"Dedup check duration: {duplicate_duration:.4f} seconds")

    finally:
        db.close()


if __name__ == "__main__":
    main()