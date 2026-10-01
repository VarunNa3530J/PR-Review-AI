# 05 — Tickets: PR Review AI

Reads: `01-prd.md`, `02-architecture.md`, `03-security.md`, `04-frontend.md`, and `06-deployment.md` for environment names.

**Engineering Execution:** Tickets are organized in sequential phases. Work ticket by ticket in dependency order. Every ticket includes strict acceptance criteria, test coverage requirements, and security review points.

Every ticket's **Done when** includes: tests pass, lint and type checks pass, and the security points listed for that ticket are met.

Legend: **Deps** = tickets that must be finished first.

---

## Phase 0 — Foundation

### 01 — Project setup
**Deps:** none
**Build:** Create the repository layout from `02-architecture.md` section 7. Backend with `pyproject.toml`, ruff, mypy, pytest. Frontend with Next.js, TypeScript strict, Tailwind, ESLint, Vitest. Pre-commit hooks (format, lint, secrets scan). `.gitignore`, `LICENSE`, `.env.example` with placeholders only. Root `README.md` stub. CI workflow running lint, type check, and tests for both sides.
**Files:** `backend/pyproject.toml`, `frontend/package.json`, `.pre-commit-config.yaml`, `.github/workflows/ci.yml`, `infra/.env.example`, `.gitignore`
**Security points:** no real secrets anywhere; secrets scan runs in CI.
**Done when:** a fresh clone passes CI on an empty app; one example test passes on each side.

### 02 — Docker Compose dev stack
**Deps:** 01
**Build:** `infra/docker-compose.yml` with API, worker, web, PostgreSQL, Redis. Backend and worker share one image. Health checks. Non-root users.
**Files:** `infra/docker-compose.yml`, `backend/Dockerfile`, `frontend/Dockerfile`
**Done when:** `docker compose up` starts everything; `GET /healthz` returns OK; web shows a placeholder page.

### 03 — Backend core (config, logging, errors)
**Deps:** 01
**Build:** typed settings from environment (fails at startup if a required value is missing), structured logging with redaction filter, one error shape, request ID middleware, `GET /healthz` and `GET /readyz` (checks database and Redis).
**Files:** `backend/app/core/config.py`, `logging.py`, `errors.py`, `app/main.py`
**Security points:** log redaction test proves tokens and `Authorization` headers are masked; production mode refuses to start without required secrets.
**Done when:** unit tests cover config validation, redaction, and error format.

### 04 — Database and migrations
**Deps:** 03, 02
**Build:** SQLAlchemy models for every table in `02-architecture.md` section 4, Alembic setup, first migration, session helper, seed script for plans (free, pro, team) with limits from PRD decision 1.
**Files:** `backend/app/db/**`, `backend/migrations/**`, `backend/scripts/seed_plans.py`
**Security points:** unique constraint on `webhook_deliveries.delivery_id`; encrypted-column type for Slack URL (field-encryption helper from ticket 05).
**Done when:** migration applies and rolls back cleanly on an empty database; model tests pass.

### 05 — Security primitives
**Deps:** 03
**Build:** constant-time HMAC verification helper, field encryption helper (authenticated encryption, key from settings), secure random token and hash helper, safe path join, rate limiter backed by Redis, security-headers middleware, strict CORS.
**Files:** `backend/app/core/security.py`, `rate_limit.py`, `paths.py`
**Done when:** unit tests cover wrong signature, empty signature, tampered body, path traversal attempts (`..`, absolute, symlink), and rate-limit rollover.

---

## Phase 1 — GitHub connection and login

### 06 — GitHub App auth and client
**Deps:** 03, 05
**Build:** create app token from the private key (RS256), exchange for installation token, in-memory cache that refreshes before the one-hour expiry, `httpx` client with retry and rate-limit header handling, methods to list PR files, get file content, get repo tree, and read the rules file.
**Files:** `backend/app/services/github/auth.py`, `client.py`
**Security points:** tokens never logged or stored; private key read only from settings.
**Done when:** tests with a mocked GitHub cover token refresh, rate-limit backoff, and `404` handling. Re-confirm the token lifetime on docs.github.com and note it in the code comment.

