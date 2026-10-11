# PRP-Plan — system กลางก่อน (tranche A, rev 3)

- Source PRD: `docs/plans/enterprise-db-design-prd.md`
- Complexity: M (8 tasks, 2 new tables, 0 enum changes)
- Branch: `feat/enterprise-db-design`
- Status: rev 3 awaiting validation (DO NOT implement until READY)
- Rev history: rev 1 NOT READY 1/10 (8 critical); rev 2 fixed all 8 but dual re-review timed out twice, gate stays closed per poteto-mode Subagents rule

## Summary

เพิ่มตารางตั้งค่ากลาง 2 ตาราง (`system_settings`, `api_connections`) พร้อมโมดูลอ่านเขียน หน้าตั้งค่า health check ฐานข้อมูลแบบ public retention log ผ่าน cron และ MCP tool แบบอ่านกับ action แบบมีสิทธิ์ โดยพฤติกรรมเดิมต้องไม่เปลี่ยน

## Dependencies

- `drizzle-orm` + `postgres` (DB, existing), `zod` (schemas, existing), `next` (routes/actions, existing), Redis optional (version stamp, degrades to 60s TTL)
- Test pattern: mirror `src/app/admin/actions/users.integration.test.ts` (staff guard + 403 case + audit assert)

## Files to Change

- CREATE `src/lib/system/settings.ts` — MIRROR `src/lib/line/settings.ts:93-107` (get/set shape); version bump MIRROR `src/lib/line/config-version.ts:47` (`redis.incr`)
- EDIT `src/lib/db/schema.ts` — MIRROR `system_settings` from `chatSettings` (`src/lib/db/schema.ts:648-663`); MIRROR batch pattern from `importBatches` (`src/lib/db/schema.ts:392-411`); add `orgId` text NOT NULL default `'huangua'` to `users` (`:74`), `departments` (`:133`), `categories` (`:156`), `cases` (`:252`)
- CREATE `drizzle/0017_*.sql` via `npx drizzle-kit generate`; no enum change so normal transaction is fine
- EDIT `src/lib/audit.ts` — add `SYSTEM_SETTING_UPDATE`, `API_CONNECTION_UPDATE` beside existing entries (`src/lib/audit.ts:49-54`)
- CREATE `src/app/admin/actions/system.ts` — guard `requireStaff(ADMIN_ROLES)` per `src/app/admin/settings/page.tsx:11-12`; form validate via `validateFormData` per `src/lib/validation.ts:552`; toggle pattern per `src/app/admin/actions/master-data.ts:192-208`
- EDIT `src/app/admin/settings/settings-client.tsx` — current `SettingsClient` (`:12`) with `handleSave` (`:22`); add system section above bot section
- CREATE `src/app/api/health/db/route.ts` — public probe by design (monitoring needs no login); counts only, never rows/PII; DB down returns 503 same shape
- CREATE `src/app/api/cron/cleanup-audit-logs/route.ts` — Bearer `$CRON_SECRET` guard (cron pattern), deletes `audit_logs` older than `audit_retention_days`
- CREATE `src/lib/mcp/tools.ts` — read tools require `STAFF_ROLES` (`src/lib/auth/roles.ts:16`); write actions require `CASE_SUPERVISOR_ROLES` (`src/lib/auth/roles.ts:19`); admin tools require `ADMIN_ROLES` (`src/lib/auth/roles.ts:22`); status changes via `assertTransition` (`src/lib/cases/state-machine.ts:65`, call-site pattern `src/lib/cases/operations.ts:169`); every call writes audit row; default deny unknown tools
- CREATE tests: `src/lib/system/settings.test.ts`, `src/app/admin/actions/system.integration.test.ts`, `src/app/api/health/db/route.integration.test.ts`, `src/lib/mcp/tools.test.ts`, `src/app/api/cron/cleanup-audit-logs/route.integration.test.ts`

## NOT Building

- สวิตช์ฟิลด์รายกลุ่ม (next tranche)
- สิทธิ์กลุ่มย่อยใต้หน่วยงาน (next tranche)
- แยกฐานจริงหลาย DB (แค่คอลัมน์ `org_id` + index)
- เก็บ secret ดิบของ LINE/S3/SMTP ลง DB (เก็บแค่ปลายทางกับสถานะ)

## Key allowlist (closed, zod-enforced) with editor widgets

- `maintenance_mode`: boolean, default false — switch widget
- `audit_retention_days`: int 30-3650, default 365 — number input widget
- `import_default_org`: literal `'huangua'` — readonly text widget (fixed value)
- Unknown key read throws; unknown key write rejected 400

## apiConnections values (closed)

