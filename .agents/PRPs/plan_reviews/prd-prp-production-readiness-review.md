# Adversarial Plan Review Synthesis: Step 6 Production Readiness (Ops & External Config)

**Date:** 2026-11-02  
**Target:** `prd-prp-production-readiness.md`  
**Reviewers:** Adversarial Reviewer A (Systems & Ops Security) & Adversarial Reviewer B (Architecture & Contracts)  
**Status:** Unified Synthesis & Resolutions Applied in Rev. 2.0.0  

---

## 1. Key Adversarial Findings & Resolutions

### Finding 1: Critical Risk of Mutating Live Data by Probing Cron Endpoints
- **Concern:** If `verify-production.ts` executes all 7 cron endpoints with Bearer token, it will trigger live mutations on production (`close-stale` marks cases closed, `cleanup-hashes` deletes records, `cleanup-audit-logs` purges logs, `broadcast-send` sends real LINE messages, and `rich-menu-display` toggles active menus).
- **Resolution in Rev. 2.0.0:**
  - Probe `/api/cron/ping` with Bearer `<CRON_SECRET>` (safe read-only health check returning 200 OK).
  - Probe the other 6 cron endpoints unauthenticated or with dummy credentials, expecting **HTTP 401 Unauthorized**. This verifies that the routes are deployed, alive, and properly guarded without mutating any state.

### Finding 2: `DATABASE_URL` and Optional Service Checks in `verify-env.ts` Risk Breaking Vercel Builds
- **Concern:** `verify-env.ts` runs inside `npm run build` (`next build && tsx scripts/verify-env.ts`). On Vercel, `NODE_ENV=production` is always active. Next.js build does not need a live database (`getDb()` is lazy). If `DATABASE_URL` or optional services (`SMTP_HOST`, `S3_*`, `NEXT_PUBLIC_LIFF_ID`) fail hard with `exit(1)`, builds will fail on environments without database access or optional configs.
- **Resolution in Rev. 2.0.0:**
  - Keep `DATABASE_URL` enforced at runtime (`getDb()`) and inside `verify-production.ts`. Do not fail build on it.
  - In `verify-env.ts`, missing `SMTP_HOST` emits a `console.warn` instead of a fatal `exit(1)`.
  - Check full live configuration and report warnings comprehensively in `verify-production.ts`.

### Finding 3: `LINE_ID_HMAC_KEY` Missing from `DEPLOY.md` Runbook
- **Concern:** `verify-env.ts` requires `LINE_ID_HMAC_KEY` (≥ 32 chars), but `DEPLOY.md` only instructed users to generate 3 secrets (`AUTH_SECRET`, `CID_HMAC_KEY`, `CRON_SECRET`), leaving new users blocked on Vercel deployment.
- **Resolution in Rev. 2.0.0:**
  - Updated `DEPLOY.md` to document all 4 required secrets, specifically detailing `LINE_ID_HMAC_KEY` (≥ 32 chars, never reused with `CID_HMAC_KEY`).
  - Added clear instructions regarding Supabase Connection Pooler port 6543 (Transaction Mode for Vercel) versus port 5432 (Session Mode for CLI migrations).

### Finding 4: All 7 Cron Jobs Fully Specified with HTTP GET Method
- **Concern:** Planning omitted HTTP method and schedules. All Next.js cron routes in this codebase only accept `GET` and require `Authorization: Bearer <CRON_SECRET>`.
- **Resolution in Rev. 2.0.0:**
  - Explicit table in `DEPLOY.md` and `.env.example` with exact cron schedules, URL paths, HTTP method `GET`, and idempotency rules for all 7 jobs:
    1. `close-stale` (`0 8 * * *`)
    2. `cleanup-hashes` (`30 8 * * *`)
    3. `cleanup-audit-logs` (`0 2 * * *`)
    4. `stats-refresh` (`0 9 * * *`)
    5. `broadcast-send` (`*/30 * * * *`)
    6. `rich-menu-display` (`0 * * * *`)
    7. `ping` (`*/15 * * * *`)

### Finding 5: Connection Pool Leakage and Node Hanging Prevention
- **Concern:** Calling `getDb()` creates an active connection pool. Without explicit cleanup, CLI scripts will hang indefinitely in terminal/CI.
- **Resolution in Rev. 2.0.0:**
  - All new scripts (`verify-production.ts`, `verify-seed-data.ts`) enforce `try { ... } finally { await closeDb(); }`.

### Finding 6: Testability via Pure Function Refactoring
- **Concern:** Top-level execution with `process.exit(1)` in `verify-env.ts` made unit testing impossible without killing Vitest test runners.
- **Resolution in Rev. 2.0.0:**
  - Refactored `verify-env.ts` into a pure exportable `validateEnv(env, isProd)` function and a guarded CLI runner.
  - Added dedicated unit test suite `scripts/verify-env.test.ts`.

### Finding 7: Zero Emoji & Non-Breaking Compliance
- **Concern:** Zero emoji rule must be preserved in all modified and new files.
- **Resolution in Rev. 2.0.0:**
  - All output tags use standard ASCII `[PASS]`, `[FAIL]`, `[WARN]`, `[INFO]`. All documentation edits scrub emojis in favor of text tags.