### 07 — Webhook receiver (GitHub)
**Deps:** 04, 05, 06
**Build:** `POST /api/v1/webhooks/github`. Verify signature first, then check idempotency by delivery ID, then validate the event, then enqueue. Handle `installation`, `installation_repositories`, and `pull_request` (opened, synchronize, reopened, ready_for_review). Ignore drafts unless the rules file says otherwise. Return `202` fast.
**Files:** `backend/app/api/v1/webhooks.py`, `backend/app/services/github/events.py`
**Security points:** abuse cases 1 and 2 in `03-security.md` have automated tests; body size cap.
**Done when:** signed fixture payloads enqueue exactly one job; replay is ignored; bad signature returns `401`.

### 08 — Login with GitHub and sessions
**Deps:** 04, 05, 06
**Build:** login start and callback, signed `state`, installation-access confirmation, server-side sessions, logout, `GET /me`, CSRF header check, role detection (owner or member).
**Files:** `backend/app/api/v1/auth.py`, `backend/app/services/auth/sessions.py`, `permissions.py`
**Security points:** cookie flags per security doc; abuse cases 7 and 8 tested.
**Done when:** end-to-end test with a mocked GitHub logs in, reads `/me`, logs out, and the old cookie no longer works.

### 09 — Tenant isolation guard
**Deps:** 08
**Build:** a single dependency that resolves `account_id` from the session and a query helper that always filters by it. Add a test suite that tries to read every list and detail route as another account.
**Files:** `backend/app/api/deps.py`, `backend/tests/integration/test_tenant_isolation.py`
**Done when:** the suite fails if any route returns another account's row; returns `404` for foreign IDs.

---

## Phase 2 — Review engine

### 10 — Job queue and worker skeleton
**Deps:** 02, 07
**Build:** Celery app, `review_pull_request` task with retries and backoff, task time limit, per-account concurrency limit, dead-letter handling that marks the review as failed and posts a neutral check run.
**Files:** `backend/app/workers/celery_app.py`, `tasks.py`
**Done when:** a webhook produces a `reviews` row with status moving queued → running → done in a test with a fake pipeline.

### 11 — Diff fetching and file filtering
**Deps:** 06, 10
**Build:** fetch changed files and patches; filter lockfiles, generated files, binaries, vendored folders, oversized files (over 256 KB); detect language by extension (Python, JavaScript, TypeScript, Java); risk-rank files; apply the 40 files / 2,000 lines cap; record skipped files with reasons.
**Files:** `backend/app/services/review/filtering.py`, `diff.py`
**Done when:** table-driven tests cover every skip reason and the cap.

### 12 — Rules file (`.prreview.yml`)
**Deps:** 06
**Build:** schema, safe parser, size and count limits, defaults, merge with dashboard overrides. Ship `examples/.prreview.yml`. Options: ignored paths, minimum severity, block-on-critical (default off), review drafts (default off), custom rules (plain-English list, max 20).
**Files:** `backend/app/services/review/config.py`, `examples/.prreview.yml`
**Security points:** safe YAML load only; oversized or malformed file produces a friendly summary note and falls back to defaults.
**Done when:** valid, invalid, and hostile files are all handled in tests.

### 13 — Secrets scanner
**Deps:** 11
**Build:** pattern and entropy based scanner for common key formats, with masking of the found value. Mark files containing live secrets as "do not send to AI".
**Files:** `backend/app/services/analyzers/secrets.py`
**Security points:** abuse case 6; findings never include the full secret.
**Done when:** fixture files with fake keys are detected and masked; clean files produce no findings.

### 14 — Static security analysis
**Deps:** 11
**Build:** run security rules over changed files in a temp folder with timeout, memory limit, and no network; parse results into the common finding format. Start with our own rules in `backend/rules/` for the top issues in the four languages (injection, unsafe deserialisation, weak crypto, path traversal, hardcoded credentials, unsafe eval). Add Bandit for Python. Resolve the rule-pack licence question from the architecture doc before adding any third-party pack.
**Files:** `backend/app/services/analyzers/semgrep_runner.py`, `backend/rules/**`
**Security points:** temp folder removed in `finally`; abuse case 9.
**Done when:** a set of known-vulnerable fixtures is detected; timeout test passes.

