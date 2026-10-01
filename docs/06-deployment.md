# 06 — Deployment: PR Review AI

Reads: `02-architecture.md` (and the security doc for secrets and incident rules).

Hosting **prices are not listed here** because none were verified. Pick providers using the checklist in section 2 and read each provider's live pricing page first.

---

## 1. Environments

| Environment | Purpose | Data | Gemini key | GitHub App |
|-------------|---------|------|------------|------------|
| `local` | Development on your machine with Docker Compose | Fake data only | Free-tier key allowed (public or fake code only) | A separate "dev" GitHub App pointing at a tunnel URL |
| `staging` | Test releases before production | Fake and demo repos only | Paid key with a low spend cap | A separate "staging" GitHub App |
| `production` | Real customers | Real | **Paid key only** | The real GitHub App |

Rules:
- Each environment has its **own** GitHub App, secrets, database, and Redis. Never share.
- Production refuses to start if a required secret is missing or if the Gemini key is marked free-tier.
- A change goes local → staging → production. No direct production edits.

---

## 2. Hosting shape

You need places to run five things. The product does not depend on one vendor; everything runs from containers.

| Component | Needs | Provider checklist |
|-----------|-------|--------------------|
| Web (Next.js) | Node runtime or a platform that builds Next.js | Supports Next.js 16 and the Node version it requires (≥ 20.9.0); preview deployments |
| API (FastAPI) | Container, public HTTPS URL, health checks | Auto-restart, rolling deploys, secret store, region close to users (India preferred) |
| Worker (Celery) | Container with no public URL, can scale to several copies | Can scale independently from the API; graceful shutdown |
| PostgreSQL | Managed database | Automatic daily backups, point-in-time restore, encryption at rest, connection limits suited to the worker count |
| Redis | Managed Redis-compatible store | Persistence setting understood, TLS, enough memory for the queue |

Also needed: a domain with HTTPS, an email-sending service for alerts, and an error-tracking service.

Suggested domain layout: `app.<domain>` for the web app, `api.<domain>` for the API. Cookies are scoped so both can use them (see security doc).

---

## 3. Environment variables

Names are fixed here so code, Compose, and CI agree. Values are never committed.

**Core**
| Variable | Meaning |
|----------|---------|
| `APP_ENV` | `local`, `staging`, or `production` |
| `API_BASE_URL` | Public URL of the API |
| `WEB_BASE_URL` | Public URL of the web app (also used for CORS and redirects) |
| `LOG_LEVEL` | `INFO` by default |
| `SESSION_SIGNING_KEY` | Random 32+ bytes for session and state signing |
| `FIELD_ENCRYPTION_KEY` | Key for encrypting sensitive columns |
| `DATABASE_URL` | PostgreSQL connection string (TLS required outside local) |
| `REDIS_URL` | Redis connection string |

**GitHub**
| Variable | Meaning |
|----------|---------|
| `GITHUB_APP_ID` | Numeric app ID |
| `GITHUB_APP_SLUG` | App URL slug |
| `GITHUB_APP_PRIVATE_KEY` | PEM private key (store as a secret; multi-line safe) |
| `GITHUB_WEBHOOK_SECRET` | Webhook signing secret |
| `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` | For user login |

**AI**
| Variable | Meaning |
|----------|---------|
| `GEMINI_API_KEY` | Paid-tier key in staging and production |
| `GEMINI_KEY_TIER` | `free` or `paid`; production must be `paid` |
| `LLM_REVIEW_MODEL` | Currently `gemini-3.8-flash` |
| `LLM_LIGHT_MODEL` | Currently `gemini-3.5-flash-lite` |
| `LLM_PRICE_REVIEW_IN_PER_M` / `LLM_PRICE_REVIEW_OUT_PER_M` | Prices in micro-dollars per million tokens, for cost tracking. Update when Google changes pricing (a change is scheduled for 1 Jan 2027 per the pricing page) |
| `LLM_PRICE_LIGHT_IN_PER_M` / `LLM_PRICE_LIGHT_OUT_PER_M` | Same for the light model |
| `MAX_FILES_PER_REVIEW` / `MAX_LINES_PER_REVIEW` | Defaults 40 and 2000 |
| `MAX_TOKENS_PER_REVIEW` | Token ceiling per review |

**Billing and notifications**
| Variable | Meaning |
|----------|---------|
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | API credentials |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signing secret |
| `EMAIL_PROVIDER_API_KEY` / `EMAIL_FROM` | Alert email |

**Safety switches**
| Variable | Meaning |
|----------|---------|
| `REVIEWS_PAUSED` | `true` stops new reviews (kill switch) |
| `DAILY_SPEND_ALARM_USD` | Alarm threshold for AI spend |
| `ERROR_TRACKING_DSN` | Error tracker address |

**Web (public, safe to expose)**
| Variable | Meaning |
|----------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | API address for the browser |
| `NEXT_PUBLIC_GITHUB_APP_INSTALL_URL` | "Install on GitHub" link |

---

## 4. CI/CD (GitHub Actions)

