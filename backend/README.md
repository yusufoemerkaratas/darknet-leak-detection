# ⚙️ Backend Service (FastAPI)

## 📌 Overview

This is the backend service built with FastAPI.

It provides REST APIs for managing sources and companies.

---

## 🧱 Structure

```bash
backend/
│
├── main.py          # Entry point
├── db.py            # Database connection
├── models.py        # SQLAlchemy models
├── schemas.py       # Pydantic schemas
├── crud.py          # Database operations
├── routers/         # API endpoints
│
├── alembic/         # Migrations
├── alembic.ini
```

---

## 🚀 Run locally

```bash
uvicorn main:app --reload
```

Make sure the repo-root `.env` exists (copy from `.env.example`).

### One-command dev startup (Linux/macOS)

From the repo root:

```bash
./scripts/dev.sh
```

---

## 🐳 Run with Docker

```bash
docker compose up --build
```

---

## 🔄 Migrations

```bash
alembic revision --autogenerate -m "init"
alembic upgrade head
```

If you run Alembic on the host (not inside Docker), set `DATABASE_URL`
to `localhost` so it can reach the Postgres container:

```bash
DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/mydb alembic current
```

---

## 📡 API Endpoints

### Sources

* GET /sources/
* POST /sources/
* PUT /sources/{id}
* DELETE /sources/{id}

### Companies

* GET /companies/
* POST /companies/
* PUT /companies/{id}
* DELETE /companies/{id}

---

## 🧪 Health Check

```bash
GET /health
```

---

## 📌 Notes

* Uses PostgreSQL
* Uses SQLAlchemy ORM
* Alembic for migrations

---

## 🗂️ Table Partitioning (Future Work)

`leak_records` is currently a single unpartitioned table. At high volumes (millions of rows),
partitioning by `published_at` (monthly range partitions) would improve query performance
and make old-data archival easier. This is not implemented yet — existing indexes on
`published_at` and the composite `(published_at, collected_at)` index are sufficient for
the current throughput targets (1000+ docs/min).