### 15 — Code quality analyzers
**Deps:** 11
**Build:** complexity and function-length checks and duplicate-block detection using the parser (tree-sitter), for the four languages.
**Files:** `backend/app/services/analyzers/complexity.py`, `duplication.py`
**Done when:** fixtures with known smells produce the expected findings; thresholds come from settings.

### 16 — LLM client and prompts
**Deps:** 03
**Build:** `LLMClient` interface plus a Gemini implementation using the official SDK. Review model and light model names from settings. Strict JSON schema output, retry with backoff, token counting, cost estimate in micro-dollars from configured prices. Versioned prompt files with the fixed rules from the security doc (code is data, no instructions from code).
**Files:** `backend/app/services/llm/base.py`, `gemini.py`, `schemas.py`, `backend/prompts/*.md`
**Security points:** production start check that the key is a paid-tier key (setting); no tool use enabled.
**Done when:** unit tests with a fake client; a recorded-response test confirms invalid JSON is retried then rejected cleanly.

### 17 — Context builder
**Deps:** 11, 16
**Build:** per file: diff, bounded surrounding window, imports, related test file names. Exclude files flagged "do not send". Enforce the token ceiling per request.
**Files:** `backend/app/services/review/context.py`
**Done when:** tests prove secret-bearing files are never included and size caps hold.

### 18 — AI review step and validation
**Deps:** 16, 17
**Build:** call the model per file group, parse findings, **validate each maps to a diff line**, validate suggested patches apply to the range, scan model output for secret-like strings, drop failures.
**Files:** `backend/app/services/review/reviewer.py`, `validate.py`
**Security points:** prompt-injection fixture (code comment that tries to redirect the bot) produces no behaviour change.
**Done when:** unit tests with fake model outputs cover every rejection path.

### 19 — Merge, rank, dedupe
**Deps:** 13, 14, 15, 18, 12
**Build:** combine findings, fingerprint, remove duplicates, apply rules file and minimum severity, apply "ignore this kind" feedback, sort by severity, compute risk level and counts.
**Files:** `backend/app/services/review/ranking.py`
**Done when:** deterministic ordering and risk levels verified by tests.

### 20 — Impact analysis and test suggestions
**Deps:** 11, 16
**Build:** the three signals from the architecture doc (test-name matching, importers among at most 15 candidate files, short AI impact note). Test suggestions from the AI step surfaced in the summary.
**Files:** `backend/app/services/review/impact.py`
**Done when:** fixture repository trees return the expected related files; call caps respected.

### 21 — Publish to GitHub
**Deps:** 19, 20, 06
**Build:** post one review with inline comments (with one-click suggestion blocks where valid), one summary comment (what the PR does, risk, counts, not-reviewed list), one check run (pass, fail, or neutral by rules). On a new push: update the summary, do not repeat existing comments, resolve comments whose finding is gone. Fence model text, never allow raw `@` mentions.
**Files:** `backend/app/services/github/publisher.py`
**Done when:** a full pipeline test against a mocked GitHub shows no duplicates after a second push and correct resolution.

### 22 — Pipeline wiring and quota check
**Deps:** 10, 21, plus ticket 27 for real limits (use a stub until then)
**Build:** `pipeline.py` that runs steps 3–13 from the architecture doc in order, with timing per step and cost recording. Friendly "limit reached" comment path.
**Files:** `backend/app/services/review/pipeline.py`
**Done when:** end-to-end test on fixture PRs finishes within the time budget and saves a complete review.

### 23 — Chat in PR and feedback handling
**Deps:** 21, 16
**Build:** handle comment replies and bot mentions, answer using the light model with the finding and nearby code as context, rate-limit 10 per hour per PR. Handle GitHub reaction or reply based feedback if available, plus the dashboard feedback endpoint.
**Files:** `backend/app/services/review/chat.py`, `backend/app/api/v1/feedback.py`
**Security points:** chat answers pass the same output scan; one request per answer, no memory across PRs.
**Done when:** tests cover rate limit, unrelated-comment ignore, and answer validation.

### 24 — Evaluation suite
**Deps:** 22
**Build:** a set of sample PRs (known-vulnerable and clean) with expected findings; a script that runs the pipeline and reports detection rate and false-positive rate. This produces the numbers behind the PRD success criteria.
**Files:** `backend/tests/fixtures/prs/**`, `backend/scripts/evaluate.py`
**Done when:** the script prints a report; CI runs a small version on every PR to catch regressions.

