# 04 — Frontend: PR Review AI

Reads: `01-prd.md`, `02-architecture.md`.

Goal of the look: **clean, calm, trustworthy.** It should feel like a serious developer tool, not a toy. A manager who opens the dashboard should understand the state of code quality in five seconds.

---

## 1. Principles

1. Show the answer first (score, counts), details second.
2. Severity colour is never the only signal. Always pair with a label or icon.
3. Plain language. "3 things to fix before merging", not "3 anomalies detected".
4. One primary action per screen.
5. Fast: server-render the first view, stream the rest.

---

## 2. Screens and routes (Next.js App Router)

| Route | Screen | Who | Notes |
|-------|--------|-----|-------|
| `/` | Landing page | Public | One-line promise, 30-second demo video or GIF, three feature blocks, "Install on GitHub" button, pricing teaser, link to the demo repo |
| `/pricing` | Pricing | Public | Free vs paid table, limits shown in plain numbers |
| `/docs` | Short docs | Public | Install, rules file reference, FAQ, "what we store" |
| `/login` | Sign in | Public | Single button: "Continue with GitHub". Consent text for privacy policy |
| `/app` | Overview (home) | Logged in | See below |
| `/app/repos` | Repositories list | Logged in | Enable or disable per repo (Owner only) |
| `/app/repos/[repoId]` | Repository quality | Logged in | Trends and top issues |
| `/app/repos/[repoId]/reviews` | Review history | Logged in | Table of PRs |
| `/app/reviews/[reviewId]` | Review detail | Logged in | Findings with code excerpts |
| `/app/usage` | Usage | Logged in | Reviews used this month vs limit |
| `/app/billing` | Billing | Owner | Plan, upgrade, invoices link |
| `/app/settings` | Settings | Owner | Notifications (email, Slack), members, delete account |
| `/privacy`, `/terms` | Legal | Public | Static |

### Screen detail

**Overview (`/app`)**
- Top row of 4 stat cards: Reviews this month, Critical and High findings found, Findings fixed (%), Average time to first review.
- Chart 1: findings per week by severity (stacked bars).
- Chart 2: top 5 issue categories.
- Table: 10 most recent reviews (PR title, repo, risk badge, findings count, time ago).
- Usage bar with an "Upgrade" link when over 80% used.

**Repository quality (`/app/repos/[repoId]`)**
- Quality score (0–100) with a one-line explanation of how it is calculated.
- Line chart: findings per PR over time.
- "Most affected files" list (top 10).
- "Most common issues" list.
- Settings summary read from the rules file, with link to docs.

**Review detail (`/app/reviews/[reviewId]`)**
- Header: PR title and link to GitHub, risk badge, counts by severity, duration, files reviewed and not reviewed.
- Filter bar: severity, category, source (static or AI), status.
- Findings list grouped by file. Each finding card shows: severity badge, title, line range, short explanation, code excerpt (max 10 lines), suggested fix with a diff view, status, helpful / not helpful buttons, "Open in GitHub" link.
- "Not reviewed" section with the reason per file.

---

## 3. Component inventory

**Layout:** `AppShell` (sidebar plus top bar), `PageHeader`, `Section`, `EmptyState`, `ErrorState`, `Skeleton`.

**Data display:** `StatCard`, `SeverityBadge`, `RiskBadge`, `CategoryChip`, `StatusPill`, `DataTable`, `Pagination`, `CodeExcerpt`, `DiffView`, `UsageMeter`, `QualityScore`.

**Charts:** `FindingsOverTimeChart`, `CategoryBarChart`, `TrendLine` (all built on Recharts).

**Inputs and actions:** `Button`, `IconButton`, `Switch`, `Select`, `SearchInput`, `FeedbackButtons`, `ConfirmDialog`, `Toast`.

**Auth and account:** `LoginButton`, `AccountSwitcher`, `UserMenu`.

Build the base set from shadcn/ui components copied into `src/components/ui/`. Our own components live in `src/components/` and use only the design tokens below.

---

## 4. Design tokens

Define once in `src/app/globals.css` as CSS variables and expose through Tailwind. Never write raw hex values in components.

