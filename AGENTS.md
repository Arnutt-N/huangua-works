# AGENTS.md

Single source of guidance for every coding agent working in this repository (Claude Code, Codex, Kilo, Zcode, Cursor, …). `CLAUDE.md` is a pointer to this file — add rules here, not there.

---

## Project

ระบบรับเรื่องร้องเรียน/ร้องทุกข์ อบต.หัวงัว (อ.ยางตลาด จ.กาฬสินธุ์) — Traffy-style citizen-help app for a Thai sub-district administrative organization.

Two intake channels feed one case pipeline: **web** (`/intake`, `/track`) and **LINE OA chatbot** (`/api/line/*`). Staff work cases in `/admin`. All UI copy, code comments, and domain vocabulary are Thai.

---

## New Task / New Phase Workflow (MANDATORY)

Before starting ANY new task or phase, follow this sequence strictly.

### 0. Branch First

```bash
git checkout -b <type>/<short-description>
# e.g. feat/master-data-crud, fix/auth-redirect, refactor/admin-layout
```

Never work directly on `main`. Every task/phase gets its own branch.

### 1. Skill Selection

Reference `.claude/skill-collections-20260712.md` and select the appropriate skill set for the task:

- **Baseline (always):** karpathy-guidelines
- **Process discipline:** superpowers (for serious eng work)
- **Thinking/planning:** mattpocock (grilling, codebase-design, domain-modeling)
- **Full SDLC playbook:** addyosmani OR ecc (pick one, never both)
- **Frontend design:** taste-skill (landing/portfolio/redesign only)
- **Agent workflow tuning:** maestro (AI/agent projects only)

State which skills apply before proceeding.

### 2. PRD (Product Requirements Document)

Create a concise PRD covering:

- Problem statement / user need
- Scope (in/out)
- Acceptance criteria (verifiable)
- Constraints & dependencies
- Success metrics

### 3. PRP-Plan (Implementation Plan)

Break the PRD into an ordered implementation plan:

- File-level changes (create/modify/delete)
- Dependency order (what blocks what)
- Test strategy per unit
- Risk areas & mitigations
- Estimated tranche grouping (if parallelizable)

### 4. Review Gate (PRD + PRP-Plan)

Before writing any implementation code:

- Review PRD against original request (completeness, no scope creep)
- Review PRP-Plan against codebase reality (correct paths, existing patterns, no conflicts)
- Flag assumptions and get user confirmation if ambiguous

### 5. Implement

- Follow the PRP-Plan tranche order
- TDD where applicable (red → green → refactor)
- Surgical changes only — no drive-by refactors
- Run lint + typecheck + tests after each logical unit

### 6. Review & Ship

```bash
# Self-review
- Run the gates in "Verification gates" below
- Review diff for unintended changes

# Commit (conventional commits)
git add <specific-files>
git commit -m "<type>(<scope>): <description>"

# Push + PR
git push -u origin <branch>
gh pr create --title "..." --body "..."

# Merge (after local gates green + approval)
gh pr merge --squash
```

### Summary Checklist

```
[ ] New branch created
[ ] Skills identified (ref: .claude/skill-collections-20260712.md)
[ ] PRD written & reviewed
[ ] PRP-Plan written & reviewed
[ ] Review gate passed (user confirmed if needed)
[ ] Implemented per plan
[ ] Tests pass, lint clean, typecheck clean
[ ] Committed with conventional message
[ ] PR created
[ ] Merged after local gates green + Vercel preview OK
```

---

## Commands

> **`pnpm` hangs in this environment.** The scoop shim resolves but never returns. Use `npx` — it runs the same local `node_modules/.bin` binaries.

| Task | Command |
|---|---|
| Dev server | `npx next dev` |
| Typecheck | `npx tsc --noEmit` |
| Lint | `npx eslint .` |
| Unit + contrast tests | `npx vitest run` |
| Unit only (skip integration) | `npx vitest run --exclude '**/*.integration.test.ts'` |
| Single test file | `npx vitest run src/lib/cases/state-machine.test.ts` |
| Single test by name | `npx vitest run -t "ชื่อ test"` |
| E2E (all) | `npx playwright test` |
| E2E (one spec) | `npx playwright test e2e/intake.spec.ts` |
| Storybook | `npx storybook dev -p 6006` |
| Contrast gate alone | `npx tsx scripts/check-contrast.ts` |
| Env gate | `npx tsx scripts/verify-env.ts` |
| Schema → migration | `npx drizzle-kit generate` |
| Push schema to DB | `npx drizzle-kit push` |
| Seed | `npx tsx scripts/seed.ts` (also `seed-geodata`, `seed-villages`, `seed-faq`) |
| DB browser | `npx drizzle-kit studio` |

`package.json` scripts exist for all of these under their `pnpm` names — the mapping is 1:1.

### Local stack

```bash
docker compose up -d postgres redis up-redis   # Postgres :5433, up-redis REST :8080
npx drizzle-kit push && npx tsx scripts/seed.ts
npx next dev                                    # host mode → http://localhost:3000
```

