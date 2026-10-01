# 02 — Architecture: PR Review AI

Reads: `01-prd.md`. Every feature below maps to a PRD feature number (A1 = Review engine item 1, etc. — the PRD numbers 1–24 are used directly, e.g. "F7").

Facts about versions and prices were checked on **1 October 2026** from the sources listed at the end of this file. Re-check before each release. Do not copy a version or price from anywhere else.

---

## 1. System in one picture

```
 GitHub ──webhook──▶ [API: FastAPI] ──enqueue──▶ [Redis queue] ──▶ [Worker: Celery]
   ▲                       │  ▲                                          │
   │                       │  └────── reads/writes ───────┐              │
   │                       ▼                              ▼              ▼
   │                  [PostgreSQL]◀────────────────── review results   [Gemini API]
   │                       ▲                                             [Static analyzers]
   └──── comments, ────────┼─────────────────────────────────────────────┘
         check runs        │
                      [Dashboard: Next.js] ◀── user (browser, GitHub login)
                      [Razorpay] ──webhook──▶ [API]
```

Three deployable parts, one repository:

| Part | Job | Why separate |
|------|-----|--------------|
| **API** (FastAPI) | Receives GitHub and Razorpay webhooks, serves the dashboard API, handles login | Must answer GitHub within seconds, so it never does slow work |
| **Worker** (Celery) | Runs the review pipeline | Reviews take 20–90 seconds and call paid APIs; they must retry and scale on their own |
| **Web** (Next.js) | Dashboard and marketing pages | Different release cycle and hosting from the backend |

---

## 2. Tech stack (each choice has one reason)

### Backend
| Tool | Version (verified) | Reason |
|------|--------------------|--------|
| Python | 3.12 or newer (SQLAlchemy 2.1 needs ≥ 3.11) | Best language ecosystem for AI and code analysis |
| FastAPI | 0.142.2 | Fast, typed, automatic API docs |
| Uvicorn | 0.54.0 | Server for FastAPI |
| Pydantic | 2.13.5 | Input validation and typed models |
| pydantic-settings | 2.15.0 | Typed environment configuration |
| SQLAlchemy | 2.1.1 | Database layer (typed, async-capable) |
| Alembic | 1.20.0 | Database migrations |
| psycopg | 3.3.6 | PostgreSQL driver |
| Celery | 5.6.3 | Background jobs with retries |
| redis (Python client) | 8.1.0 | **Install through `celery[redis]` and let Celery pick the compatible client version. Do not pin it separately.** |
| google-genai | 2.26.0 | Official Gemini SDK |
| PyJWT + cryptography | 2.15.1 / 50.0.2 | Sign the GitHub App token request (RS256) |
| httpx | 0.28.1 | HTTP client for GitHub REST calls |
| tenacity | 9.1.4 | Retry with backoff |
| structlog | 26.1.0 | Structured JSON logs |
| tree-sitter + tree-sitter-language-pack | 0.26.0 / 1.20.0 (MIT) | Language-aware parsing of Python, JS, TS, Java for impact analysis and complexity |
| Semgrep (engine) | 1.178.0 (LGPL-2.1-or-later) | Pattern-based security scanning; see licence note below |
| razorpay (Python SDK) | 2.0.1 | Billing for India |
| Gunicorn | 26.2.0 | Production process manager for Uvicorn workers |
| pytest / ruff / mypy | 9.1.1 / 0.16.9 / 2.3.1 | Tests, lint + format, type checking |

> **Licence note (must resolve before charging money):** the Semgrep engine is LGPL, but community rule packs have their own licence terms. Before using a rule pack in a paid product, read its licence. Safe fallback already planned: ship our own small rule set in `backend/rules/` and use Bandit (Apache-2.0, v1.9.4) for Python.

### Frontend
| Tool | Version (verified) | Reason |
|------|--------------------|--------|
| Next.js | 16.3.8 (needs Node ≥ 20.9.0; Next.js 16 is the Active LTS line) | Routing, server rendering, fast pages |
| React | 19.3.0 | UI library required by Next.js |
| TypeScript | 7.0.2 | Type safety |
| Tailwind CSS | 4.3.3 | Fast, consistent styling |
| shadcn/ui | copied components (no version) | Clean, accessible components we own |
| TanStack Query | 5.104.0 | Data fetching and caching |
| Recharts | 3.10.1 | Dashboard charts |
| Zod | 4.6.5 | Validate API data in the browser |
| ESLint / Vitest / Playwright | 10.11.0 / 5.0.3 / 1.63.0 | Lint, unit tests, end-to-end tests |

