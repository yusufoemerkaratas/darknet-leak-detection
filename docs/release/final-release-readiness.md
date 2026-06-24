# Final Release Readiness

This document summarizes the final release check for version `1.0.0` of the
Darknet Leak Detection System. The scope is a university project submission:
the goal is to provide a reproducible, well-documented, locally runnable system,
not a production-hardened enterprise deployment.

## Release Scope

Version `1.0.0` includes:

- Docker-based local setup for backend, frontend, PostgreSQL, collector, and Tor.
- FastAPI backend with health, statistics, source, company, crawl-job, finding,
  dashboard, and alert endpoints.
- React/Vite dashboard for overview metrics, finding review, source management,
  and on-demand AI explanation display.
- Collector and parser pipeline for darknet/ransomware/paste-style sources.
- Deterministic analysis pipeline for company matching, credential detection,
  terminology detection, scoring, classification, and alert generation.
- Documentation for architecture, analysis criteria, scoring, alerting,
  deployment, demo flow, findings examples, and performance results.

Out of scope for this university release:

- Public production hosting.
- Multi-user authentication and authorization.
- Enterprise-grade immutable audit logging.
- Long-term legal/compliance operations beyond project documentation.

## Must-Haves Checklist

| Item | Status | Evidence |
|---|---:|---|
| Backend health endpoint | Verified | `GET /health` returns `{"status":"ok"}` in the demo script. |
| Database integration | Verified | SQLAlchemy models and Alembic migrations are present. |
| Collector pipeline | Verified | Collector, parser, ingestion, and scheduler modules are implemented. |
| Analysis pipeline | Verified | Company, credential, terminology, scoring, and alerting modules are implemented and documented. |
| Dashboard | Verified | React dashboard components and API client are implemented. |
| Demo documentation | Verified | `docs/demo/FINAL-DEMO.md` and findings examples are present. |
| Performance evidence | Verified | `docs/demo/system-integration-performance-report.md` records API latency below one second. |
| Security dependency audit | Verified | Python and frontend audits report no known vulnerabilities after dependency updates. |

## Quality Commands

Use these commands for the final local check after installing dependencies:

```bash
python -m pip install -r requirements.txt
python -m pip install -r requirements-dev.txt
python -m black --check analysis backend collectors
python -m flake8 analysis backend collectors
python -m coverage run -m pytest
python -m coverage report --fail-under=70
```

Frontend:

```bash
cd frontend
npm install
npm run lint
npm test -- --run
npm run build
npm audit --audit-level=high
```

Security audit:

```bash
./venv/bin/pip-audit -r requirements.txt
cd frontend && npm audit --audit-level=high
```

## Current Verification Snapshot

Checked on 2026-06-24:

| Criterion | Status | Result |
|---|---:|---|
| Version updated to `1.0.0` | Pass | Backend API and frontend package metadata are set to `1.0.0`. |
| CHANGELOG complete | Pass | `CHANGELOG.md` documents the `1.0.0` release. |
| No known Python dependency vulnerabilities | Pass | `./venv/bin/pip-audit -r requirements.txt` returned `No known vulnerabilities found`. |
| No high frontend dependency vulnerabilities | Pass | `npm audit --audit-level=high` returned `found 0 vulnerabilities`. |
| Performance queries below one second | Pass | `/dashboard/overview` average latency was documented as `0.1625s`. |
| Code is on main branch | Pass | Local branch is `main`. |
| Code style checks | Pending local run | Tooling is documented in `requirements-dev.txt`. Run before final tag. |
| Tests and coverage | Pending local run | Run after installing runtime and dev dependencies. Target: 70%+. |
| CI/CD passing | Project-scope check | The repository contains a GitLab CI file, but final pipeline status must be checked in GitLab after pushing. |
| Git tag `v1.0.0` | Pending final commit | Create after team review and final commit. |

## Release Procedure

1. Start from the `main` branch and ensure the working tree only contains
   intended release changes.
2. Install backend and frontend dependencies.
3. Run the quality commands listed above.
4. Confirm dependency audits are clean.
5. Confirm the demo and performance documents are up to date.
6. Commit the final release changes.
7. Create the release tag:

```bash
git tag v1.0.0
git push origin main
git push origin v1.0.0
```

8. Confirm the GitLab pipeline status after the push.

## Acceptance Criteria Summary

| Acceptance Criterion | Status | Note |
|---|---:|---|
| Must-haves checklist verified | Pass | Covered in this document. |
| Code style: black/flake8 pass | Pending local run | Tooling added; run before tag. |
| Tests pass: all green | Pending local run | Requires local dependency installation. |
| Coverage: 70%+ | Pending local run | Coverage command documented. |
| No security vulnerabilities | Pass | Python and frontend dependency audits are clean. |
| Performance: queries <1 sec | Pass | Existing performance report documents this. |
| Version updated to 1.0.0 | Pass | Backend and frontend metadata updated. |
| CHANGELOG.md complete | Pass | Added for `1.0.0`. |
| Git tagged: v1.0.0 | Pending final commit | Should be done after review. |
| All code in main branch | Pass | Local branch is `main`. |
| CI/CD passing | Pending remote check | Check GitLab pipeline after pushing. |