`up-redis` is a REST proxy that speaks the Upstash REST API in front of plain Redis — `@upstash/redis` only talks REST, so a bare Redis container will not work. Integration tests (`*.integration.test.ts`) and E2E both hit this live stack via `.env.local`.

### Verification gates

**GitHub Actions is intentionally paused to avoid billing** — a PR with no Actions run is expected, not a broken setup. Do not go hunting for CI runs. `.github/workflows/ci.yml` exists but does not fire.

The real gates are local plus Vercel:

```bash
npx tsc --noEmit     # typecheck
npx eslint .         # lint
npx vitest run       # integration tests need Docker Desktop started (Postgres :5433 + Redis)
```

Plus the Vercel / Vercel Preview Comments checks on the PR.

---

## Architecture

### Stack reality vs. the planning docs

`docs/` (PRD.md, PRP-Plan.md, tracking-issues.md) and `.env.example` still describe a **Supabase** architecture. The shipped code uses **no Supabase SDK at all** — it talks to plain PostgreSQL through Drizzle ORM + `postgres-js` over `DATABASE_URL`. Supabase is only a managed Postgres host in production; local dev is `postgres:17-alpine`.

Concretely, two things the planning docs promise that the code does **not** have:

- **No Postgres RLS.** The docs specify per-role RLS policies; zero policies exist in `drizzle/` or `schema.ts`. Authorization is entirely app-layer (`requireStaff` / `requireStaffApi`). Never assume a query is protected by the database.
- **No Supabase Auth.** Auth.js v5 with a Credentials provider and bcrypt replaced it.

Treat `docs/*.md` as historical intent, not as a description of the system.

### Single-source-of-truth derive pattern

Two pure modules (deliberately importing nothing, so they are safe in the client bundle *and* in `schema.ts`) define enums that everything else derives from:

- `src/lib/auth/roles.ts` — `ALL_ROLES` → `userRoleEnum` pgEnum, plus tier constants (`STAFF_ROLES`, `CASE_SUPERVISOR_ROLES`, `ADMIN_ROLES`, `SUPERADMIN_ONLY`)
- `src/lib/cases/state-machine.ts` — `ALL_STATUSES` → `caseStatusEnum` pgEnum, plus transitions, Thai labels, progress %

Add a role or status **here**, never directly in `schema.ts`.

### Auth — Auth.js v5, split across two configs

| File | Runtime | Contains |
|---|---|---|
| `src/auth.config.ts` | Edge-safe | No bcrypt, no postgres. `authorized` callback decides redirects. |
| `src/auth.ts` | Node | Credentials provider, bcrypt verify, DB lookup, `jwt`/`session` callbacks. |
| `src/proxy.ts` | Edge | Next.js 16 renamed `middleware.ts` → **`proxy.ts`**. Matcher: `/admin/:path*`. |

`proxy.ts` **must** use `NextAuth(authConfig).auth`, not the `auth` export from `src/auth.ts` — the latter pulls in Node-only bcrypt/postgres, fails to decode the session cookie in edge runtime, and produces a login redirect loop.

Session expiry is enforced by `token.expiresAt` inside the `jwt` callback (1 hour, or 30 days with "จดจำฉัน"), *not* by cookie `maxAge`. The cookie may outlive the session; the callback returns `null` to invalidate it.

`authorize()` deliberately does not check `role`/`isActive` — it runs `bcrypt.compare` against a `DUMMY_HASH` even for nonexistent emails so failure timing is constant, and defers those checks so error messages don't become an enumeration oracle.

### Authorization

`src/lib/auth/require-staff.ts` exposes two wrappers over one shared `resolveStaff()` decision:

- `requireStaff(allowedRoles?)` — server components / server actions. On failure: `signOut` + `redirect('/admin/login')`, or `redirect('/admin')` for insufficient role.
- `requireStaffApi(allowedRoles?)` — route handlers. Returns `{ ok: false, response }` with 401/403 JSON. **Never signs out** — a stray API call must not clear a browser session.

Both re-fetch the user row from the DB on every call: the JWT `role` is a login-time snapshot, so a demoted or deactivated user would otherwise keep their old privileges until the token expired. Every denial writes an audit row.

### Case lifecycle

`src/lib/cases/intake.ts` → `createCase()` is the **single intake path** for both web and LINE; it resolves/creates the submitter, records consent (web only), assigns a tracking code with collision retry, and writes the audit row.

```
pending → received → reviewing → assigned → in_progress → done → closed
                  ↘ rejected              (closed/rejected are terminal)
```

The pgEnum does not enforce transitions — call `assertTransition(from, to)` from `state-machine.ts` before **every** status change. It returns a Thai-language reason on rejection, suitable for showing to the user directly.

### PDPA / sensitive data handling

- **CID (เลขบัตรประชาชน) is never a plaintext identifier.** `generateCidHash()` (HMAC-SHA256, first 16 hex chars) builds placeholder emails like `cid-<hash>@placeholder.local`. Keyed HMAC, not a bare hash, so a leak isn't dictionary-attackable. Requires `CID_HMAC_KEY` ≥ 32 chars.
- **Dedup** — 7-day sliding window on `HMAC(cid|title|description)` via `src/lib/dedup.ts`.
- **Consent** — `consentRecords` table + `/api/consent/withdraw`.
- **Audit** — `logAudit()` in `src/lib/audit.ts`. `AUDIT_ACTIONS` is a closed const map; add new actions there so the union type stays accurate. `logAudit` accepts an optional `DbOrTx` so it can join a transaction.