### Data and infrastructure
- **PostgreSQL** (current supported major version; confirm on postgresql.org when you provision). Main database.
- **Redis** (or a compatible server) as the job queue and short-lived cache.
- **Docker + Docker Compose** so the whole stack starts with one command.
- **GitHub Actions** for CI.

---

## 3. How a review works (the core pipeline)

Runs inside the worker. Each step is its own small module so it can be tested alone.

1. **Receive** — API verifies the GitHub signature (see security doc), records the delivery ID (to ignore duplicates), enqueues a job, answers `202` immediately. (F1, F15)
2. **Authenticate as the installation** — worker signs a short-lived app token with the app's private key and exchanges it for an installation token. Installation tokens last one hour; they are never stored. (F17)
3. **Check quota** — if the account is over its plan limit, post one friendly "limit reached" comment and stop. (F22–24)
4. **Fetch the change** — list changed files and patches through the GitHub API. No `git clone`, so no repository code is ever on disk as a working tree.
5. **Filter** — drop lockfiles, generated files, binaries, vendored folders, and anything matched by the repo rules file. Rank remaining files by risk (size of change, sensitive paths such as auth or payments, language) and keep the top 40 files / 2,000 changed lines. (F16, PRD decision 4)
6. **Static analysis (fast, cheap, no AI)** — write the head version of each kept file into a temporary folder, run the secrets scanner and the security rules with a timeout, delete the folder. Findings carry `source = "static"`. (F3)
7. **Build context** — for each file: the diff plus a limited window of surrounding code, the file's imports, and matching test file names. (F9)
8. **AI review** — send context to Gemini with a strict JSON output schema. The model is asked only for: line, severity, category, explanation, and an optional replacement snippet. (F2, F4–F8)
9. **Validate** — every AI finding must point to a real line that is part of the diff. Findings that do not are discarded. Suggested replacements must apply cleanly to the line range or they are shown as plain text, not as a one-click suggestion.
10. **Merge and rank** — combine static and AI findings, remove duplicates by fingerprint (file + rule + normalised code), apply the repo rules file (ignored paths, minimum severity, custom rules), apply "ignore this kind" feedback, then sort by severity. (F5, F14, F16)
11. **Impact analysis** — list tests and likely-affected files (see section 5). (F9)
12. **Publish** — one GitHub review with inline comments, one summary comment (summary, risk score, counts, not-reviewed list), and one check run with pass/fail. On a re-push, update the existing summary and resolve comments whose issue is gone instead of posting again. (F6, F11, F12, F15)
13. **Record** — save the review, findings, token counts, cost estimate, and timings. Increase the usage counter. (F18–F24)

If any step after 3 fails permanently, the check run is marked "neutral" with a short error message. The bot never leaves a PR in a silent failed state.

---

## 4. Data model

All tables use UUID primary keys, `created_at`, and `updated_at`.

| Table | Purpose | Key columns |
|-------|---------|-------------|
| `users` | Dashboard users | `github_user_id` (unique), `login`, `email`, `avatar_url` |
| `sessions` | Server-side login sessions | `user_id`, `token_hash`, `expires_at`, `revoked_at` |
| `accounts` | Billing and ownership unit (a GitHub user or organisation) | `github_account_id`, `login`, `type`, `plan_id` |
| `account_members` | Which user belongs to which account | `account_id`, `user_id`, `role` (owner, member) |
| `installations` | GitHub App installations | `github_installation_id`, `account_id`, `suspended_at` |
| `repositories` | Repos the bot can see | `github_repo_id`, `installation_id`, `full_name`, `is_private`, `is_enabled` |
| `repo_settings` | Cached copy of the repo rules file and dashboard overrides | `repo_id`, `config_json`, `config_sha` |
| `pull_requests` | PR snapshot | `repo_id`, `number`, `title`, `author_login`, `head_sha`, `state` |
| `reviews` | One row per review run | `pr_id`, `head_sha`, `status`, `risk_level`, `files_reviewed`, `files_skipped`, `tokens_in`, `tokens_out`, `cost_usd_estimate`, `duration_ms`, `github_review_id`, `check_run_id` |
| `findings` | One row per issue found | `review_id`, `fingerprint`, `file_path`, `line_start`, `line_end`, `severity`, `category`, `source` (static or ai), `title`, `explanation`, `suggested_patch`, `github_comment_id`, `status` (open, resolved, dismissed) |
| `finding_feedback` | Helpful / not helpful / ignore-kind | `finding_id`, `user_id`, `kind`, `rule_key` |
| `webhook_deliveries` | Idempotency log | `delivery_id` (unique), `source` (github, razorpay), `event`, `received_at`, `processed_at` |
| `plans` | Plan definitions and limits | `key` (free, pro, team), `monthly_review_limit_public`, `monthly_review_limit_private`, `features_json` |
| `subscriptions` | Paid state | `account_id`, `provider`, `provider_subscription_id`, `status`, `current_period_end` |
| `usage_counters` | Reviews used per month | `account_id`, `period` (YYYY-MM), `public_used`, `private_used` |
| `notification_settings` | Alerts | `account_id`, `email_enabled`, `slack_webhook_encrypted` |
| `audit_log` | Security-relevant actions | `account_id`, `actor_user_id`, `action`, `metadata_json` |

