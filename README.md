# 🚀 PR Review AI

[![CI](https://github.com/VarunNa3530J/PR-Review-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/VarunNa3530J/PR-Review-AI/actions/workflows/ci.yml)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.8-000000.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![Python](https://img.shields.io/badge/Python-3.12%20%7C%203.13-3776AB.svg?logo=python&logoColor=white)](https://www.python.org)
[![Node.js](https://img.shields.io/badge/Node.js-22%20LTS-339933.svg?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Flash%20Models-8E75B2.svg?logo=google&logoColor=white)](https://ai.google.dev)
[![Celery](https://img.shields.io/badge/Celery-5.4+-37814A.svg?logo=celery&logoColor=white)](https://docs.celeryq.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D.svg?logo=redis&logoColor=white)](https://redis.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **Autonomous, enterprise-grade AI code review engine for GitHub Pull Requests and local project repositories.**  
> Detects logic bugs, security vulnerabilities, leaked secrets, and syntax errors with **100% real Abstract Syntax Tree (AST) validation**, verified diff bounds, and an interactive VS Code-style Review Studio.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Tech Stack & Verified Versions](#-tech-stack--verified-versions)
- [Prerequisites](#-prerequisites)
- [Environment Variables](#-environment-variables)
- [Installation & Local Setup](#-installation--local-setup)
  - [Option A: Docker Compose (Recommended)](#option-a-docker-compose-full-stack-recommended)
  - [Option B: Manual Service Setup](#option-b-manual-service-setup-step-by-step)
- [Running Automated Tests & Quality Checks](#-running-automated-tests--quality-checks)
- [Repository Configuration (.prreview.yml)](#-repository-configuration-prreviewyml)
- [API Endpoints Reference](#-api-endpoints-reference)
- [Directory Structure](#-directory-structure)
- [Troubleshooting & FAQs](#-troubleshooting--faqs)
- [License](#-license)

---

## 🎯 Overview

Code reviews consume substantial engineering hours, yet critical syntax bugs, edge-case regressions, and leaked API keys frequently slip into production. 

**PR Review AI** provides an end-to-end, multi-stage automated review pipeline:
1. **Event Ingestion**: Ingests GitHub webhook events (`pull_request.opened`, `synchronize`, `reopened`) with constant-time HMAC-SHA256 signature verification and delivery idempotency.
2. **Multi-Stage Static Analysis**: Scans patches for high-entropy secrets, known security vulnerabilities (SQLi, command injection, path traversal, ReDoS), and code quality smells without invoking LLMs.
3. **Real AST Syntax Validation**: Validates Python Abstract Syntax Trees (`ast.parse`) and syntax constructs to catch errors (trailing dots, incomplete expressions, unbalanced syntax) with zero hallucination.
4. **Context-Aware AI Review**: Dispatches filtered code diffs to Google Gemini Flash (`gemini-2.5-flash`, `gemini-2.0-flash`) using strict JSON schemas and diff boundary checks.
5. **Inline Publishing & Web Studio**: Posts structured review summaries and line-by-line comments directly to GitHub PRs and streams interactive diffs to a Next.js 16 Review Studio dashboard.

---

## ✨ Key Features

- **🛡️ 100% Real AST Syntax Verification**: Real Python `ast.parse` checks syntax integrity before and after suggested patches, eliminating AI hallucination and verifying fixes.
- **🎨 Interactive Review Studio**: Next.js 16 dashboard with red-highlighted error lines, green corrected lines, side-by-side file inspection, and one-click code copying.
- **📁 VS Code-Style File Explorer**:
  - Full tree view with automatic file detection across 30+ languages (Python, TypeScript, JavaScript, SQL, Rust, Go, Java, Dockerfile, YAML, etc.).
  - Dynamic language badges and colored icons.
  - Inline file renaming directly from the dashboard sidebar (`Enter` to commit, `Esc` to cancel).
- **🔒 Automated Secrets & Vulnerability Scanner**:
  - Pre-merge regex pattern scanner for AWS, GitHub, Stripe, OpenAI, Gemini, and generic bearer tokens.
  - Automatic masking of detected secret values in logs and dashboard reports.
  - Prevents secret-bearing files from being sent to external LLM APIs.
- **⚡ Distributed Task Queue**: Decoupled FastAPI API layer with Celery workers backed by Redis for asynchronous review execution, time limits, and retries.
- **🏢 Multi-Tenant Isolation**: Constant-time token comparisons, encrypted credentials via AES-256-GCM, and strictly isolated account resources returning `404 Not Found` for unauthorized tenant access.
- **⚙️ Custom Team Rules**: Configure repository-level review behavior via `.prreview.yml` (path ignore rules, severity thresholds, custom team conventions).

---

## 🏗️ System Architecture

```
                          GitHub Webhook / PR Event
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │   FastAPI Webhook Handler     │
                     │  - HMAC-SHA256 Verification   │
                     │  - Delivery Idempotency Check │
                     │  - 5 MB Payload Size Cap      │
                     └───────────────┬───────────────┘
                                     │ Enqueue task
                                     ▼
                           ┌───────────────────┐
                           │    Redis Broker   │
                           └─────────┬─────────┘
                                     │
                                     ▼
                     ┌───────────────────────────────┐
                     │     Celery Worker Cluster     │
                     │                               │
                     │  1. File Filter & Quota Check │
                     │  2. Static Security & Secrets │
                     │  3. Python AST Syntax Check   │
                     │  4. Gemini AI Review Pass     │
                     │  5. Diff Line Range Validation│
                     │  6. Severity Ranking & Dedupe │
                     └───────┬───────────────┬───────┘
                             │               │
                 Publish     │               │ Persist
                             ▼               ▼
                   ┌────────────────┐  ┌───────────────┐
                   │ GitHub API     │  │  PostgreSQL   │
                   │ - Check Runs   │  │  Database     │
                   │ - Inline Diff  │  └───────┬───────┘
                   │ - PR Summary   │          │ Read stats & reviews
                   └────────────────┘          ▼
                                       ┌───────────────┐
                                       │ Next.js 16    │
                                       │ Review Studio │
                                       └───────────────┘
```

---

## 🛠️ Tech Stack & Verified Versions

| Component | Technology | Verified Version | Purpose |
|---|---|---|---|
| **Backend API** | [FastAPI](https://fastapi.tiangolo.com/) | `0.136.0+` | High-performance asynchronous REST API, OpenAPI docs |
| **ASGI Server** | [Uvicorn](https://www.uvicorn.org/) | `0.34.0+` | Fast ASGI server with standard worker support |
| **Data Validation** | [Pydantic v2](https://docs.pydantic.dev/) | `2.10.0+` | Request schemas, environment settings, and data validation |
| **Worker Queue** | [Celery](https://docs.celeryq.dev/) | `5.4.0+` | Distributed task execution with retry exponential backoff |
| **Message Broker** | [Redis](https://redis.io/) | `7.x` | Message queue for Celery and high-speed delivery deduplication |
| **Database** | [PostgreSQL](https://www.postgresql.org/) | `16.x` | Relational persistence with SQLAlchemy 2.0 and Alembic |
| **AI / LLM** | [Google GenAI SDK](https://ai.google.dev/) | `1.0.0+` | Gemini Flash models (`gemini-2.5-flash`, `gemini-2.0-flash`) |
| **Syntax Analyzer** | Python Standard Library | `ast` | Native Abstract Syntax Tree validation |
| **Frontend Framework** | [Next.js](https://nextjs.org/) | `16.3.8` (App Router) | React Server Components, Turbopack, and API routing |
| **UI Library** | [React](https://react.dev/) | `19.2.8` | Component rendering and client state management |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | `4.3.3` | Utility-first responsive design and dark theme styling |
| **Frontend Types** | [TypeScript](https://www.typescriptlang.org/) | `5.x` | Strict type safety across UI components and client hooks |
| **Testing** | [Pytest](https://pytest.org/) & [Vitest](https://vitest.dev/) | `pytest 8.3+` / `vitest 5.0+` | Unit tests, integration tests, and type checking |

---

## 📋 Prerequisites

Ensure the following tools are installed in your environment:
- **Python**: `3.12` or `3.13` (`python --version`)
- **Node.js**: `22 LTS` (Node `>=20.19.0 || >=22.12.0` required by Vite/Vitest; `node --version`)
- **npm**: `10.x` or `11.x` (`npm --version`)
- **Docker & Docker Compose**: (Optional, for containerized execution; `docker compose version`)
- **Google Gemini API Key**: Obtain a free or paid API key from [Google AI Studio](https://aistudio.google.com/).

---

## 🔑 Environment Variables

### Backend Configuration (`backend/.env`)

Create `backend/.env` using the template below or by copying `backend/.env.example`:

```ini
# Application Environment (local, staging, production)
APP_ENV=local
API_BASE_URL=http://localhost:8000
WEB_BASE_URL=http://localhost:3000
LOG_LEVEL=INFO

# Security Keys (Generate random 32+ character strings for production)
SESSION_SIGNING_KEY=dev_session_signing_key_32_characters_minimum_example
FIELD_ENCRYPTION_KEY=dev_field_encryption_key_32_chars_min_example!

# Database & Cache Connections
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/prreview
REDIS_URL=redis://localhost:6379/0

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_KEY_TIER=free
LLM_REVIEW_MODEL=gemini-2.5-flash
LLM_LIGHT_MODEL=gemini-2.0-flash

# Review Limits
MAX_FILES_PER_REVIEW=40
MAX_LINES_PER_REVIEW=2000
MAX_TOKENS_PER_REVIEW=30000

# GitHub App Configuration (Optional for local studio testing; required for live PR webhooks)
GITHUB_APP_ID=
GITHUB_APP_SLUG=pr-review-ai-dev
GITHUB_APP_PRIVATE_KEY=
GITHUB_WEBHOOK_SECRET=your_github_webhook_secret
```

### Frontend Configuration (`frontend/.env.local`)

```ini
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

---

## 🚀 Installation & Local Setup

### Option A: Docker Compose (Full Stack, Recommended)

The repository provides a complete multi-container setup in [`infra/docker-compose.yml`](infra/docker-compose.yml) running PostgreSQL 16, Redis 7, FastAPI API, Celery Worker, and Next.js Web:

```bash
# 1. Clone repository
git clone https://github.com/VarunNa3530J/PR-Review-AI.git
cd PR-Review-AI

# 2. Build and launch all services in detached mode
docker compose -f infra/docker-compose.yml up --build -d

# 3. Verify container health
docker compose -f infra/docker-compose.yml ps
```

- **Frontend Dashboard**: `http://localhost:3000/app`
- **FastAPI Documentation**: `http://localhost:8000/docs`
- **API Health Check**: `http://localhost:8000/healthz`

To stop containers:
```bash
docker compose -f infra/docker-compose.yml down
```

---

### Option B: Manual Service Setup (Step-by-Step)

#### 1. Start Database & Redis Services
If you have Docker installed, you can spin up just PostgreSQL and Redis:
```bash
docker run -d --name prreview-postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=prreview postgres:16-alpine
docker run -d --name prreview-redis -p 6379:6379 redis:7-alpine
```

#### 2. Setup the Backend API & Virtual Environment
```bash
cd backend

# Create and activate Python virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux / macOS:
# source .venv/bin/activate

# Upgrade pip and install package with dev dependencies
python -m pip install --upgrade pip
pip install -e ".[dev]"

# Configure environment file
cp .env.example .env
# Edit backend/.env and provide your GEMINI_API_KEY

# Start FastAPI development server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Interactive Swagger docs: **`http://127.0.0.1:8000/docs`**

#### 3. Start the Celery Worker (In a separate terminal)
```bash
cd backend
# Activate virtual environment
# Windows: .venv\Scripts\activate | Linux/macOS: source .venv/bin/activate

# Start Celery worker instance
celery -A app.workers.celery_app.celery_app worker --loglevel=info -P solo
# Note: On Windows use '-P solo' or '-P threads'; on Linux/macOS default prefork works.
```

#### 4. Setup the Frontend Review Studio (In a separate terminal)
```bash
cd frontend

# Perform clean dependency installation
npm ci

# Start Next.js development server
npm run dev
```
Open **`http://localhost:3000/app`** in your browser to access the Review Studio.

---

## 🧪 Running Automated Tests & Quality Checks

All linters, typecheckers, security scanners, and test suites run in GitHub Actions CI. You can run every check locally:

### Backend Checks
From the `backend/` directory with virtual environment activated:

```bash
# 1. Linting with Ruff
ruff check .

# 2. Code formatting check with Ruff
ruff format --check .

# 3. Static type checking with Mypy
mypy app

# 4. Security vulnerability scan with Bandit
bandit -c pyproject.toml -r app

# 5. Unit and integration tests with Pytest
pytest -v
```

### Frontend Checks
From the `frontend/` directory:

```bash
# 1. ESLint check
npm run lint

# 2. TypeScript typecheck
npm run typecheck

# 3. Unit tests with Vitest
npm test

# 4. Production build check
npm run build
```

---

## ⚙️ Repository Configuration (`.prreview.yml`)

Configure custom review rules by adding a `.prreview.yml` file to the root of your monitored repositories:

```yaml
# Folders and files the bot skips entirely (glob patterns)
ignore_paths:
  - "dist/**"
  - "build/**"
  - "**/*.min.js"
  - "docs/**"

# Minimum severity threshold to report: critical, high, medium, low, info (default: low)
min_severity: medium

# Block PR merge / fail check run on Critical findings (default: false)
block_on_critical: false

# Review draft pull requests (default: false)
review_drafts: false

# Plain-English rules for your engineering team (max 20)
custom_rules:
  - "Every new public function must have a docstring."
  - "Database queries must use parameterized statements or ORM methods."
  - "Flag any new third-party dependency with explanation."
```

---

## 🔌 API Endpoints Reference

The FastAPI backend exposes the following primary endpoints under `/api/v1`:

### Health & Readiness
- `GET /healthz` — Service liveness probe (returns `{"status": "ok"}`).
- `GET /readyz` — Readiness probe checking environment state and pause switches.

### Webhooks
- `POST /api/v1/webhooks/github` — Ingests GitHub webhook deliveries. Requires `X-Hub-Signature-256`, `X-GitHub-Delivery`, and `X-GitHub-Event` headers.

### Review Studio & Dashboard
- `GET /api/v1/dashboard/overview` — Aggregated account metrics (reviews this month, critical findings, average review duration).
- `GET /api/v1/repos` — Lists monitored repositories and their quality scores.
- `GET /api/v1/reviews` — Lists recent pull request reviews and local audit runs.
- `GET /api/v1/reviews/{review_id}` — Returns findings, risk assessment, and file diffs for a review.
- `POST /api/v1/reviews/review-files` — Triggers an audit across uploaded files or directories with AST and AI analysis.
- `POST /api/v1/reviews/trigger` — Triggers an on-demand review for an individual file patch.

---

## 📁 Directory Structure

```
PR-Review-AI/
├── .github/
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI workflow (lint, test, build, gitleaks)
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py        # Authentication & tenant isolation dependencies
│   │   │   └── v1/            # API routers: webhooks, dashboard, repos, reviews
│   │   ├── core/              # Config, security (AES-GCM/HMAC), logging, error handlers
│   │   ├── db/                # SQLAlchemy models, sessions, Alembic migrations
│   │   ├── services/
│   │   │   ├── analyzers/     # Syntax (AST), secrets scanner, complexity
│   │   │   ├── github/        # GitHub App token exchange & review publisher
│   │   │   ├── llm/           # Google Gemini API integration and fallbacks
│   │   │   └── review/        # Pipeline orchestrator, diff validation, ranking
│   │   ├── workers/           # Celery application and background review task
│   │   └── main.py            # FastAPI application entry point
│   ├── tests/
│   │   ├── fixtures/          # Test diff fixtures and mock repositories
│   │   ├── integration/       # Tenant isolation and webhook security tests
│   │   └── unit/              # Core pipeline, AST parsing, and secret scanner tests
│   ├── pyproject.toml         # Python packaging, Ruff, Mypy, and Pytest configuration
│   └── .env.example           # Backend environment template
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js App Router (Studio, Quality, Repos, Settings)
│   │   ├── components/        # UI components, diff highlighters, file trees
│   │   └── lib/               # Types, API utilities, mock datasets
│   ├── package.json           # Frontend dependencies, scripts, and engines
│   ├── package-lock.json      # Synchronized npm lockfile (satisfies peer dependencies)
│   └── Dockerfile             # Multi-stage production container build (Node 22)
├── infra/
│   ├── docker-compose.yml     # Complete service orchestration (Postgres, Redis, API, Worker, Web)
│   └── .env.example           # Infrastructure environment variable template
├── .prreview.yml              # Default repository review configuration
├── LICENSE                    # MIT License
└── README.md                  # Comprehensive project documentation
```

---

## ❓ Troubleshooting & FAQs

### 1. `npm ci` fails with `Missing: @emnapi/...` or `ERESOLVE`
Ensure you are using **Node.js 22 LTS**. The dependencies (Vite 8 and Vitest 5) specify engine constraints for Node `>=22.12.0`. Run `npm ci` rather than `npm install` to maintain strict dependency tree integrity.

### 2. Celery Worker fails to connect to Redis
Ensure Redis is running on port 6379 (`redis-cli ping` returns `PONG`). If running locally without Docker on Windows, you can start Redis using WSL2 or Docker (`docker run -p 6379:6379 redis:7-alpine`).

### 3. Gemini API Rate Limits or Missing Key
If `GEMINI_API_KEY` is not provided in `backend/.env`, static analysis (AST syntax parsing, secret scanning, and security rule analysis) continues to function, while AI review passes will gracefully fallback or report configuration errors. Check [Google AI Studio](https://aistudio.google.com/) for your API quota.

### 4. Celery on Windows: `ValueError: not enough values to unpack`
Celery's default `prefork` pool is not supported natively on Windows. Pass `-P solo` or `-P threads` when starting the worker:
```bash
celery -A app.workers.celery_app.celery_app worker --loglevel=info -P solo
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
