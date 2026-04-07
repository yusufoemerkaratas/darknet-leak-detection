# Project Scope

## Scope Goal

Define Sprint 1 boundaries so implementation starts with clear responsibilities and avoid scope creep.

## In Scope (Sprint 1)

- Repository skeleton and onboarding documentation.
- FastAPI backend skeleton with health endpoint.
- PostgreSQL integration and SQLAlchemy models.
- Alembic setup with initial and schema-extension migrations.
- Core entities for source, company, and leak record tracking.
- Docker Compose setup for backend + postgres, plus frontend placeholder.

## Out of Scope (Sprint 1)

- Production deployment and infrastructure automation.
- Full collector implementations for all source types.
- Advanced auth/authorization and multi-tenant controls.
- Complete frontend feature implementation.
- Real-time streaming and alerting engine.

## Constraints

- Local-first developer experience via Docker Compose.
- Schema changes must be migration-driven.
- API changes must keep OpenAPI documentation consistent.

## Success Criteria

- Team can clone repository, start services, and run migrations.
- Health endpoint and CRUD baseline are available.
- Architecture and module boundaries are documented.
- DB schema includes required unique and performance indexes.

## Team Approval

- Product Owner: pending
- Backend Lead: pending
- Data/Analysis Lead: pending
- Frontend Lead: pending

Approval status remains pending until team review meeting confirms this scope document.