Rules:
- Source code from customer repositories is **not stored**. Only the finding text, line numbers, and a short code excerpt (max 10 lines) are kept. See the security doc for retention.
- `findings.fingerprint` is a hash. It is what makes "no duplicate comments" work.
- Money values are never floats. Costs use integer micro-dollars.

---

## 5. Key design decisions and trade-offs

| Decision | Choice | Trade-off |
|----------|--------|-----------|
| Delivery model | GitHub App (not personal tokens or per-repo webhooks) | Slightly more setup; gives narrow permissions, per-repo install, and short-lived tokens |
| Work queue | Celery + Redis | More moving parts than in-process tasks, but reviews survive restarts and can retry |
| No cloning | Fetch files through the API | Cannot run whole-project tools; much safer, and fast for small PRs |
| Hybrid analysis | Static tools first, AI second | Static tools give precise, cheap, repeatable security hits; AI covers logic and design. This also cuts AI cost and noise |
| Validate AI output | Reject findings that do not map to diff lines | Fewer comments, far fewer wrong ones |
| Impact analysis (V1) | Three cheap signals: (1) test files matching changed files by naming convention, (2) files that import a changed module, found by parsing the repository file tree with tree-sitter on at most 15 candidate files, (3) a short AI summary of likely impact | Not a full call graph. Honest label in the UI: "likely affected" |
| Model use | Two tiers: a stronger model for the review, a cheaper one for summaries, chat replies, and classification | Slight complexity; large saving |
| Model names | Read from environment variables, never hardcoded | Google retires models often; swapping must be a config change |
| Billing | Razorpay behind a `BillingProvider` interface | India-first; a Stripe provider can be added without touching business logic |
| Login | GitHub only | No password system to secure |

---

## 6. External services, limits and costs

### Gemini API (verified on the official pricing page)
- **Review model:** `gemini-3.8-flash`. Standard paid tier: **$0.75 per 1M input tokens and $3.75 per 1M output tokens through 31 Dec 2026**, rising to **$1.50 / $7.50 from 1 Jan 2027**. Output price includes thinking tokens.
- **Light model:** `gemini-3.5-flash-lite`: **$0.30 input / $2.50 output** per 1M tokens.
- **Batch and Flex** modes are half price but can be slow. They are for background jobs such as nightly re-scoring, not for live PR reviews.
- **Important:** on the **free tier, Google may use content to improve its products; on the paid tier it does not.** Because we send customers' private code, production must use a **paid** key. The free key is for local development with public or fake code only.
- **Cost estimate per review** (assumption: about 20,000 input tokens and 4,000 output tokens including thinking): about **$0.03** now, about **$0.06** from 1 Jan 2027. Real numbers are stored per review in `reviews.cost_usd_estimate` so this estimate can be replaced with measurements.

### Razorpay (verified on Razorpay's pricing pages)
- Standard domestic pricing: **2% platform fee plus 18% GST on that fee** (about 2.36% effective), no setup fee, no annual fee. Charged only on successful payments.
- Recurring billing uses **Razorpay Subscriptions**, which has an **additional per-charge fee**. The exact figure was not clearly stated on the pages checked, so read the live pricing page before setting plan prices.
- Razorpay requires a registered business with the usual Indian KYC documents. Confirm requirements before launch.

### GitHub
- Webhook signature header is `X-Hub-Signature-256` (HMAC-SHA256). Installation tokens expire one hour after creation.
- Use `X-GitHub-Delivery` as the idempotency key.
- Respect API rate limits: read the rate-limit headers and back off. Search endpoints have stricter limits, so impact analysis caps and caches its calls.

### Hosting
Prices for hosting are **intentionally not listed**; none were verified. The deployment doc names the hosting shape and what to check when choosing a provider.

---

## 7. Folder structure

