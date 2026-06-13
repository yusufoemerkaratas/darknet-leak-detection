# Implementation Notes

## Current Guardrails

- Do not edit source code without approval.
- Do not work directly on `main` or `master` unless explicitly allowed.
- Do not install dependencies without approval.
- Do not run `sudo`.
- Do not commit, push, reset, clean, switch branches, or rewrite Git history without explicit approval.
- Do not modify GitLab issues without explicit approval.
- Do not read `.env`, private keys, tokens, credentials, or other secrets.
- Safe example files such as `.env.example` may be inspected.

## User Working Preference

- After the user approves implementation for an issue, the assistant should carry the task through coding, local verification, test execution, and fixups without repeatedly asking for confirmation.
- The user will handle GitLab push and merge request creation manually.
- The assistant must still not push, create merge requests, modify GitLab issues, expose secrets, or perform destructive Git operations.
- If dependencies or local services are required for verification, the assistant should explain what is being changed and proceed when the user has given broad approval for completing the issue.

## Recommended Workflow For Future Tasks

1. Restate the task in Turkish.
2. Inspect the relevant GitLab issue, README/docs, and code files.
3. Identify the minimal implementation change.
4. Explain which files will change.
5. Explain risks and the test plan.
6. Ask for approval before non-trivial changes.
7. Apply scoped changes only after approval.
8. Run relevant checks/tests if possible.
9. Summarize changed files and verification results.
10. Do not commit unless asked.

## Useful Commands Already Verified

- `pwd`
- `git status --short`
- `git branch --show-current`
- `git log --oneline -5`
- `find . -maxdepth ...`
- `rg ...`
- `pdftotext ...`
- `pdfinfo ...`
- `glab auth status`
- `glab issue list`
- `glab issue list --assignee @me --all`

## Test Commands To Consider Later

Run these only when relevant and allowed by the user:

- `pytest analysis/tests`
- `pytest collectors/tests`
- `npm test` from `frontend/`
- `npm run lint` from `frontend/`
- `npm run build` from `frontend/`
- Docker Compose checks only after approval because they may build images, start services, and write volumes.

## Known Cautions

- Do not assume Docker services are running.
- Do not assume the local database exists or is migrated.
- Do not assume GitLab issue details beyond what has been read.
- Do not assume PDF requirements are implemented without checking code.
- Do not expose token values from `glab auth status`; authentication output may show that a token exists, but the token itself must remain hidden.
- `backend/docker-compose.yml` may be older than root `docker-compose.yml`; prefer confirming before using it as canonical.
- `.gitlab-ci.yml` currently appears to be a placeholder and may not represent actual verification quality.
