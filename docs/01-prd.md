# 01 — Product Requirements: PR Review AI

## One-liner
PR Review AI is an AI code review bot for GitHub. It reads every Pull Request, finds bugs and security problems, and leaves clear comments with ready-to-apply fixes before the code is merged.

## Problem
- Human code review is slow. PRs wait for days, and reviewers get tired and miss things.
- Small teams and solo developers often have no reviewer at all.
- Security bugs and missing tests slip into production because nobody checks for them consistently.
- Existing review tools are either too noisy (many useless comments) or too expensive for small teams.

## Target user
**Primary:** developers and small teams (2–30 people) who use GitHub and want a fast, consistent first review on every PR.
**Secondary:** engineering managers and CTOs who want to see code quality trends across repositories.
**Also:** open-source maintainers who receive many PRs from strangers.

**Not for (V1):** teams on GitLab or Bitbucket, teams that need the bot to run fully offline, and teams that want the bot to merge code on its own.

## Core features (V1)

### A. Review engine
1. **Automatic review.** When a PR is opened or updated, the bot reviews only the changed code (plus the context it needs) and posts its findings.
2. **Bug detection.** Finds likely bugs, missed edge cases, and logic errors.
3. **Security scanning.** Flags common vulnerabilities (injection, unsafe handling of user input, weak cryptography, unsafe file or network use) and **exposed secrets** such as API keys and passwords.
4. **Code quality analysis.** Finds code smells, duplicated code, overly complex functions, and bad practices.
5. **Severity levels.** Every finding is marked Critical, High, Medium, Low, or Info, with a short reason.
6. **Inline comments.** Each finding appears on the exact line of the PR it relates to.
7. **One-click fix suggestions.** Where possible, the fix is shown in GitHub's "suggested change" format so the author can apply it with one click. Every fix has a plain explanation of why.
8. **Test suggestions.** The bot points out missing tests and edge cases, and offers example test cases.
9. **Impact analysis.** The bot lists other files and features that may be affected by the change.
10. **Multi-language.** Python, JavaScript, TypeScript, and Java in V1.

### B. PR-level experience
11. **PR summary.** One short comment at the top of the PR explaining what the PR does in plain language, plus a **risk score** (Low / Medium / High) and a count of findings by severity.
12. **Merge check.** The bot reports a pass/fail status on the PR. The team can choose to block merging when Critical findings exist.
13. **Chat in the PR.** Anyone can reply to a bot comment or mention the bot to ask "why is this a problem?" or "show me a safer version", and get an answer in context.
14. **Feedback buttons.** Users can mark a finding as helpful, not helpful, or "ignore this kind of finding in this repo". The bot uses this to become less noisy over time.
15. **No duplicates.** When a PR is updated, the bot does not repeat comments it already made, and it marks old comments as resolved when the issue is fixed.

### C. Team controls
16. **Repository rules file.** A simple settings file in the repository lets the team choose: which folders to skip, which severity levels to report, custom team rules written in plain English, and whether to block merging.
17. **Quick install.** A user signs in with GitHub, picks repositories, and the bot starts working. No manual setup beyond that.

### D. Dashboard
18. **Review history.** A list of all PRs reviewed, with findings and their status.
19. **Repository quality view.** Trends over time: findings per PR, most common issue types, most affected files, and a simple quality score per repository.
20. **Team view.** Which kinds of mistakes happen most, and how fast findings get fixed.
21. **Notifications.** Optional email or Slack message when a Critical finding is found.

### E. Plans and limits
22. **Free tier.** Free for public repositories and a small number of private-repository reviews per month.
23. **Paid plans (later in V1 roadmap).** Higher monthly review limits, more private repositories, team features. Billing is built so it can be switched on after launch.
24. **Usage meter.** Users can see how many reviews they have used this month.

## Explicit non-goals (V1)
- The bot never merges or pushes code by itself. It only comments and suggests.
- No support for GitLab or Bitbucket.
- No IDE plugin.
- No full-repository security audit outside PRs (PR-only focus in V1).
- No languages beyond the four listed.
- No self-hosted or offline version in V1.

## Main user flows
1. **Install:** User signs in with GitHub → chooses repositories → sees a confirmation → bot is active.
2. **Review:** Developer opens a PR → within about a minute the bot posts a summary, inline comments, and a status check → developer applies fixes or replies → bot updates its review on the next push.
3. **Ask:** Developer replies to a comment asking for explanation → bot answers in the same thread.
4. **Tune:** Team adds a rules file → future reviews follow the team's rules.
5. **Track:** Manager opens the dashboard → sees quality trends and the most common problems → decides where to improve.
6. **Upgrade:** User hits the free limit → sees a clear message and an upgrade option; the bot does not silently stop.

## Success criteria
- First review appears within 90 seconds for a typical PR (under 500 changed lines).
- At least 60% of findings are marked helpful by users (measured through feedback buttons).
- Fewer than 1 in 5 comments are marked "not helpful".
- A new user goes from sign-in to first review in under 5 minutes.
- The bot catches all items in a prepared set of known-vulnerable test PRs.
- Zero cases of the bot posting a user's secrets or private code outside their own repository.

## Decisions (the earlier open questions, now settled)
These are defaults chosen so the rest of the specs are consistent. Change them here first if you disagree; the other docs follow this file.

1. **Free tier limits:** public repositories get 100 reviews per month per account. Private repositories get 20 reviews per month per account. Limits live in the plan settings, not in code, so they can change without a release.
2. **Block merge on Critical:** OFF by default. Teams turn it on in the rules file.
3. **Dashboard visibility:** private by default. A public showcase page for open-source repositories is a later version, not V1.
4. **Large PRs:** the bot reviews the riskiest files first, up to 40 files or 2,000 changed lines per review. Anything beyond that is listed in the summary as "not reviewed" with the reason.
5. **Live demo repository:** yes. A public demo repository is part of the launch (see tickets).

## Still open (does not block building)
1. Final paid plan prices and limits (decide after real usage data from the free tier).
2. Whether rule packs from third-party security scanners may be used in a commercial paid product (see the licence note in the architecture document).