```
pr-review-ai/
├── CLAUDE.md
├── README.md
├── LICENSE
├── docs/                     # the six spec files
├── backend/
│   ├── pyproject.toml
│   ├── Dockerfile
│   ├── alembic.ini
│   ├── migrations/
│   ├── rules/                # our own static-analysis rules
│   ├── prompts/              # versioned prompt files (review.md, summary.md, chat.md)
│   ├── app/
│   │   ├── main.py           # creates the FastAPI app
│   │   ├── core/             # config, logging, security helpers, errors, rate limits
│   │   ├── api/v1/           # webhooks.py, auth.py, repos.py, reviews.py, dashboard.py, billing.py, settings.py
│   │   ├── db/               # base.py, session.py, models/
│   │   ├── schemas/          # Pydantic request/response models
│   │   ├── services/
│   │   │   ├── github/       # auth.py (app JWT, installation token), client.py, publisher.py
│   │   │   ├── review/       # pipeline.py, filtering.py, context.py, validate.py, ranking.py, impact.py
│   │   │   ├── llm/          # base.py (interface), gemini.py, schemas.py
│   │   │   ├── analyzers/    # semgrep_runner.py, secrets.py, complexity.py, duplication.py
│   │   │   ├── billing/      # base.py, razorpay.py, usage.py
│   │   │   └── notify/       # email.py, slack.py
│   │   └── workers/          # celery_app.py, tasks.py
│   └── tests/
│       ├── unit/
│       ├── integration/
│       └── fixtures/         # known-vulnerable sample PRs (see PRD success criteria)
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   └── src/
│       ├── app/              # routes (see frontend doc)
│       ├── components/       # ui/ (shadcn), layout/, review/, charts/
│       ├── lib/              # api client, auth helpers, formatters
│       └── hooks/
├── infra/
│   ├── docker-compose.yml
│   └── .env.example
├── examples/
│   └── .prreview.yml         # sample rules file
└── .github/workflows/        # ci.yml, release.yml
```

Layering rule: `api` calls `services`; `services` call `db` and external clients; nothing in `services` imports from `api`. Routes stay thin (parse, call one service, return).

---

## 8. API surface (backend)

All under `/api/v1`. JSON only. Errors use one shape: `{ "error": { "code": "...", "message": "..." } }`.

| Method and path | Who | Purpose |
|-----------------|-----|---------|
| `POST /webhooks/github` | GitHub | Receive events (signature required) |
| `POST /webhooks/razorpay` | Razorpay | Receive payment events (signature required) |
| `GET /auth/github/login` | Public | Start GitHub login |
| `GET /auth/github/callback` | Public | Finish login, create session |
| `POST /auth/logout` | User | End session |
| `GET /me` | User | Current user and accounts |
| `GET /repos` | Member | Repos for an account |
| `PATCH /repos/{id}` | Owner | Enable or disable the bot for a repo |
| `GET /repos/{id}/reviews` | Member | Review history |
| `GET /reviews/{id}` | Member | One review with findings |
| `POST /findings/{id}/feedback` | Member | Helpful, not helpful, ignore-kind |
| `GET /dashboard/overview` | Member | Account-level numbers |
| `GET /dashboard/repos/{id}/quality` | Member | Trends for one repo |
| `GET /usage` | Member | Reviews used this month |
| `POST /billing/checkout` | Owner | Start a paid plan |
| `GET /billing/subscription` | Owner | Plan state |
| `PUT /settings/notifications` | Owner | Email and Slack alerts |
| `GET /healthz` and `GET /readyz` | Platform | Liveness and readiness |

---

## 9. Observability

- Structured JSON logs with `request_id`, `delivery_id`, `review_id`, `installation_id`. No source code and no tokens in logs, ever.
- Metrics per review: duration per pipeline step, tokens in and out, findings per severity, GitHub API calls, retries.
- Error tracking and uptime checks are chosen in the deployment doc.

---

## Sources checked (1 October 2026)

- Gemini API pricing (official): https://ai.google.dev/gemini-api/docs/pricing
- Next.js support policy (Active LTS): https://nextjs.org/support-policy
- npm registry (Next.js, React, Tailwind, TypeScript, Zod, TanStack Query, Recharts, ESLint, Vitest, Playwright): https://registry.npmjs.org
- PyPI (all Python packages above): https://pypi.org
- GitHub: validating webhook deliveries: https://docs.github.com/webhooks/securing
- GitHub installation tokens expire after one hour (REST docs for "create an installation access token"): https://docs.github.com/rest/reference/apps/#create-an-installation-access-token-for-an-app
- Razorpay pricing explained: https://razorpay.com/blog/razorpay-payment-gateway-pricing-explained/
- Razorpay standard rate (2% + 18% GST): https://razorpay.com/blog/razorpay-shopify-payment-gateway-pricing-explained/

Conflicts and gaps found: the Razorpay subscription add-on fee differs between secondary sources and was not confirmed on the official page, so no number is locked. The GitHub installation-token lifetime was confirmed from GitHub's REST reference as quoted in a mirror of it; re-confirm on docs.github.com when building ticket 05.
