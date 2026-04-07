
# KI-gestütztes System zur frühzeitigen Erkennung von Datenlecks

## Project Purpose

PP System is a modular platform for collecting, normalizing, and analyzing leaked-data signals.

Primary goals:

- Ingest data from multiple sources.
- Persist normalized records in PostgreSQL.
- Expose operations through a FastAPI backend.
- Enable analysis workflows and frontend reporting.

## Repository Structure

```text
pp-system/
├── analysis/                # Analytics and scoring modules
├── backend/                 # FastAPI app, DB models, migrations, compose
│   ├── alembic/             # Migration scripts
│   ├── routers/             # API routes
│   ├── main.py              # FastAPI entrypoint
│   ├── models.py            # SQLAlchemy entities
│   └── docker-compose.yml   # Local service orchestration
├── collectors/              # Source collectors/crawlers
├── docs/
│   ├── architecture/        # Architecture and module responsibilities
│   └── project-scope.md     # In-scope vs out-of-scope
├── frontend/                # Frontend application placeholder
├── .env.example             # Required environment variable template
├── .gitignore
└── README.md
```

## Quick Start

1. Clone repository and enter project:

```bash
git clone <your-repo-url>
cd pp-system
cp .env.example .env
```

2. Start backend + postgres:

```bash
cd backend
docker compose up --build -d
```

3. Apply migrations:

```bash
docker compose exec backend alembic upgrade head
```

4. Verify service:

```bash
curl http://127.0.0.1:8000/health
```

5. Open API docs:

```text
http://127.0.0.1:8000/docs
```

## Docker Commands

- Start services: `docker compose up --build -d`
- Stop services: `docker compose down`
- View logs: `docker compose logs -f backend`
- Migration status: `docker compose exec backend alembic current`
- Upgrade migration: `docker compose exec backend alembic upgrade head`

Note: frontend placeholder is available via compose profile:

- `docker compose --profile frontend up -d frontend`

## Development Conventions

- Python style: PEP8, explicit imports, type hints where practical.
- Branch naming:
- `feature/<short-description>`
- `fix/<short-description>`
- `chore/<short-description>`
- Commit format (Conventional Commits style):
- `feat: add source ingestion endpoint`
- `fix: handle null url in source parser`
- `docs: update architecture overview`

## API Surface (Sprint 1)

- `GET /health`
- `GET /sources/`, `POST /sources/`, `PUT /sources/{id}`, `PATCH /sources/{id}/toggle`, `DELETE /sources/{id}`
- `GET /companies/`, `POST /companies/`, `PUT /companies/{id}`, `DELETE /companies/{id}`

## Architecture and Scope Docs

- System architecture and data flow: `docs/architecture/overview.md`
- Project scope (in/out, constraints, approvals): `docs/project-scope.md`

## Tech Stack Rationale

- FastAPI: async-friendly API framework with strong typing and automatic OpenAPI docs.
- PostgreSQL: reliable relational model for normalized entities and indexed query patterns.
- SQLAlchemy: mature ORM for schema control and portability.
- Alembic: versioned migrations for predictable DB evolution.
- Docker Compose: reproducible local setup for backend and database services.

