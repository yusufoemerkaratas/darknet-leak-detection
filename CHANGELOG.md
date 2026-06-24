# Changelog

## 1.0.0 - 2026-06-24

### Added

- Final dashboard workflow for monitoring findings, inspecting details, and reviewing alerts.
- Collector, parser, analysis, scoring, and dashboard documentation under `docs/`.
- Demo materials with scripted flow, findings examples, and performance measurements.
- Release-readiness documentation for the final university project submission.

### Changed

- Updated frontend package metadata to version `1.0.0`.
- Updated vulnerable Python and frontend dependency locks used during release checks.

### Verified

- Python dependency audit: `./venv/bin/pip-audit -r requirements.txt` reported no known vulnerabilities.
- Frontend dependency audit: `npm audit --audit-level=high` reported no vulnerabilities.
- Performance report documents dashboard API latency below one second.

### Notes

- This release is scoped as a university project submission, not a hardened production deployment.
- Git tag `v1.0.0` should be created after the team confirms the final commit.