### Rate limiting

`src/lib/upstash.ts` → `checkRateLimit(key, limit, windowSeconds, opts)`, a sliding window over Upstash REST.

`failOpen` defaults to **true** (Redis down ⇒ allow, keep the public service alive). Pass `{ failOpen: false }` on authentication paths — a Redis outage must not silently remove brute-force protection.

### LINE subsystem

The largest subsystem (`src/lib/line/`, `src/app/api/line/`, `src/app/admin/chat`, `src/app/admin/chatbot`):

- `api/line/webhook` — verifies the `LINE_CHANNEL_SECRET` signature, then dispatches to the bot engine
- `lib/line/bot/engine.ts` — intent matching → FAQ → case-flow → human handoff
- `lib/line/sse/broadcaster.ts` — live admin chat pushed over SSE, fanned out through Redis
- `lib/line/messages/` — Flex message and rich-menu builders

**Bot runtime config lives in the database, not env.** `lib/line/settings.ts` reads `chatSettings` with a 60-second in-process cache — call `invalidateSettingsCache(key)` after any write, or admin edits won't take effect for a minute.

### Cron

**Not Vercel Cron** (Hobby tier allows only one run per day). An external scheduler (cron-job.org) calls `/api/cron/*` with `Authorization: Bearer $CRON_SECRET`. Four jobs: `close-stale`, `cleanup-hashes`, `stats-refresh`, `ping`.

### Design tokens and the contrast gate

`src/styles/tokens.css` holds the oklch light/dark palette; `DESIGN.md` is the source spec (blue `oklch(51% 0.16 255)` + gold accent, Thai-first typography). Tailwind v4 — CSS-first config, **no `tailwind.config.ts`**.

WCAG contrast is a hard gate wired in three parts:

1. `src/lib/design/contrast-pairs.ts` — the list of foreground/background pairs to check
2. `scripts/check-contrast.ts` — computes ratios, exports `countFailures()`
3. `src/styles/tokens.contrast.test.ts` — wraps it in vitest **so it runs on any test invocation**

That third file exists specifically because a gate you have to remember to run is not a gate. When adding a color pair to `tokens.css`, add it to `contrast-pairs.ts` as well.

---

## Env contract

`scripts/verify-env.ts` runs as part of `build` and **fails the build** on any missing value, leftover `CHANGE_ME_`/`YOUR_` placeholder, or under-length secret:

`AUTH_SECRET` (≥32) · `AUTH_URL` (https + non-localhost in production) · `UPSTASH_REDIS_REST_URL` · `UPSTASH_REDIS_REST_TOKEN` (≥16) · `CID_HMAC_KEY` (≥32) · `CRON_SECRET` (≥16)

`DATABASE_URL` is enforced separately, at `getDb()` and in `drizzle.config.ts`.

**Read at runtime but neither verified nor listed in `.env.example`** — these fail silently when unset:

- `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN` — the whole LINE channel goes dark
- `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` — file upload fails (`isStorageConfigured()` guards some paths)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` — password-reset email is dropped without throwing, by design, to avoid an enumeration oracle. Set `MAIL_CONSOLE=true` in dev to log instead of send.

---

## Conventions

- **Comments and user-facing strings are Thai.** A `§` prefix marks a comment that explains a non-obvious decision or a bug that was fixed by the current shape of the code. Preserve them — they carry the "why", and several document redirect loops, timing oracles, and cache-invalidation traps that are easy to reintroduce.
- **`getDb()` is an async lazy singleton.** Always `await getDb()` inside the function that needs it; never at module scope (it would connect at build time). `closeDb()` is for scripts only.
- `firstOrUndefined()` from `src/lib/db/query-helpers.ts` replaces the `.limit(1)` + `[0]` idiom.
- Route handlers validate with `parseBody(schema, request)` from `src/lib/api-helpers.ts`, which returns a discriminated union — early-return `result.response` on failure. Zod schemas live in `src/lib/validation.ts`.
- Admin mutations are Next.js server actions under `src/app/admin/actions/` (`cases`, `users`, `master-data`, `profile`, `reset`), not API routes.
- IDs come from `generateId()` (`src/lib/id.ts`), not from the database.
- Fiscal year and Thai date formatting go through `src/lib/thai-date.ts` — Thai fiscal years start in October.
- E2E runs `fullyParallel: false, workers: 1` on purpose: specs share one real Postgres and Redis, so parallel runs collide on rate-limit and dedup state.

---

## Agent skills

### Issue tracker

GitHub Issues on `Arnutt-N/huangua-works` via the `gh` CLI. External PRs are **not**
a triage surface — `/triage` handles issues only. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical vocabulary, unchanged — `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — `CONTEXT.md` + `docs/adr/` at the repo root (neither exists yet;
that's expected). See `docs/agents/domain.md`.
