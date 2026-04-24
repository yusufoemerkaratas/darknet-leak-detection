from models import Source, Company, LeakRecord

def create_source(db, source):
    db_source = Source(name=source.name, url=source.url)
    db.add(db_source)
    db.commit()
    db.refresh(db_source)
    return db_source

def get_sources(db):
    return db.query(Source).all()

def update_source(db, source_id, source):
    db_source = db.query(Source).filter(Source.id == source_id).first()
    if not db_source:
        return {"error": "not found"}

    db_source.name = source.name
    db_source.url = source.url
    db.commit()
    db.refresh(db_source)
    return db_source

def toggle_source(db, source_id):
    db_source = db.query(Source).filter(Source.id == source_id).first()
    if not db_source:
        return {"error": "not found"}

    db_source.is_active = not db_source.is_active
    db.commit()
    db.refresh(db_source)
    return db_source

def delete_source(db, source_id):
    db_source = db.query(Source).filter(Source.id == source_id).first()
    if not db_source:
        return {"error": "not found"}

    db.delete(db_source)
    db.commit()
    return {"message": "deleted"}

def create_company(db, company):
    db_company = Company(name=company.name)
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company

def get_companies(db):
    return db.query(Company).all()

def update_company(db, company_id, company):
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if not db_company:
        return {"error": "not found"}

    db_company.name = company.name
    db.commit()
    db.refresh(db_company)
    return db_company

def delete_company(db, company_id):
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if not db_company:
        return {"error": "not found"}

    db.delete(db_company)
    db.commit()
    return {"message": "deleted"}

def bulk_insert_leak_records(db, leak_records):
    if not leak_records:
        return {
            "inserted": 0,
            "duplicates_skipped": 0
        }

    content_hashes = [record["content_hash"] for record in leak_records]

    existing_hashes = {
        row[0]
        for row in db.query(LeakRecord.content_hash)
        .filter(LeakRecord.content_hash.in_(content_hashes))
        .all()
    }

    new_records = [
        record
        for record in leak_records
        if record["content_hash"] not in existing_hashes
    ]

    if new_records:
        db.bulk_insert_mappings(LeakRecord, new_records)
        db.commit()

    return {
        "inserted": len(new_records),
        "duplicates_skipped": len(leak_records) - len(new_records)
    }