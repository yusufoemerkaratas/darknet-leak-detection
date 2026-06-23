import sys
import time
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path
import urllib.request
import urllib.error

sys.path.append(str(Path(__file__).resolve().parents[1]))

from db import SessionLocal
from models import Source, Company, LeakRecord
from crud import bulk_insert_leak_records

def get_or_create_source(db):
    source = db.query(Source).filter(Source.name == "Integration Test Source").first()
    if source:
        return source
    source = Source(name="Integration Test Source", url="https://integration-test.local")
    db.add(source)
    db.commit()
    db.refresh(source)
    return source

def get_or_create_company(db):
    company = db.query(Company).filter(Company.name == "Integration Test Company").first()
    if company:
        return company
    company = Company(name="Integration Test Company")
    db.add(company)
    db.commit()
    db.refresh(company)
    return company

def run_db_stress_test(db, source_id, company_id, num_records=10000):
    print(f"Starting Database Stress Test with {num_records} records...")
    records = []
    for i in range(num_records):
        text = f"integration-test-stress-record-{i}"
        content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
        records.append({
            "source_id": source_id,
            "company_id": company_id,
            "title": f"Integration Test Leak Record {i}",
            "content_hash": content_hash,
            "raw_url": f"https://integration-test.local/leak/{i}",
            "severity": "high",
            "published_at": datetime.now(timezone.utc),
        })

    start_time = time.time()
    result = bulk_insert_leak_records(db, records)
    duration = time.time() - start_time
    throughput_per_min = int((result["inserted"] / duration) * 60) if duration > 0 else 0

    print(f"DB Stress Test Completed. Inserted: {result['inserted']}, Duration: {duration:.4f}s, Throughput: {throughput_per_min}/min")
    return {
        "total_records": num_records,
        "inserted": result["inserted"],
        "duration_seconds": duration,
        "throughput_per_min": throughput_per_min
    }

def test_api_performance(url, num_requests=50):
    print(f"Testing API Latency on {url} with {num_requests} requests...")
    latencies = []
    success_count = 0

    for i in range(num_requests):
        start = time.time()
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    success_count += 1
            latencies.append(time.time() - start)
        except Exception as e:
            latencies.append(5.0)  # Timeout/error fallback

    avg_latency = sum(latencies) / len(latencies) if latencies else 0.0
    under_1s = sum(1 for l in latencies if l < 1.0)
    success_rate = (success_count / num_requests) * 100

    print(f"API Test Completed. Avg Latency: {avg_latency:.4f}s, Success Rate: {success_rate}%, Under 1s: {under_1s}/{num_requests}")
    return {
        "url": url,
        "total_requests": num_requests,
        "avg_latency_seconds": avg_latency,
        "success_rate_percent": success_rate,
        "under_1s_count": under_1s
    }

def main():
    db = SessionLocal()
    report = {}
    
    try:
        # Check database connection
        print("Checking DB connection...")
        from sqlalchemy import text
        db.execute(text("SELECT 1"))
        print("DB connection OK.")
        report["db_connection"] = "OK"
    except Exception as e:
        print(f"DB connection failed: {e}")
        report["db_connection"] = f"FAILED: {e}"
        sys.exit(1)

    try:
        source = get_or_create_source(db)
        company = get_or_create_company(db)
        
        # 1. DB Stress Test
        stress_result = run_db_stress_test(db, source.id, company.id, 10000)
        report["stress_test"] = stress_result

        # 2. API Latency Test on /health
        health_api_result = test_api_performance("http://localhost:8000/health", 50)
        report["api_health_test"] = health_api_result

        # 3. API Latency Test on /dashboard/overview
        overview_api_result = test_api_performance("http://localhost:8000/dashboard/overview", 50)
        report["api_overview_test"] = overview_api_result

        # Cleanup
        print("Cleaning up stress test records...")
        db.query(LeakRecord).filter(LeakRecord.source_id == source.id).delete()
        db.commit()
        print("Cleanup completed.")
        report["cleanup"] = "OK"

    except Exception as e:
        print(f"Error during tests: {e}")
        report["error"] = str(e)
    finally:
        db.close()

    # Output JSON report so we can parse it easily
    print("===RESULT_START===")
    print(json.dumps(report, indent=2))
    print("===RESULT_END===")

if __name__ == "__main__":
    main()