**Colour (light theme / dark theme)**

| Token | Light | Dark | Use |
|-------|-------|------|-----|
| `--bg` | `#FFFFFF` | `#0B0D12` | Page background |
| `--surface` | `#F7F8FA` | `#12151C` | Cards |
| `--border` | `#E4E7EC` | `#232733` | Lines |
| `--text` | `#101828` | `#F2F4F7` | Main text |
| `--text-muted` | `#667085` | `#98A2B3` | Secondary text |
| `--brand` | `#4F46E5` | `#818CF8` | Primary buttons, links |
| `--critical` | `#B42318` | `#F97066` | Critical |
| `--high` | `#C4320A` | `#FB6514` | High |
| `--medium` | `#B54708` | `#FDB022` | Medium |
| `--low` | `#175CD3` | `#53B1FD` | Low |
| `--info` | `#475467` | `#98A2B3` | Info |
| `--success` | `#067647` | `#47CD89` | Passed, resolved |

Check every text and background pair for at least 4.5:1 contrast before release.

**Typography:** one sans-serif family for UI and one monospace for code (use the system font stacks or self-hosted open-source fonts; no runtime font requests to third parties). Sizes: 12, 14 (body), 16, 20, 24, 32. Line height 1.5 for body.

**Spacing:** 4-pixel base: 4, 8, 12, 16, 24, 32, 48.

**Radius:** 6 for inputs, 10 for cards. **Shadow:** one soft shadow for floating layers only; cards use a border instead.

**Motion:** 150 ms ease-out for hover and open/close. Respect `prefers-reduced-motion`.

---

## 5. States (every data screen implements all four)

| State | Behaviour |
|-------|-----------|
| **Loading** | Skeleton blocks shaped like the final content. No full-screen spinners. |
| **Empty** | Friendly explanation and one action. Example for no reviews: "No reviews yet. Open a pull request in an enabled repository and PR Review AI will review it within about a minute." |
| **Error** | Plain message, a "Try again" button, and a support link. Never show stack traces or raw error codes. |
| **Success** | Toast for actions (feedback saved, repo enabled). Optimistic update for feedback buttons with rollback on failure. |

Special states:
- **Over limit:** banner at the top of Overview and Usage: "You have used all reviews for this month. Upgrade to continue."
- **Review in progress:** review row shows "Reviewing…" with a progress hint, refreshes every 5 seconds until done.
- **Session expired:** redirect to `/login` with a "Your session ended" message and return to the previous page after login.
- **No access:** show the same "not found" screen as a missing page.

---

## 6. Data fetching and state

- Server components fetch the first page of data using the session cookie.
- TanStack Query handles client updates and polling.
- All API calls go through one typed client in `src/lib/api.ts` that adds the CSRF header, handles `401` (redirect to login) and `429` (show a calm message), and validates responses with Zod.
- No global state library. URL search params hold filters so views are shareable.

---

## 7. Responsive behaviour

| Width | Layout |
|-------|--------|
| 1024 and up | Sidebar fixed, content max width 1200 |
| 640 to 1023 | Sidebar collapses to icons, tables stay |
| Under 640 | Sidebar becomes a top menu; tables become stacked cards; charts full width, legend below |

Code excerpts scroll horizontally inside their own box. The page itself never scrolls sideways.

---

## 8. Accessibility floor

- Everything works with keyboard only. Visible focus ring on every interactive element.
- Semantic landmarks (`header`, `nav`, `main`). One `h1` per page.
- All icons that carry meaning have text labels or `aria-label`.
- Severity and status are never conveyed by colour alone.
- Charts have a text summary and a "view as table" toggle.
- Touch targets at least 40 by 40 pixels.
- Run an automated accessibility check (axe) in the end-to-end tests; the build fails on serious violations.

---

## 9. Frontend quality gates

- TypeScript strict mode on. No `any` without a comment.
- ESLint clean. Unit tests (Vitest) for formatters, API client, and components with logic. End-to-end tests (Playwright) for login, enabling a repo, viewing a review, and giving feedback, using a mock API.
- Lighthouse performance 90 or higher on landing and overview in CI (budget, not a blocker for V1 start).