- provider: `'line' | 's3' | 'smtp'`
- status: `'unknown' | 'connected' | 'degraded' | 'down'`, default `'unknown'`
- Columns: id, provider, endpoint (no secret), status, lastCheckedAt, metadata jsonb
- Refresh action re-probes endpoint (timeout 5s) and writes status + lastCheckedAt + audit; never stores secret

## Step-by-Step Tasks

### T1 — settings module
- ACTION: create `src/lib/system/settings.ts` with `getSystemSetting(key)` + `setSystemSettings(patch, actor)` for allowlist keys only; in-process cache 60s; `redis.incr` version bump on write (degrades to TTL when Redis down)
- UX: N/A — no UI surface
- IMPLEMENT: `src/lib/line/settings.ts:93-107`; `src/lib/line/config-version.ts:47`
- IMPORTS: `@/lib/db` (`getDb`), `@/lib/audit` (`logAudit`), `zod`
- VALIDATE: `npx tsc --noEmit` exit 0; `npx vitest run src/lib/system/settings.test.ts`

### T2 — schema + migration
- ACTION: add `systemSettings` (id, key unique with uniqueIndex, value jsonb, description, updatedAt) + `apiConnections` (id, provider unique with uniqueIndex, endpoint, status, lastCheckedAt, metadata jsonb) + `orgId` on 4 tables each with `orgIdx` (`cases_org_id_idx`, `users_org_id_idx`, `departments_org_id_idx`, `categories_org_id_idx`); `npx drizzle-kit generate`; assert SQL has no `ADD VALUE`
- UX: N/A — no UI surface
- IMPORTS: `drizzle-orm/pg-core` (`pgTable, text, timestamp, boolean, jsonb, uniqueIndex`) per `src/lib/db/schema.ts:1-11`; `ALL_ROLES` not touched
- IMPLEMENT: `src/lib/db/schema.ts:648-663`, `src/lib/db/schema.ts:392-411`
- GOTCHA: enum changes must run outside transaction (lesson from 0014 via `scripts/apply-enum-awaiting-budget.ts`) — N/A here by assertion above
- VALIDATE: `npx drizzle-kit push` on local DB succeeds; row counts of 4 altered tables equal before/after; 4 `orgIdx` indexes present in `pg_indexes`; `npx tsc --noEmit` exit 0

### T3 — audit actions
- ACTION: add `SYSTEM_SETTING_UPDATE`, `API_CONNECTION_UPDATE` to `AUDIT_ACTIONS`
- UX: N/A — no UI surface
- IMPORTS: N/A — const-map entry only, no imports
- IMPLEMENT: `src/lib/audit.ts:49-54`
- VALIDATE: `npx tsc --noEmit` exit 0

### T4 — admin action + UI (before/after documented)
- BEFORE: settings page shows bot section only (welcome, handoff keywords, business hours)
- AFTER: system section on top (3 allowlist keys with editors + save state), apiConnections table below with status column + refresh button, then unchanged bot section
- ACTION: `setSystemSettings` + `refreshApiConnection` server actions (ADMIN_ROLES, zod via `validateFormData`, write + audit in one tx, `revalidatePath('/admin/settings')`)
- IMPORTS: `next/cache` (`revalidatePath`), `@/lib/auth/require-staff` (`requireStaff`), `@/lib/validation` (`validateFormData`), `@/lib/audit` (`logAudit`), `@/lib/system/settings`
- IMPLEMENT: guard `src/app/admin/settings/page.tsx:11-12`; validate `src/lib/validation.ts:552`; toggle `src/app/admin/actions/master-data.ts:192-208`
- VALIDATE: `npx eslint src/app/admin/actions/system.ts src/app/admin/settings/settings-client.tsx` exit 0; integration test below

### T5 — db health route (public by design)
- ACTION: `GET /api/health/db` returns `{ ok, latencyMs, tables: { cases, users } }`; DB down returns 503 same shape; no auth, no PII keys ever
- UX: N/A — API only, response shape in ACTION above
- IMPLEMENT: `await getDb()` inside handler (never module scope); count queries only
- IMPORTS: `next/server` (`NextResponse`), `@/lib/db` (`getDb`)
- VALIDATE: `curl` 200 locally with `tables` present and `email/fullName/trackingCode` absent