**On every pull request:** secrets scan, backend lint, type check and tests, frontend lint, type check and unit tests, dependency audit (fail on High or Critical), evaluation smoke test (ticket 24), build both containers.

**On merge to `main`:** build and tag images with the commit hash, deploy to **staging** automatically, run Playwright end-to-end tests against staging.

**On a version tag (`v1.2.3`):** deploy to **production** after manual approval. Create release notes.

Branch protection on `main`: required checks, one review, no force pushes.

---

## 5. Deploy steps (production)

1. Confirm staging is green and the evaluation report did not regress.
2. Tag the release.
3. Approve the production deploy.
4. Pipeline order: **run database migration → deploy API → deploy worker → deploy web**.
5. Smoke test: `/healthz` and `/readyz` OK; open a PR on the demo repo; confirm a review appears within about 90 seconds and the check run shows.
6. Watch error rate and queue length for 30 minutes.

**GitHub App setup (one time per environment):** create the App with the permissions and events listed in the security doc, set the webhook URL to `<API_BASE_URL>/api/v1/webhooks/github`, generate the private key, enable user authorization during installation, set the callback URL.

**Razorpay setup (one time):** create plans, create the webhook to `<API_BASE_URL>/api/v1/webhooks/razorpay`, copy the webhook secret into the secret store.

---

## 6. Database migrations

- Alembic only. No manual schema edits.
- Migrations must be **backward compatible with the previous release** (add before remove): step 1 add the new column, deploy code that writes both, step 2 backfill, step 3 switch reads, step 4 drop the old column in a later release.
- The migration job runs once per deploy, before the new code starts.
- Every migration has a tested downgrade or a written reason why not.
- Take a database snapshot before any migration that changes or drops data.

---

## 7. Rollback

| Problem | Action |
|---------|--------|
| Bad web release | Redeploy the previous web build (instant on most platforms) |
| Bad API or worker release | Redeploy the previous image tag. Migrations are backward compatible, so the old code still runs |
| Bad migration | Restore from the pre-migration snapshot only if the downgrade is unsafe; announce downtime |
| Runaway spend or bad AI behaviour | Set `REVIEWS_PAUSED=true`, which stops new reviews immediately. Then fix and resume |
| Wrong comments posted on PRs | Pause reviews, ship a fix, and use the admin script to mark the affected review as superseded |

Keep the last 5 image tags available.

---

## 8. Monitoring and alerts

| Signal | Alert when |
|--------|-----------|
| API availability (`/healthz`) | Down for 2 minutes |
| API error rate (5xx) | Above 2% for 5 minutes |
| Webhook response time | 95th percentile above 3 seconds |
| Queue length | Above 100 for 10 minutes |
| Review failure rate | Above 5% in an hour |
| Review duration | 95th percentile above 3 minutes |
| GitHub rate-limit remaining | Below 10% |
| AI spend per day | Above `DAILY_SPEND_ALARM_USD` |
| "Not helpful" feedback rate | Above 25% over 7 days (quality alarm) |
| Database connections and storage | Above 80% |
| Certificate expiry | 14 days |

Dashboards: one for the API, one for the pipeline (duration per step, tokens, cost), one for business numbers (reviews, active accounts, upgrades).

Logs are searchable by `review_id` and `delivery_id`. Source code and tokens never appear in logs.

---

## 9. Backups and recovery

- Database: automatic daily backup plus point-in-time recovery where the provider offers it. Retain 14 days.
- Test a restore into a scratch database every quarter and record the result.
- Redis holds only queue and cache data. Losing it means in-flight reviews retry from GitHub's webhook redelivery or are re-triggered by the next push.
- Target: restore service within 4 hours; lose at most 24 hours of data (tighten later).

---

## 10. Secret rotation and incident steps

**Routine rotation (yearly, and whenever someone with access leaves):** GitHub App private key and webhook secret, OAuth secret, Gemini key, Razorpay keys, session signing key, field-encryption key (re-encrypt the affected columns).

**If a secret may have leaked:**
1. Set `REVIEWS_PAUSED=true` if the leaked item could affect customer code access.
2. Revoke and replace the secret in the provider's dashboard.
3. Update the secret store and redeploy.
4. Search logs for misuse from the exposure window.
5. If customer data could be affected, notify those accounts within 72 hours and publish a short write-up.
6. Add a test or check so the same mistake is caught next time.

---

## 11. Go-live checklist

- [ ] Production GitHub App created and reviewed for minimum permissions
- [ ] Paid Gemini key in place, `GEMINI_KEY_TIER=paid`, spend cap set
- [ ] Database backups on and a restore tested
- [ ] All alerts above configured and sent to a real channel
- [ ] Privacy policy, terms, and "what we store" pages live
- [ ] Tenant isolation tests green
- [ ] Evaluation report meets the PRD success criteria
- [ ] Kill switch tested in staging
- [ ] Razorpay in live mode with a real test payment and refund
- [ ] Demo repository public and working
- [ ] `SECURITY.md` has a working reporting address
