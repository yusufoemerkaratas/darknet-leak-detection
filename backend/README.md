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