### T6 — MCP tools
- ACTION: `listTools()` + `callTool(name, args, actor)`; read tools (`get_case`, `search_cases`) need `STAFF_ROLES`; write actions (`update_case_status`, `add_case_comment`) need `CASE_SUPERVISOR_ROLES`; admin tool (`get_system_setting`) needs `ADMIN_ROLES`; default deny; every call audits
- IMPLEMENT: tiers `src/lib/auth/roles.ts:16,19,22` (read STAFF, write CASE_SUPERVISOR, admin tool ADMIN); transition `src/lib/cases/state-machine.ts:65` called as in `src/lib/cases/operations.ts:169`; actor row re-fetched from DB (never trust JWT role alone, same as `requireStaff`)
- UX: N/A — no UI surface, registry module only
- TRANSPORT: internal registry module (no MCP SDK in package.json); HTTP/SSE exposure is next tranche, NOT this plan
- ARG SHAPES: `get_case({ trackingCode })` returns public-safe JSON `{ id, status, updatedAt }` only (no title/description/location/contact — PII discipline matches T5 deny-list); `search_cases({ query, status?, limit? })` returns id/status/updatedAt rows max 20; `update_case_status({ caseId, to, comment? })`; `add_case_comment({ caseId, comment })`; `get_system_setting({ key })` returns typed value for allowlist keys only
- IMPORTS: `@/lib/auth/roles` (tiers), `@/lib/cases/state-machine` (`assertTransition`), `@/lib/cases/operations` (`applyCaseUpdate` for writes, same as cron at `src/app/api/cron/close-stale/route.ts:14`), `@/lib/audit` (`logAudit`)
- VALIDATE: unit tests below

### T7 — audit retention cron
- ACTION: `GET /api/cron/cleanup-audit-logs` with `Authorization: Bearer $CRON_SECRET`; deletes rows older than `audit_retention_days`; returns `{ deleted }` count only
- UX: N/A — API only, response shape in ACTION above
- IMPLEMENT: guard via `requireCron(req)` from `@/lib/cron-auth`, MIRROR `src/app/api/cron/close-stale/route.ts:14-17` (same `if (!auth.ok) return auth.response` shape); delete threshold from `getSystemSetting('audit_retention_days')`
- IMPORTS: `@/lib/cron-auth` (`requireCron`), `@/lib/db` (`getDb`), `@/lib/db/schema` (`auditLogs`), `@/lib/system/settings`
- VALIDATE: integration test seeds 1 old + 1 fresh row, expects deleted 1

### T8 — regression
- ACTION: run full gates on local stack
- IMPLEMENT: N/A — gate-run only, no code
- IMPORTS: N/A — no code
- VALIDATE: `npx tsc --noEmit` exit 0; `npx eslint .` 0 errors; `npx next build` succeeds (runs verify-env gate); `npx vitest run` all pass; import dry-run still `{"records":270,"importable":270,"blocked":0}` with the 5 known resolves (4 `--resolve-status` awaiting_budget for rows 150/161/242/245 + 1 `--resolve-date` 2026-10-05 for row 275)

## Validation Commands (all exist in package.json:12-29)

- `npx tsc --noEmit`
- `npx eslint <changed-files>` then `npx eslint .`
- `npx vitest run <new-test-files>`
- `npx vitest run` (full, needs Docker postgres :5433 + up-redis)
- `npx drizzle-kit generate` / `npx drizzle-kit push`
- `npx next build` (runs `verify-env.ts` gate; needs `.env.local`)

## Testing Strategy

- `settings.test.ts`: set `maintenance_mode=true` then get returns true; unknown key throws; stale cache within TTL then fresh after expiry
- `system.integration.test.ts` (mirror `users.integration.test.ts`): head update succeeds + 1 audit row; officer update 403 + 0 audit rows; invalid value 400
- `route.integration.test.ts`: 200 body has `ok/latencyMs/tables`, lacks `email/fullName/trackingCode`; case counts match
- `tools.test.ts`: unknown tool throws `unknown_tool`; officer write denied 403 + audit; chief valid transition ok + audit; officer `get_system_setting` denied 403; superadmin `get_system_setting` ok + audit; invalid transition denied with Thai reason from `assertTransition`
- `cleanup-audit-logs` test: 1 old + 1 fresh row in, `{ deleted: 1 }` out; wrong secret 401
- Edge cases: empty patch rejected 400; concurrent sets both audited; `org_id` backfill leaves 0 non-default rows; refresh timeout writes `degraded`

## Acceptance Criteria

- Migration applies on local DB, row counts equal before/after on 4 altered tables
- Settings round-trip with audit row per change; officer blocked 403
- Health 200/503 shapes correct, zero PII keys, no login required
- MCP deny-by-default verified; retention deletes only old rows
- Full gates green + import dry-run unchanged

## Risks

- Migration locks at multi-org scale: MITIGATION default in same statement, no sweep; GOTCHA measure lock time on seed data first
- Stale cache after edit: MITIGATION version INCR on write, 60s TTL fallback
- Privilege escalation via MCP: MITIGATION DB re-fetch of actor row + tier check + audit; GOTCHA never trust JWT role
- Scope creep: MITIGATION NOT Building enforced at review
