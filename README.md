
#  darknet-leak-detection 

An AI-assisted platform for early detection of data leaks. The system continuously monitors darknet forums, ransomware leak sites, and paste platforms, normalizes the collected data, and exposes it through a REST API and a web dashboard.

---

## Table of Contents

- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Services & Ports](#services--ports)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Collectors](#collectors)
- [CAPTCHA Strategy](#captcha-strategy)
- [API Reference](#api-reference)
- [Tech Stack](#tech-stack)
- [Development Conventions](#development-conventions)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Compose                           │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Frontend   │    │   Backend    │    │   PostgreSQL 15  │  │
│  │  React/Vite  │───▶│   FastAPI    │───▶│   datenleck_db   │  │
│  │  :62000      │    │   :62001     │    │   :5433          │  │
│  └──────────────┘    └──────┬───────┘    └──────────────────┘  │
│                             │                      ▲            │
│  ┌──────────────┐    ┌──────▼───────┐             │            │
│  │     Tor      │    │  Collector   │─────────────┘            │
│  │  SOCKS :9050 │◀───│  scheduler  │                           │
│  │  Ctrl  :9051 │    │  + pipeline │                           │
│  └──────────────┘    └──────────────┘                          │
│                                                                 │
│  ┌──────────────────────────────────────────────┐              │
│  │  OLLAMA (host machine)  :11434               │              │
│  │  Vision model for CAPTCHA solving            │              │
│  └──────────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
[Collectors] ──raw JSON──▶ raw_storage/
                                │
                         [Parser / Dedup]
                                │
                         [Analysis Pipeline]
                         ├── company_detector
                         ├── credential_detector
                         └── terminology_detector
                                │
                          [PostgreSQL]
                                │
                          [FastAPI Backend]
                                │
                          [React Frontend]
```

---

## Repository Structure

```
.
├── analysis/                        # AI/NLP analysis modules
│   ├── config/
│   │   ├── company_profiles.yaml    # Known company patterns
│   │   ├── patterns.yaml            # Regex patterns (emails, IPs, etc.)
│   │   └── terminology.yaml        # Leak-related terminology
│   └── detectors/
│       ├── company_detector.py
│       ├── credential_detector.py
│       └── terminology_detector.py
│
├── backend/                         # FastAPI application
│   ├── alembic/                     # Database migrations
│   ├── routers/
│   │   ├── source.py                # Source CRUD endpoints
│   │   ├── company.py               # Company CRUD endpoints
│   │   └── crawl_job.py             # Crawl job status endpoints
│   ├── main.py                      # FastAPI entry point + /health + /stats
│   ├── models.py                    # SQLAlchemy models
│   ├── schemas.py                   # Pydantic schemas
│   ├── crud.py                      # DB operations
│   └── db.py                        # Database session
│
├── collectors/                      # Data collection layer
│   ├── config/
│   │   ├── forums.yaml              # Forum/SPA source configurations
│   │   ├── paste_sites.yaml         # Paste platform configurations
│   │   └── ransomware_sites.yaml    # 444 ransomware group URLs (ransomlook.io)
│   ├── darknet_forum_collector.py   # HTTP forum scraping (requests + BS4)
│   ├── darknet_forum_collector_authenticated.py  # Login-required forums
│   ├── js_collector.py              # SPA scraping (Playwright)
│   ├── paste_collector.py           # Paste site collection
│   ├── ransomwatch_collector.py     # Ransomwatch public feed
│   ├── tor_manager.py               # Tor circuit management (stem)
│   ├── captcha_solver.py            # Multi-layer CAPTCHA solver
│   ├── authentication_manager.py    # Session/cookie management
│   ├── rate_limiter.py              # Request throttling, UA rotation
│   ├── parser.py                    # HTML cleaning, dedup, language detect
│   ├── ingestion_pipeline.py        # raw_storage → parse → DB
│   ├── account_generator.py         # Fake account generation (Faker)
│   └── scheduler.py                 # 3-hour collection loop
│
├── frontend/                        # React dashboard
│   └── src/
│       ├── pages/                   # Route-level page components
│       ├── components/              # Reusable UI components
│       └── api/                     # Backend API client
│
├── tor/                             # Tor container config
│   ├── Dockerfile
│   └── torrc
│
├── docker-compose.yml               # Full stack orchestration
├── requirements.txt                 # Python dependencies
├── .env.example                     # Environment variable template
└── .gitlab-ci.yml                   # CI/CD pipeline
```

---

## Services & Ports

| Service | Container | Host Port | Internal Port |
|---------|-----------|-----------|---------------|
| Frontend (React/Vite) | `datenleck_frontend` | **62000** | 5173 |
| Backend (FastAPI) | `datenleck_backend` | **62001** | 8000 |
| PostgreSQL 15 | `datenleck_postgres` | **5433** | 5432 |
| Tor SOCKS proxy | `datanleck_tor` | **9050** | 9050 |
| Tor control port | `datanleck_tor` | **9051** | 9051 |
| OLLAMA (host) | — | **11434** | — |

> **URLs:**
> - Frontend: http://localhost:62000
> - Backend API: http://localhost:62001
> - API Docs (Swagger): http://localhost:62001/docs

---

## Quick Start

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) + [Docker Compose](https://docs.docker.com/compose/)
- [OLLAMA](https://ollama.com/) running on the host machine with a vision model (for CAPTCHA solving)

```bash
# Install a vision model in OLLAMA (on host)
ollama pull llava
# or for better accuracy:
ollama pull qwen3-vl:32b
```

### 1. Clone & configure

```bash
git clone <repo-url>
cd ki-gestuetztes-system-zur-fruehzeitigen-erkennung-von-datenlecks
cp .env.example .env
```

Edit `.env` and fill in credentials for the forums you want to monitor (see [Environment Variables](#environment-variables)).

### 2. Start all services

```bash
docker compose up --build
```

Or in detached mode:

```bash
docker compose up --build -d
```

### 3. Verify

```bash
# Backend health
curl http://localhost:62001/health
# → {"status": "ok"}

# System stats
curl http://localhost:62001/stats
```

Open the dashboard: **http://localhost:62000**

### 4. Useful Docker commands

```bash
# View logs
docker compose logs -f collector
docker compose logs -f backend

# Stop everything
docker compose down

# Stop and remove volumes (full reset)
docker compose down -v

# Run Alembic migration manually
docker compose exec backend alembic upgrade head

# Check migration status
docker compose exec backend alembic current
```

---

## Environment Variables

Copy `.env.example` to `.env` and set the following:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+psycopg2://postgres:password@db:5432/datenleck_db` | PostgreSQL connection string |
| `FRONTEND_PORT` | `62000` | Host port for the frontend |
| `BACKEND_PORT` | `62001` | Host port for the backend |
| `TOR_CONTROL_PASSWORD` | — | Tor control port password |
| `OLLAMA_URL` | `http://localhost:11434` | OLLAMA API endpoint (host machine) |
| `OLLAMA_CAPTCHA_MODEL` | `llava` | Vision model for CAPTCHA solving |
| `LLM_ANALYSIS_ENABLED` | `false` | Enables optional LLM enrichment after deterministic analysis |
| `LLM_ANALYSIS_PROVIDER` | `ollama` | LLM provider: `ollama`, `github-models`, or `openai-compatible` |
| `LLM_ANALYSIS_URL` | `http://localhost:9999/api/generate` | LLM endpoint URL |
| `LLM_ANALYSIS_MODEL` | `llama3.1` | Model name sent to the LLM service |
| `LLM_ANALYSIS_API_KEY` | — | Optional bearer token for GitHub Models or OpenAI-compatible providers |
| `LLM_ANALYSIS_TIMEOUT` | `30` | LLM request timeout in seconds |
| `PASTEEE_API_KEY` | — | Paste.ee API key (optional) |
| `BREACHFORUMS_USER` | — | BreachForums account username |
| `BREACHFORUMS_PASS` | — | BreachForums account password |
| `XSSFORUM_USER` | — | XSS.is account username |
| `XSSFORUM_PASS` | — | XSS.is account password |
| `EXPLOITIN_USER` | — | Exploit.in account username |
| `EXPLOITIN_PASS` | — | Exploit.in account password |
| `CRACKED_USER` | — | Cracked.io account username |
| `CRACKED_PASS` | — | Cracked.io account password |

> Forum credentials are only used for authenticated scraping. The system can run without them, but authenticated forums will be skipped.

### Optional LLM Analysis Enrichment

The deterministic analysis pipeline remains the source of truth for company matching, credential detection, terminology detection, risk scoring, and classification. If `LLM_ANALYSIS_ENABLED=false`, analysis runs without contacting an LLM.

When enabled, the LLM enrichment runs after deterministic analysis and writes a concise threat explanation into the analysis metadata. Dashboard finding details use this explanation when available. LLM failures are logged and do not stop ingestion.

For a private Ollama-compatible LLM, expose the service locally first, for example through an SSH tunnel:

```bash
ssh -N -L 9999:<school-llm-host>:<school-llm-port> <school-user>@<school-jump-host>
```

Then configure `.env` with placeholders replaced locally:

```bash
LLM_ANALYSIS_ENABLED=true
LLM_ANALYSIS_PROVIDER=ollama
LLM_ANALYSIS_URL=http://localhost:9999/api/generate
LLM_ANALYSIS_MODEL=<school-model-name>
LLM_ANALYSIS_TIMEOUT=30
```

For GitHub Models, use the chat completions endpoint and a local token with Models read access:

```bash
LLM_ANALYSIS_ENABLED=true
LLM_ANALYSIS_PROVIDER=github-models
LLM_ANALYSIS_URL=https://models.github.ai/inference/chat/completions
LLM_ANALYSIS_MODEL=openai/gpt-5
LLM_ANALYSIS_API_KEY=<github-models-token>
LLM_ANALYSIS_TIMEOUT=60
```

Do not commit SSH keys, passwords, API tokens, or real private endpoint details.

#### Demo verification for dashboard explanations

Use preview dashboard data when live LLM access is unavailable. The finding detail API still returns a structured `llm_explanation` object with `status`, `text`, `source`, `is_available`, and `fallback_reason`, so the dashboard can show whether the explanation came from an LLM or from the deterministic fallback.

Manual verification flow:

1. Keep `LLM_ANALYSIS_ENABLED=false` and open a finding detail in the dashboard.
2. Confirm the `AI Threat Explanation` panel shows fallback text and an unavailable/disabled state without breaking the modal.
3. Enable the LLM locally with placeholder values replaced only in `.env`, then ingest or open a finding that has `llm_enrichment.status=ok`.
4. Confirm `/api/dashboard/findings/{id}` includes `llm_explanation.is_available=true` and the dashboard labels the explanation as available.
5. Confirm failed or empty LLM responses never expose API keys, SSH keys, private endpoint URLs, or raw credential values in the UI or logs.

---

## Collectors

The scheduler (`collectors/scheduler.py`) runs every **3 hours** and executes all enabled collectors in sequence.

### Configured Sources

| Source | Type | Network | Auth |
|--------|------|---------|------|
| RansomHouse | Ransomware leak site (SPA) | Tor (.onion) | None |
| BreachForums | Forum | Tor (.onion) + Clearnet | Login required |
| XSS.is | Forum | Tor (.onion) + Clearnet | Login required |
| Exploit.in | Forum | Tor (.onion) + Clearnet | Invite-only |
| Cracked.io | Forum | Clearnet | Login required |
| Wilders Security | News forum | Clearnet | None |
| Ransomwatch feed | Public JSON feed | Clearnet | None |
| 444 ransomware groups | Leak sites | Tor (.onion) | None |

### Collector Types

| Collector | Use Case | Technology |
|-----------|----------|------------|
| `darknet_forum_collector_authenticated` | Login-required forums | requests + BeautifulSoup4 |
| `js_collector` (SPALeakCollector) | JavaScript-rendered sites | Playwright + Chromium |
| `ransomwatch_collector` | Ransomwatch public feed | requests + JSON |
| `paste_collector` | Paste platforms | requests / API |

### Ransomware Sites

`collectors/config/ransomware_sites.yaml` contains **444 ransomware group** URLs sourced from [ransomlook.io](https://www.ransomlook.io/urls):

- **3,164 total URLs** (3,023 Tor .onion + 141 clearnet)
- **135 currently active** (`enabled: true`) — had at least one reachable URL at time of generation
- **309 inactive** (`enabled: false`) — all known URLs were offline

### Ingestion Pipeline

After collection, `ingestion_pipeline.py` processes raw JSON files:

```
raw_storage/*.json
      │
  [Parser]        ← HTML cleaning, deduplication, language detection
      │
  [Detectors]     ← company, credential, terminology analysis
      │
  [PostgreSQL]    ← LeakRecord, Source, CrawlJob tables
      │
  raw_storage/ → processed_storage/ or failed_storage/
```

---

## CAPTCHA Strategy

The system uses a three-layer approach:

```
Page load (StealthyFetcher / requests)
     │
     ├── Cloudflare? ──── Layer 1: Scrapling StealthyFetcher auto-bypass (~95%)
     │
     ├── Forum CAPTCHA? ── Layer 2: captcha_solver.py (Ollama Vision + Tesseract)
     │                         ├── Text CAPTCHA   → Ollama llava / qwen3-vl  (~70-85%)
     │                         ├── Grid CAPTCHA   → Ollama vision             (~60-75%)
     │                         ├── Math CAPTCHA   → Regex + Ollama LLM        (~95%+)
     │                         └── Slider CAPTCHA → Ollama position estimate  (~50-65%)
     │                              └── Failed? ── Layer 3: External API (2Captcha / CapSolver)
     │
     └── No CAPTCHA → direct scrape
```

Layer 3 (external API) is optional and not enabled by default. It requires a paid API key from [CapSolver](https://capsolver.com) or [2Captcha](https://2captcha.com).

---

## API Reference

Base URL: `http://localhost:62001`

### Health & Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health check |
| `GET` | `/stats` | Collection and analysis statistics |

### Sources

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/sources/` | List all sources |
| `POST` | `/sources/` | Create a new source |
| `PUT` | `/sources/{id}` | Update a source |
| `PATCH` | `/sources/{id}/toggle` | Enable / disable a source |
| `DELETE` | `/sources/{id}` | Delete a source |

### Companies

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/companies/` | List monitored companies |
| `POST` | `/companies/` | Add a company to monitor |
| `PUT` | `/companies/{id}` | Update company profile |
| `DELETE` | `/companies/{id}` | Remove a company |

### Crawl Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/crawl-jobs/` | List crawl job history |
| `GET` | `/crawl-jobs/{id}` | Get single job status |

> Interactive API docs available at: **http://localhost:62001/docs**

---

## Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | React 18 + Vite + Tailwind CSS | Fast HMR, utility-first styling |
| Backend | FastAPI + Uvicorn | Async-friendly, auto OpenAPI docs |
| Database | PostgreSQL 15 | Reliable relational model, indexed queries |
| ORM | SQLAlchemy 2.0 | Schema control, portability |
| Migrations | Alembic | Versioned DB evolution |
| Scraping | requests + BeautifulSoup4 + Playwright | Multi-mode: static + JS-rendered |
| Tor | stem + PySocks | Anonymous crawling, circuit rotation |
| CAPTCHA | Ollama Vision (llava / qwen3-vl) + Tesseract | Local AI, no external dependency |
| Orchestration | Docker Compose | Reproducible multi-service setup |
| Scheduling | schedule | Lightweight 3-hour crawl loop |

---

## Development Conventions

### Branch naming

```
feature/<short-description>
fix/<short-description>
chore/<short-description>
setup/<short-description>
```

### Commit format (Conventional Commits)

```
feat: add ransomware site bulk import
fix: handle null URL in source parser
docs: update architecture overview
chore: upgrade playwright to 1.58
```

### Python style

- PEP 8, explicit imports, type hints where practical
- No inline comments unless the *why* is non-obvious
- Tests live in `collectors/tests/`

### Adding a new source

1. Add an entry to `collectors/config/forums.yaml` (forum/SPA) or `ransomware_sites.yaml` (ransomware leak site)
2. Set `enabled: true` and choose `engine: scrapling` or `engine: legacy`
3. Add credentials to `.env` if auth is required
4. Restart the collector: `docker compose restart collector`