---

## Phase 3 — Dashboard API

### 25 — Dashboard endpoints
**Deps:** 09, 22
**Build:** repos list and enable/disable (Owner), review history, review detail, overview stats, repo quality trends, quality score calculation, usage endpoint. Pagination everywhere.
**Files:** `backend/app/api/v1/repos.py`, `reviews.py`, `dashboard.py`
**Done when:** contract tests pass and the tenant isolation suite (ticket 09) still passes.

### 26 — Notifications
**Deps:** 22
**Build:** email and Slack alerts for Critical findings, settings endpoint, encrypted Slack URL, retry with backoff, no code in messages.
**Files:** `backend/app/services/notify/**`, `backend/app/api/v1/settings.py`
**Done when:** tests with fake senders; Slack URL is encrypted in the database.

### 27 — Plans, usage and billing
**Deps:** 25
**Build:** usage counters, plan limits from the `plans` table, enforcement in the pipeline, `BillingProvider` interface, Razorpay implementation (create subscription, verify webhook signature, update status), `POST /webhooks/razorpay`, checkout and subscription endpoints. Read live Razorpay pricing before setting paid plan prices.
**Files:** `backend/app/services/billing/**`, `backend/app/api/v1/billing.py`
**Security points:** webhook signature verification; no card data in our system; idempotent event handling.
**Done when:** tests simulate subscribe, renew, fail, cancel; limits switch correctly.

---

## Phase 4 — Frontend

### 28 — Design system and app shell
**Deps:** 01
**Build:** tokens from `04-frontend.md`, light and dark themes, shadcn base components, `AppShell`, state components (loading, empty, error), typed API client with CSRF and error handling.
**Files:** `frontend/src/app/globals.css`, `components/ui/**`, `components/layout/**`, `lib/api.ts`
**Done when:** a storybook-style test page shows every component in every state; contrast checks pass.

### 29 — Login and landing pages
**Deps:** 08, 28
**Build:** landing, pricing, docs, login, privacy, terms pages; "Install on GitHub" button; session redirect handling.
**Done when:** end-to-end test: sign in, land on `/app`, sign out; Lighthouse and axe checks pass.

### 30 — Overview, repos and usage screens
**Deps:** 25, 28
**Build:** `/app`, `/app/repos`, `/app/usage` with charts, tables, empty and error states, polling for in-progress reviews.
**Done when:** Playwright tests cover enable repo and see a new review appear.

### 31 — Review detail and feedback
**Deps:** 25, 28, 23
**Build:** review detail page, finding cards, diff view, filters in the URL, feedback buttons with optimistic update.
**Done when:** Playwright tests cover filter, feedback, and open-in-GitHub link.

### 32 — Repository quality, billing and settings
**Deps:** 25, 26, 27, 28
**Build:** repo quality page, billing page (Owner only), settings page (notifications, members, delete account).
**Done when:** non-owners cannot see Owner pages; delete-account flow asks for confirmation.

---

## Phase 5 — Launch

### 33 — Account deletion and retention jobs
**Deps:** 25
**Build:** scheduled job that trims code excerpts after 90 days; account deletion that removes all rows within 30 days; audit log entries.
**Done when:** tests prove data is removed and counts match.

### 34 — Observability and cost guard
**Deps:** 22
**Build:** metrics per review step, error tracking hook, daily spend alarm, global kill switch setting that pauses new reviews.
**Done when:** a simulated spend spike triggers the alarm in a test.

### 35 — Repository polish for GitHub
**Deps:** all above
**Build:** root `README.md` (one-line promise, GIF, features, architecture diagram, tech stack, one-command quick start, link to docs), `SECURITY.md`, `CONTRIBUTING.md`, issue and PR templates, badges (CI, licence), profile pinning notes, tidy commit history. Keep the repository name `pr-review-ai` and the description "AI code review bot for GitHub pull requests."
**Done when:** a new person can run the stack from the README in under 10 minutes.

### 36 — Demo repository and launch checklist
**Deps:** 35
**Build:** a public demo repo with sample PRs that show findings of every severity; a short demo video; launch posts (Show HN, Reddit, X, Product Hunt) drafted.
**Done when:** opening a PR on the demo repo shows a review within about 90 seconds.
