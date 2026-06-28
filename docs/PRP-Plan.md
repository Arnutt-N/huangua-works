# PRP-Plan — อบต.หัวงัว Citizen-Help Web App

> **เอกสารวางแผน (planning artifact)** — ไม่ใช่ code/scaffold
> Source-of-truth: `D:\toppublic\per\docs\context-package.md` + `D:\toppublic\per\docs\PRD.md`
> Stack อนุมัติ: Vercel + Supabase Cloud + Upstash Redis (REST) + QStash + Next.js App Router + TypeScript + Tailwind (custom tokens) + Radix UI (ร่างเอง ไม่ใช่ shadcn)
> **HARD-GATE:** ห้ามเขียนโค้ด/scaffold/สร้าง `package.json` จนกว่า design ได้รับอนุมัติ — ผลลัพธ์เป็น markdown เท่านั้น
> **รอบการแก้:** รอบนี้ incorporate ทุก CRITICAL (C1–C6) + HIGH (H1–H15) จาก `reviews.md` ก่อน P0.1 merge + เพิ่ม R-PL-2 CRITICAL gate (policy test per role ใน staging)

---

## 0. Critical Fixes Incorporated (จาก reviews C1-C6, H1-H15)

> สรุปการแก้ทุก finding อย่าง concrete พร้อม migration file เป้าหมาย — แก้ก่อน scaffold/P0.1 merge
> รายละเอียดเชิง SQL/policy อยู่ใน §3.2 (schema), §3.3 (RLS/policy), §3.4 (security), §3.5 (a11y) — ส่วนนี้เป็น index/แผนที่

### 0.1 CRITICAL (6 ข้อ — บล็อก P0.1 merge)

| ID | Finding | แหล่ง | แผนการแก้ concrete | Migration/ไฟล์เป้าหมาย |
|---|---|---|---|---|
| **C1** | `audit_log` ไม่มี UPDATE/DELETE policy กัน service_role/owner bypass | Security CRITICAL + Database HIGH (escalate) | (1) `REVOKE UPDATE, DELETE ON audit_log FROM authenticated, anon, service_role` เก็บเฉพาะ `INSERT, SELECT`; (2) trigger `BEFORE UPDATE OR DELETE ON audit_log RAISE EXCEPTION` ดับเบิ้ลเลยกัน service_role/owner bypass; (3) range-partition `audit_log` รายเดือน/ปี ตาม retention 10 ปี (PRD 6.5) เพื่อ prune ได้; (4) migration role แยกจาก service_role เฉพาะสำหรับ schema migration | `supabase/migrations/0003_audit_append_only.sql` |
| **C2** | CID hash ใช้ plain SHA-256 → rainbow table + cross-DB correlation ละเมิด PDPA data minimization | Security CRITICAL | (1) ใช้ keyed HMAC: `pgcrypto hmac(cid, pgp_sym_decrypt(secret_key), 'sha256')` เก็บในคอลัมน์ `cid_hmac`; (2) `CID_HMAC_KEY` env Sensitive ≥ 32 char แยกจาก `SUPABASE_SERVICE_ROLE_KEY`; (3) ห้าม deterministic hash ลำดับ; (4) `scripts/verify-env.ts` validate `CID_HMAC_KEY` ≥ 32 char + ไม่ empty | `supabase/migrations/0004_cid_pgcrypto.sql` + `scripts/verify-env.ts` + `.env.example` |
| **C3** | `sysadmin` bypass RLS + service_role ใช้ใน Edge Fn/cron โดยไม่มี allow-list | Security CRITICAL | (1) service-role route registry: allow-list `/api/cron/*` เท่านั้น (config ใน `lib/supabase/admin.ts`); (2) lint rule (ESLint custom) บล็อก `import SUPABASE_SERVICE_ROLE_KEY` ใน `(public)` route group + บล็อก `lib/supabase/admin.ts` import ใน `(public)`; (3) บังคับทุก service-role call เขียน audit row (trigger + app-layer); (4) ห้ามใช้ Edge Runtime กับ route ที่ใช้ service_role | `lib/supabase/admin.ts` (registry) + `.eslintrc.cjs` + `0004_rls_policies.sql` |
| **C4** | `complainant` polymorphic ไม่มี CHECK constraint บังคับ mutual exclusion | Database CRITICAL | (1) ใน `0001_init_schema.sql` เพิ่ม `CHECK ((party_type='citizen' AND person_id IS NOT NULL AND agency_id IS NULL) OR (party_type='agency' AND agency_id IS NOT NULL AND person_id IS NULL))`; (2) เพิ่ม partial index `complainant(person_id) WHERE party_type='citizen'` | `supabase/migrations/0001_init_schema.sql` |
| **C5** | `audit_log.before/after` jsonb จับ `person.cid` plaintext → ทำลาย encrypted-at-rest + PDPA R3 | Database CRITICAL + Security MEDIUM (escalate) | (1) trigger function strip คอลัมน์ `cid`/PII ออกจาก jsonb payload ก่อน INSERT `audit_log`; (2) field-level masking ก่อน log: CID → masked `x-xxxx-xxxxxx-x`, phone → last 4, address → village-level; (3) column-level RLS บน `before/after`; (4) integration test: insert complaint แล้วตรวจ `audit_log.after` ต้องไม่มี CID plaintext; (5) allow-list field ที่ log ได้ (actor/action/entity/timestamp/metadata non-PII) | `supabase/migrations/0003_audit_append_only.sql` + integration test |
| **C6** | Touch target ≥44px ไม่ประกาศเป็น design token ที่ enforce | a11y CRITICAL | (1) เพิ่ม token `--touch-target-min: 44px` + `--touch-target-gap: 8px` ใน `styles/tokens.css`; (2) ESLint rule block `<button>`/`<a>` ที่ `min-width/min-height < 44px`; (3) Storybook axe gate ทุก Radix primitive story ต้องผ่าน + rule นี้; (4) Go/No-Go gate M0: ห้ามข้าม | `src/styles/tokens.css` + `.eslintrc.cjs` + Storybook a11y addon |

### 0.2 HIGH (15 ข้อ — แก้ก่อน P0 freeze / ก่อนอนุมัติ design)

| ID | Finding | แหล่ง | แผนการแก้ concrete | Migration/ไฟล์เป้าหมาย |
|---|---|---|---|---|
| **H1** | Consent flow มี record แต่ไม่มี withdrawal mechanism (PDPA ม.19) | Security HIGH | เพิ่ม `consent` table (version, scope, granted_at, withdrawn_at) + endpoint `/api/consent/withdraw` trigger pseudonymize pipeline + บันทึก `audit_log.action='consent_withdrawn'` + แจ้ง citizen ทางช่องทางที่ยินยาม | `0001_init_schema.sql` (consent table) + P1 endpoint |
| **H2** | Realtime `case_events` channel default broadcast ไม่ผ่าน RLS | Security HIGH | เปิด Realtime Authorization ผูกกับ RLS policy ของ `complaint` + ใช้ `postgres_changes` filter `org_id`/`created_by` แทน `broadcast` + payload ฝั่ง server sanitize ก่อน push (ห้ามส่ง CID/name ใน event) | Supabase Realtime config + `0004_rls_policies.sql` |
| **H3** | Citizen identity ใน P1 ไม่ชัดเจน (RLS พังถ้า citizen ไม่มี auth) | Security HIGH | กำหนด citizen auth ใน P1: email magic link / phone OTP ผ่าน Supabase Auth หรือ signed tracking token ผูกกับ `book_no` — ห้าม anonymous intake | P1 design doc + Supabase Auth config |
| **H4** | CSV export มี watermark + audit แต่ไม่มี DPIA / การคุ้มกันไฟล์ | Security HIGH | (a) export route ใช้ one-time signed URL หมดอายุ 5 นาที จาก Vercel Blob/Supabase Storage private; (b) บังคับ MFA ก่อนโหลด; (c) ไฟล์เข้ารหัส AES-256 at rest; (d) บันทึก DPIA `docs/dpia-export.md` | P1 export route + `docs/dpia-export.md` |
| **H5** | Bitemporal `agency`/`person_tenure` ไม่มี EXCLUDE constraint กันช่วงเวลาทับซ้อน | Database HIGH | `EXCLUDE USING gist (person_id WITH =, tstzrange(valid_from, valid_to, '[]') WITH &&)` + `CHECK ((valid_to IS NULL) = is_current)` + partial index `WHERE valid_to IS NULL` | `0001_init_schema.sql` |
| **H6** | Citizen RLS policy `complaint.created_by = auth.uid()` ไม่ครอบ intake ส่งต่อแทน citizen | Database HIGH | เปลี่ยน citizen policy เป็น EXISTS-subquery: `EXISTS (SELECT 1 FROM complainant c WHERE c.complaint_id = complaint.id AND c.party_type='citizen' AND c.person_id = auth.uid())` + index `complainant(person_id) WHERE party_type='citizen'` | `0004_rls_policies.sql` |
| **H7** | Edge Runtime ใช้ pg protocol ไม่ได้ ต้องใช้ PostgREST เท่านั้น | perf HIGH | ระบุใน §3.4 ว่า Edge route ใช้ Supabase REST/PostgREST (`@supabase/postgrest-js` หรือ fetch) ไม่ใช่ pg protocol; intake INSERT ที่ต้อง transaction+RLS cookie ใช้ Node.js Runtime | PRP-Plan §3.4 + Edge route impl |
| **H8** | Dedup `book_no + fiscal_year` ด้วย Redis ไม่มี fallback เมื่อ Upstash 10,000 cmd/day หมด | perf HIGH | fallback path: dedup ด้วย DB UNIQUE constraint + `ON CONFLICT DO NOTHING` เป็น source-of-truth; Redis เป็น cache ล้วน หาก miss ให้ query DB แต่ cache negative result 6 ชม. | `0001_init_schema.sql` (UNIQUE) + `lib/dedup.ts` |
| **H9** | Admin queue/reports ใช้ index `(org_id, status)` แต่ query จริงใช้ `category_id, received_at DESC` → full-scan 500MB | perf HIGH | เพิ่ม composite index `(received_at DESC, org_id)` + covering index `(org_id, status, received_at DESC) INCLUDE (book_no, category_id)`; รายงานเดือน/ไตรมาสใช้ materialized view refresh ผ่าน QStash ไม่ใช่ live query | `0001_init_schema.sql` + materialized view migration |
| **H10** | ฟอนต์ Sarabun/Noto Sans Thai โหลด full family → LCP > 2.5s บนมือถือผู้สูงอายุเน็ตช้า | perf HIGH | subset ฟอนต์ไทยเฉพาะ weight 400/600 + `font-display: swap` + preload 1 weight ต่อ family + `next/font/local` subset woff2; ห้ามโหลด Google Fonts CDN (render-block) | `src/styles/fonts.css` + `next.config.ts` |
| **H11** | คีย์บอร์ด suite เป็น manual อาจพลาด regression | a11y HIGH | เพิ่ม Playwright keyboard suite `keyboard-traverse.spec.ts` ครอบ flow ยื่นเรื่อง + ติดตาม + admin modal (Tab/Shift+Tab/Esc/Enter) + visible-focus assertion (SC 2.4.11) + assert ไม่มี keyboard trap; ผูกเป็น CI gate เทียบเท่า `test:e2e` | `e2e/keyboard-traverse.spec.ts` |
| **H12** | อีสาน `th-northeast` ไม่ระบุ BCP-47 tag ที่ถูกต้อง → SR อ่านอีสานด้วยเสียงไทยกลาง | a11y HIGH | กำหนด `lang="th-northeast"` หรือ custom subtag `x-northeast` ตาม BCP-47 + ตั้งค่า `--voice` ใน VoiceOver/NVDA test; เพิ่มใน DoD a11y ว่าต้องทดสอบ SR กับทั้งสอง namespace | `src/i18n/` + Storybook config + DoD |
| **H13** | สถานะ "ฉุกเฉิน" บอกว่าต้องมี text label คู่กับสี แต่ไม่ระบุ ARIA pattern ใน timeline Realtime | a11y HIGH | badge ใช้ `<span role="img" aria-label="ฉุกเฉิน">🚨</span> ฉุกเฉิน` + ใน `aria-live="polite"` ของ timeline เพิ่ม text สถานะใน message payload (SC 1.4.1 + 4.1.3); เพิ่ม `CaseStatusBadge` ใน Storybook baseline | `src/components/ui/CaseStatusBadge.*` + Storybook |
| **H14** | "ทางเลือกป้อนพิกัดเป็น text แทน drag" ไม่ได้กำหนดเป็น acceptance ของ map component ใน M0 | a11y HIGH | สร้าง story `MapPicker.a11y` ที่บังคับ: มี `<input type="text" inputmode="numeric">` สำหรับพิกัด lat/lng + `aria-label` ภาษาไทย + คีย์บอร์ดสามารถตั้งจุดได้โดยไม่ต้อง drag (SC 2.5.7); gate M0 ต้องผ่านก่อน P1 | `src/components/ui/MapPicker.*` + Storybook |
| **H15** | `audit_log` REVOKE/trigger ซ้ำกับ C1 | (รวมเป็นข้อเดียวกับ C1 — แก้ใน C1) | — | — |

### 0.3 R-PL-2 CRITICAL Gate (policy test per role ใน staging ก่อน P0.1 merge)

ก่อน merge P0.1 ต้องผ่าน **policy test per role ใน staging** เป็น gate CRITICAL (เสริมจาก `reviews.md` §3.3):

1. migration `0001`/`0003`/`0004` แก้ครบ M1–M9 (ตาม `reviews.md` §3.2) + ผ่าน lint/type-check
2. **policy test suite per role** ใน staging Supabase (DB ทดสอบ + seed 8 รายการต้นฉบับ):
   - `citizen` เห็นเฉพาะเรื่องตน (EXISTS-subquery ผ่าน)
   - `intake` เห็นเฉพาะ `org_id` ตน + ส่งต่อแทน citizen ไม่รั่ว
   - `assignee` เห็นเฉพาะ `complaint` ที่ตนอยู่ใน `assignment`
   - `admin` เห็นทั้งหมดใน `org_id` + อนุมัติ `budget` ได้
   - `sysadmin` bypass RLS (service_role เท่านั้น) + ไม่สามารถ UPDATE/DELETE `audit_log`
   - `service_role` ไม่สามารถ UPDATE/DELETE `audit_log` (REVOKE + trigger)
   - column-level RLS `person.cid`: citizen/intake เห็น masked, admin เห็น full (service_role เท่านั้น)
3. ทดสอบ integration: insert complaint แล้วตรวจ `audit_log.after` ต้องไม่มี CID plaintext
4. PRP-Plan รุ่นถัดไปแก้ครบ A1–A30 (ตาม `reviews.md` §3.1)
5. `scripts/verify-env.ts` ตรวจ secret shape/length ครบ (A11)
6. Storybook M0 gate: ทุก Radix primitive story ผ่าน `axe` + touch target 44px + contrast token + keyboard suite + MapPicker.a11y (A20, A24, A25, A26, H14)
7. CI gate: `@next/bundle-analyzer` + `bundlesize` + `check-contrast.ts` (A25, A27)

> ห้าม merge P0.1 จนกว่าทั้ง 7 ข้อข้างต้นผ่าน — เป็น gate CRITICAL บล็อก P0.1 merge

---

## 1. ภาพรวม Plan + ลำดับ Milestone

Plan แบ่งเป็น **5 เฟสหลัก + 1 เฟส scale** ตาม `context-package.md` ข้อ 8 และ `PRD.md` ข้อ 10 ลำดับเข้มงวด ฝั่ง foundation ทำเป็น serial (ห้ามข้าม) ส่วน P2/P3 สามารถทำคู่ขนานบางส่วนได้หลัง P1 go-live

**ลำดับ milestone:**
1. **Milestone 0 — Design system + Storybook (foundation-first)** — ตั้งโปรเจกต์ + tokens (รวม `--touch-target-min:44px` C6) + ร่าง Radix primitives + Storybook (axe + keyboard suite + MapPicker.a11y + CaseStatusBadge) + Vercel config placeholder + CSP/security headers + font subset + preconnect
2. **P0 — Foundation (BLOCK go-live)** — 10 deliverable serial (DB/RLS → audit append-only REVOKE+trigger+partition → Auth/MFA → seed → consent+withdrawal → งบ → CID keyed HMAC → Redis+DB fallback dedup → QStash → CI bundle gate) + policy test per role ใน staging เป็น gate CRITICAL
3. **P0.5 — Dry-run & Training** — โหลดข้อมูลต้นฉบับ 8 รายการ + อบรมเจ้าหน้าที่ + ทดสอบผู้สูงอายุ + iterate ภาษาอีสาน
4. **P1 — MVP Core** — รับเรื่อง citizen (auth: magic link/OTP/signed token — ห้าม anonymous H3) + หน่วยงานส่งต่อ + ติดตาม + admin timeline (Realtime authorization ผูก RLS) + notification + SLA escalation (QStash filter) + รายงานสรุป + CSV export (signed URL + MFA + DPIA) + ย้าย Vercel/Supabase → Pro + RUM web-vitals
5. **P2 — Growth** — LINE LIFF, Live Chat + Telegram, จองคิวนัดช่าง, a11y ผู้สูงอายุเพิ่ม (reduced-motion/draft non-PII/error pattern), PMQA, honeypot
6. **P3 — Scale** — Field App offline (PWA), AI classification, e-Sign, Multi-tenant shared schema+`org_id`+RLS, DR, `audit_log` archive cold tier via pg_partman

หลักการตั้งต้นตาม `context-package.md` ข้อ 10: **foundation-first, deliberate, custom identity** (ผู้ใช้ปฏิเสธ Recommended ทั้ง 2 — ต้องเคารพ)

---

## 2. Deliverable + Dependency DAG ต่อ Milestone

### 2.1 Milestone 0 — Design system + Storybook

| Deliverable | รายละเอียด |
|---|---|
| Next.js App Router + TypeScript + Tailwind (custom tokens) + Radix primitives ร่างเอง | ไม่ใช้ shadcn |
| `styles/tokens.css` light/dark ตั้งใจ (oklch + clamp typography) + **`--touch-target-min:44px` + `--touch-target-gap:8px` (C6)** + contrast token | ไม่ default dark mode; ฟอนต์ Sarabun/Noto Sans Thai 16pt base; touch target ≥44px; style direction เฉพาะเจาะจง (ไม่ใช่ "clean minimal") ≥4 required qualities |
| **Font subset + preload (H10)** | subset ฟอนต์ไทย weight 400/600 + `font-display: swap` + preload 1 weight ต่อ family + `next/font/local` subset woff2; ห้าม Google Fonts CDN |
| **Preconnect (M-P9)** | `<link rel="preconnect">` ไป Supabase domain ใน layout |
| **Inline critical CSS (M-P10)** | inline critical CSS ใน `<style>` สำหรับ above-the-fold citizen form |
| **CSP + security headers (M-S5)** | `next.config.ts` `headers()`: HSTS preload, `X-Frame-Options: DENY`, CSP nonce-based, `Permissions-Policy: camera=(),microphone=(),geolocation=()`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff` |
| Storybook + a11y addon + visual regression baseline (320/768/1024/1440 × {light,dark} × {100%,200%}) | baseline สำหรับทุก component ที่จะเขียนใน P1; **รวม `CaseStatusBadge` (H13) + `MapPicker.a11y` (H14) + keyboard-traverse story** |
| **`scripts/verify-env.ts` shape/length validation (A11)** | ตรวจ `SUPABASE_SERVICE_ROLE_KEY` decode JWT `role: service_role`, `UPSTASH_REDIS_REST_TOKEN` ≥ 32 char, `CID_HMAC_KEY` ≥ 32 char (C2), `QSTASH_*` ไม่ empty ทุก scope; fail fast ตอน boot |
| **`scripts/check-contrast.ts` (M-A4)** | รันใน CI ตรวจ 4.5:1 (text) / 3:1 (UI/status) ผ่าน `wcag-contrast` lib; gate M0 ผ่านทั้ง light/dark |
| **ESLint rule: touch target (C6) + `jsx-a11y/control-has-associated-label` (M-A5)** | block `<button>`/`<a>` ที่ `min-width/min-height < 44px`; enforce `aria-label` ไม่ empty ใน `components/ui/Button` |
| Vercel project config + `.env.example` (placeholder รวม `CID_HMAC_KEY`) + `.gitignore` (ใส่ `secrets\` + `.claude/settings.local.json` + `.env*` ยกเว้น `.env.example`) | ไม่ใส่ค่าจริง |

### 2.2 P0 — Foundation (BLOCK go-live) — serial ลำดับเข้มงวด

| # | Deliverable | รายละเอียด |
|---|---|---|
| P0.1 | DB schema + migration + RLS policy ทุกตาราง + **policy test per role ใน staging (R-PL-2 CRITICAL gate)** | `complaint`, `complainant` (CHECK mutual exclusion C4), `assignment`, `action`, `outcome`, `budget`, `address`, `taxonomy`, `book_receipt` (`book_no text` M-D3), `audit_log` (REVOKE+trigger+partition C1), `person`, `agency` (EXCLUDE H5), `person_tenure` (EXCLUDE H5), `consent` (H1) |
| P0.2 | `audit_log` append-only policy + PII strip + partition (C1+C5) | REVOKE UPDATE/DELETE จาก authenticated/anon/service_role; trigger BEFORE UPDATE OR DELETE RAISE EXCEPTION; range-partition รายเดือน/ปี; trigger strip CID/PII จาก jsonb before INSERT; field-level masking (CID→masked, phone→last 4, address→village); column-level RLS `before/after`; allow-list field ที่ log ได้; migration role แยกจาก service_role |
| P0.3 | Supabase Auth + MFA (admin/sysadmin/intake) + httpOnly cookie session | TOTP สำหรับ admin/sysadmin/intake; assignee/citizen ทางเลือก; ห้ามเก็บ token ใน localStorage |
| P0.4 | Address/taxonomy seed + RLS global shared (L-D3) | ~30 หมวด + 13 หมู่บ้านตำบลหัวงัว ผ่านกรมการปกครอง API; SELECT `USING (true)` + INSERT/UPDATE/DELETE `USING (auth.role() = 'service_role')` |
| P0.5 | PDPA consent flow + withdrawal (H1) | `consent` table (version, scope, granted_at, withdrawn_at) + endpoint `/api/consent/withdraw` trigger pseudonymize + `audit_log.action='consent_withdrawn'` + แจ้ง citizen |
| P0.6 | งบ กก.ทร. structured field + validation + composite index (L-D1) | `numeric(14,2)` + `ggor_code` index + composite `(fiscal_year, ggor_code) INCLUDE (amount, complaint_id)` |
| P0.7 | บัตร 13 หลัก checksum server-side + **CID keyed HMAC (C2)** + pgcrypto encrypt-at-rest + mask + column-level RLS | validate algorithm กรมการปกครองฝั่ง server; `pgcrypto hmac(cid, pgp_sym_decrypt(CID_HMAC_KEY), 'sha256')` → `cid_hmac`; `CID_HMAC_KEY` ≥ 32 char env Sensitive; ห้าม deterministic hash; hash index สำหรับค้น; mask `x-xxxx-xxxxxx-x` ใน UI/log |
| P0.8 | Upstash Redis wiring + **DB fallback dedup (H8)** + split P0.8a/P0.8b (L-C2) | `@upstash/redis` (REST) ไม่ใช่ `ioredis`; rate-limit sliding window (citizen ยื่น ≤5/ชม., login ≤10/10นาที, admin API ≤100/นาที) + ครอบ `track/[caseNo]` ≤20 req/นาที (M-S1); cache taxonomy/address stale-while-revalidate + write-through invalidate (M-P5); dedup `book_no + fiscal_year` — **DB UNIQUE constraint + `ON CONFLICT DO NOTHING` เป็น source-of-truth; Redis cache negative 6 ชม.** |
| P0.9 | QStash wiring + **timing-safe verify + rotation SOP (M-S3)** + Vercel Cron เป็นหลัก ping (M-C2) | webhook signature verify `QSTASH_CURRENT_SIGNING_KEY` ด้วย `crypto.timingSafeEqual`/`verifySignature`; ปฏิเสธ unsigned (OWASP A8); rotation runbook `docs/security-runbook.md`; ตรวจ `QSTASH_NEXT_SIGNING_KEY`; Supabase auto-pause ping ทุก 6 ชม. ใช้ **Vercel Cron (Pro tier)** เป็นหลัก QStash เก็บ SLA escalation เท่านั้น |
| P0.10 | CI + **bundle analyzer gate (A27)** | `pnpm audit --audit-level=high`, lint, type-check, axe ผ่าน 0 critical/serious, `test:unit` coverage ≥80%, `test:e2e` + **`@next/bundle-analyzer` + `bundlesize` fail PR ถ้า chunk เกิน budget (landing <150kb gz, app <300kb)**; route-level code splitting บน admin (lazy `reports`+`orgs` ผ่าน `next/dynamic`) |
| P0.11 | Storage `case-attachments` MIME/size/scan (M-S6) | MIME allow-list (image/jpeg,png,webp,pdf), max 10 MB, ตรวจ magic byte ฝั่ง server, signed URL upload หมดอายุ 5 นาที, antivirus scan ฝั่ง Edge Function; RLS path `{org_id}/{case_id}/...` |
| P0.12 | Retention-sweep redact PII ใน `audit_log` (M-S4) | `cron/retention` redact PII fields ใน `audit_log` rows เป็น batch (เก็บ metadata actor/action/timestamp ตามกฎหมาย 10 ปี); erasure request → pseudonymize live tables + redact PII audit; `complaint.pseudonymized_at` + `complainant.pseudonymized_at` flag (M-D5) |
| P0.13 | service-role route registry + lint rule (C3) | registry allow-list `/api/cron/*` เท่านั้น; lint บล็อก import `lib/supabase/admin.ts` ใน `(public)` route group; บังคับทุก service-role call เขียน audit row |
| P0.14 | Edge route ใช้ PostgREST เท่านั้น (H7) | Edge route ใช้ Supabase REST/PostgREST (`@supabase/postgrest-js` หรือ fetch) ไม่ใช่ pg protocol; intake INSERT ที่ต้อง transaction+RLS cookie ใช้ Node.js Runtime; ห้าม Edge Runtime กับ route ที่ใช้ `SUPABASE_SERVICE_ROLE_KEY` |

### 2.3 P0.5 — Dry-run & Training

| Deliverable | รายละเอียด |
|---|---|
| โหลดข้อมูลต้นฉบับ 8 รายการ (100/344/105/113/50/88/95/96) + dedup cross-file | dedup ด้วย natural key `book_no + fiscal_year` (DB UNIQUE source-of-truth) |
| อบรม intake + assignee ≥ 5 คน | เป้าหมายค้นเลขรับ + จัดประเภท + มอบหมาย ≤ 5 นาทีต่อเรื่อง |
| ทดสอบผู้สูงอายุ ≥ 5 คน | validate touch target 44px + ฟอนต์ 16pt + ซูม 200% + ภาษาอีสาน + SR (NVDA/VoiceOver) ทั้ง `th` + `th-northeast` (H12) |
| iterate ภาษาอีสาน ≥ 1 รอบ | ตาม feedback ชุมชน (ไม่ใช่ word-for-word translation) |

### 2.4 P1 — MVP Core

| Deliverable | รายละเอียด |
|---|---|
| รับเรื่อง citizen + หน่วยงานส่งต่อ | endpoint `/api/cases` + polymorphic `complainant` (CHECK C4); **citizen auth: magic link/OTP/signed token ผูก `book_no` ห้าม anonymous (H3)** |
| ติดตาม + admin timeline (Realtime) | subscribe `case_events` channel **ผ่าน Realtime Authorization ผูก RLS (H2)** + `postgres_changes` filter `org_id`/`created_by` แทน `broadcast`; payload server sanitize (ห้าม CID/name); `aria-live="polite"` + text สถานะใน payload (H13); Realtime throttle + poll list 30s (M-P2) |
| notification (อีเมล/SMS) | บันทึกใน `audit_log` + opt-out ตาม PDPA |
| SLA escalation (QStash) | filter ฝั่ง producer: งบ > 50,000 หรือ overdue > 7 วัน (ประหยัด 200 msg/day free) |
| รายงานสรุปเดือน/ไตรมาส + CSV export (watermark + audit + **DPIA H4**) | ออกทันเดือน 100% (KPI); **one-time signed URL หมดอายุ 5 นาที + MFA ก่อนโหลด + AES-256 at rest + DPIA `docs/dpia-export.md`** |
| ย้าย Vercel/Supabase → Pro | Vercel Pro $25/ด + Supabase Pro $25/ด + QStash Pro ถ้าเกิน 200 msg/day; re-enter Sensitive env; enable Vercel Cron; ปรับ Function Duration 10s → 60s |
| **Admin queue cursor pagination + RPC (M-D2, M-P3)** | cursor `WHERE (received_at, id) < ($last_received, $last_id)` LIMIT 50; single RPC `get_case_list(page)` คืน JSON รวม complainant/assignment/budget; query count ≤3/page |
| **Admin timeline RPC `get_case_timeline` (M-D1)** | single RPC `jsonb_agg` ทุก relation ใน transaction เดียว; integration test นับ query count ≤3 per page |
| **Web Vitals RUM (M-P8)** | ฝัง `web-vitals` v4 (`onLCP/onINP/onCLS`) → `/api/rum` → audit_log aggregate |
| **Image optimization (M-P1)** | Vercel Image Optimization + `next/image` preview, explicit `width/height` กัน CLS, AVIF/WebP fallback, `loading="lazy"` below-fold, max 1600px, generate derivative ผ่าน Supabase Edge Fn |

### 2.5 Dependency DAG

```
M0 ──► P0.1(schema/RLS + policy test staging gate) ──► P0.2(audit REVOKE+trigger+partition+PII strip)
                                    │
P0.4(seed address/taxonomy) ◄───────┤
P0.5(consent + withdrawal) ◄── P0.1
P0.6(งบ กก.ทร. + composite index) ◄── P0.1
P0.7(CID keyed HMAC + encrypt/mask) ◄── P0.1, P0.3, M0-15(verify-env CID_HMAC_KEY)
P0.8a(rate-limit+dedup Redis+DB fallback) ◄── P0.3   (L-C2 split)
P0.8b(cache taxonomy) ◄── P0.4                       (L-C2 split)
P0.9(QStash timing-safe + Vercel Cron ping) ◄── P0.1, P0.3
P0.10(CI + bundle gate) ◄── M0-09(keyboard suite), M0-04(contrast)
P0.11(Storage MIME/scan) ◄── P0.1
P0.12(retention-sweep redact) ◄── P0.2, P0.6
P0.13(service-role registry + lint) ◄── P0.3
P0.14(Edge PostgREST only) ◄── M0-01
P0.* ──► P0.5-dryrun ──► P1(citizen auth) ──► P2 ──► P3
```

---

## 3. Tech Architecture

### 3.1 โครงโฟลเดอร์ Next.js App Router (many-small-files, 200–400 บรรทัด/ไฟล์, ≤800)

```
src/
  app/
    (public)/              # citizen + ผู้ใช้ทั่วไป — ห้าม import lib/supabase/admin.ts (C3 lint)
      page.tsx              # landing + ยื่นเรื่อง
      track/[caseNo]/page.tsx
    (admin)/
      cases/page.tsx        # queue งาน intake (cursor pagination)
      cases/[id]/page.tsx    # รายละเอียด + timeline + ปิดเรื่อง
      reports/page.tsx      # สรุปผล + งบ กก.ทร. (lazy next/dynamic)
      orgs/page.tsx         # หน่วยงาน + บุคลากร bitemporal (lazy next/dynamic)
    api/
      cases/route.ts        # intake endpoint (Node.js Runtime — transaction+RLS cookie)
      cases/[id]/events/route.ts
      consent/withdraw/route.ts   # H1
      rum/route.ts                # M-P8 web-vitals
      webhooks/qstash/route.ts
      webhooks/supabase/route.ts
      cron/ping/route.ts        # Vercel Cron: ping Supabase ทุก 6 ชม. (service_role — ใน registry)
      cron/close-stale/route.ts # service_role — ใน registry
      cron/retention/route.ts    # service_role — ใน registry (redact PII batch)
      cron/escalate/route.ts     # service_role — ใน registry
  modules/
    cases/{intake-form.ts, timeline.ts, close-action.ts, repo.ts}  # M-C3 enumerate
    taxonomy/{list.ts, repo.ts}
    address/{lookup.ts, repo.ts}
    budget/{validation.ts, repo.ts}     # dependency: budget → cases เท่านั้น (M-C4)
    consent/{grant.ts, withdraw.ts, repo.ts}
  lib/
    supabase/{server.ts, client.ts, admin.ts}  # admin.ts = service_role registry (C3)
    upstash/{redis.ts, qstash.ts}
    thai-date.ts            # พ.ศ. = ค.ศ.+543, BE locale
    cid-checksum.ts         # บัตร 13 หลัก algorithm กรมการปกครอง
    cid-hmac.ts             # keyed HMAC helper (C2)
    budget-validation.ts    # งบ กก.ทร. numeric(14,2)
    dedup.ts                # book_no + fiscal_year (DB UNIQUE source-of-truth + Redis cache)
    route-registry.ts       # service_role allow-list (C3)
  components/ui/            # Radix primitives ร่างเอง (ไม่ใช้ shadcn) + CaseStatusBadge + MapPicker
  styles/
    tokens.css              # oklch + clamp typography + --touch-target-min:44px (C6) + contrast token
    fonts.css               # subset woff2 (H10)
  i18n/
    th.json
    th-northeast.json       # BCP-47 x-northeast (H12)
  middleware.ts             # authz check ทุก route admin + rate-limit (รวม track/[caseNo] M-S1)
```

หลักการ: high cohesion + low coupling; แยกฝั่ง public กับ admin ผ่าน route group `(public)`/`(admin)`; **`(public)` ห้าม import `lib/supabase/admin.ts` (C3 lint rule)**; `lib/` สำหรับ cross-cutting utilities; `modules/` แยกตาม domain; **dependency direction: `modules/budget` → `modules/cases` เท่านั้น (M-C4)** — cases เรียก budget ผ่าน slot/composition หรือผ่าน service ใน `modules/budget/index.ts`

### 3.2 Supabase Schema + Migration Outline (planning artifact — SQL snippet เพื่อวางแผน)

**ตารางหลัก (14):** `complaint`, `complainant` (polymorphic + CHECK C4), `person` (CID keyed HMAC C2), `agency` (bitemporal + EXCLUDE H5), `person_tenure` (bitemporal + EXCLUDE H5), `assignment` (many-to-many), `action`, `outcome`, `budget` (`numeric(14,2)` + `ggor_code` + composite index L-D1), `address` (กรมปกครอง codes), `taxonomy` (~30 หมวด seed), `book_receipt` (`book_no text` M-D3), `audit_log` (append-only C1 + PII strip C5 + partition), `consent` (H1)

**Migration files (วางแผน — ยังไม่สร้าง):**

1. `0001_init_schema.sql` — 14 ตาราง + index + constraint:
   - `complainant` CHECK mutual exclusion (C4):
     ```sql
     ALTER TABLE complainant ADD CONSTRAINT complainant_party_exclusivity
       CHECK ((party_type='citizen' AND person_id IS NOT NULL AND agency_id IS NULL)
           OR (party_type='agency'  AND agency_id IS NOT NULL AND person_id IS NULL));
     CREATE INDEX idx_complainant_citizen_person
       ON complainant(person_id) WHERE party_type='citizen';
     ```
   - `book_receipt.book_no text NOT NULL` (M-D3) + UNIQUE `(book_no, fiscal_year)` (composite natural key — H8 fallback source-of-truth)
   - `agency`/`person_tenure` EXCLUDE (H5):
     ```sql
     ALTER TABLE person_tenure ADD CONSTRAINT no_overlap_tenure
       EXCLUDE USING gist (person_id WITH =, tstzrange(valid_from, valid_to, '[]') WITH &&);
     ALTER TABLE person_tenure ADD CHECK ((valid_to IS NULL) = is_current);
     CREATE INDEX idx_person_tenure_current ON person_tenure(person_id) WHERE valid_to IS NULL;
     ```
   - `complaint.pseudonymized_at timestamptz` + `complainant.pseudonymized_at` (M-D5)
   - Composite + covering index (H9, M-D2, L-D1):
     ```sql
     CREATE INDEX idx_complaint_timeline ON complaint(received_at DESC, org_id);
     CREATE INDEX idx_complaint_admin_covering ON complaint(org_id, status, received_at DESC)
       INCLUDE (book_no, category_id) WHERE deleted_at IS NULL;
     CREATE INDEX idx_complaint_cursor ON complaint(received_at DESC, id);
     CREATE INDEX idx_budget_fiscal_ggor ON budget(fiscal_year, ggor_code) INCLUDE (amount, complaint_id);
     ```
   - `complaint(book_no, fiscal_year)` UNIQUE — natural key lookup
   - `complaint(status)` partial `WHERE deleted_at IS NULL`
   - `complaint(category_id, received_at DESC)` — รายงานตามหมวด
   - `assignment(complaint_id, assigned_at)`
   - `address(village_code, moo)`
   - `person_tenure(person_id, valid_to DESC)` partial `WHERE valid_to IS NULL`
   - `audit_log(entity, entity_id, at DESC)` — timeline
   - FK index ทุกตัว
   - `org_id` index บนทุก tenant-scoped table (L-D3 — เตรียม P3 multi-tenant)
   - Range-partition `complaint`/`audit_log` รายเดือนด้วย `received_at`/`at` (M-D5)

2. `0002_seed_taxonomy_address.sql` — ~30 หมวด + 13 หมู่บ้าน (P0.4)

3. `0003_audit_append_only.sql` (C1+C5):
   ```sql
   -- REVOKE UPDATE/DELETE จากทุก role รวม service_role (C1)
   REVOKE UPDATE, DELETE ON audit_log FROM authenticated, anon, service_role;
   GRANT INSERT, SELECT ON audit_log TO authenticated, service_role;

   -- Trigger ดับเบิ้ลกัน service_role/owner bypass (C1)
   CREATE OR REPLACE FUNCTION fn_audit_log_immutable() RETURNS trigger AS $$
   BEGIN
     RAISE EXCEPTION 'audit_log is append-only: UPDATE/DELETE prohibited';
   END;
   $$ LANGUAGE plpgsql;
   CREATE TRIGGER trg_audit_log_no_update BEFORE UPDATE OR DELETE ON audit_log
     FOR EACH ROW EXECUTE FUNCTION fn_audit_log_immutable();

   -- Range-partition รายเดือน/ปี (C1)
   CREATE TABLE audit_log (..., at timestamptz NOT NULL) PARTITION BY RANGE (at);
   CREATE TABLE audit_log_YYYY_MM PARTITION OF audit_log
     FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-MM+1-01');

   -- PII strip trigger ก่อน INSERT (C5)
   CREATE OR REPLACE FUNCTION fn_audit_strip_pii() RETURNS trigger AS $$
   BEGIN
     -- allow-list field ที่ log ได้: actor/action/entity/entity_id/timestamp/metadata non-PII
     -- strip CID/phone/address ออกจาก before/after jsonb
     -- CID → masked 'x-xxxx-xxxxxx-x', phone → last 4, address → village-level
     NEW.before := NEW.before - 'cid' - 'phone' - 'address_full';
     NEW.after  := NEW.after  - 'cid' - 'phone' - 'address_full';
     -- เพิ่ม masked fields แทน
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   CREATE TRIGGER trg_audit_strip_pii BEFORE INSERT ON audit_log
     FOR EACH ROW EXECUTE FUNCTION fn_audit_strip_pii();

   -- Migration role แยกจาก service_role (C1)
   -- ใช้สำหรับ schema migration เท่านั้น ไม่ใช้สำหรับ app runtime
   ```

4. `0004_rls_policies.sql` + `0005_cid_pgcrypto.sql` (C2+C3+H6+L-D3):
   ```sql
   -- Citizen policy: EXISTS-subquery (H6)
   CREATE POLICY p_complaint_citizen_select ON complaint FOR SELECT
     TO authenticated USING (
       EXISTS (SELECT 1 FROM complainant c
               WHERE c.complaint_id = complaint.id
                 AND c.party_type='citizen'
                 AND c.person_id = auth.uid())
     );

   -- intake policy: org_id IN person_tenure current
   CREATE POLICY p_complaint_intake_select ON complaint FOR SELECT
     TO authenticated USING (
       org_id IN (SELECT org_id FROM person_tenure
                  WHERE person_id = auth.uid() AND valid_to IS NULL)
     );

   -- assignee policy: เห็น complaint ที่ตนอยู่ใน assignment
   CREATE POLICY p_complaint_assignee_select ON complaint FOR SELECT
     TO authenticated USING (
       EXISTS (SELECT 1 FROM assignment a
               WHERE a.complaint_id = complaint.id AND a.person_id = auth.uid())
     );

   -- admin policy: เห็นทั้งหมดใน org_id + อนุมัติ budget
   CREATE POLICY p_complaint_admin_select ON complaint FOR SELECT
     TO authenticated USING (
       org_id IN (SELECT org_id FROM person_tenure
                  WHERE person_id = auth.uid() AND valid_to IS NULL
                    AND role IN ('admin','sysadmin'))
     );

   -- sysadmin: bypass RLS (service_role เท่านั้น)
   -- column-level RLS person.cid (C2): citizen/intake masked, admin full, service_role full
   ALTER TABLE person ENABLE ROW LEVEL SECURITY;
   CREATE POLICY p_person_cid_service ON person FOR ALL
     TO service_role USING (true) WITH CHECK (true);
   CREATE POLICY p_person_cid_admin ON person FOR SELECT
     TO authenticated USING (
       org_id IN (SELECT org_id FROM person_tenure
                  WHERE person_id = auth.uid() AND valid_to IS NULL AND role='admin')
     );

   -- CID keyed HMAC (C2)
   ALTER TABLE person ADD COLUMN cid bytea NOT NULL;        -- pgp_sym_encrypt
   ALTER TABLE person ADD COLUMN cid_hmac bytea NOT NULL;   -- hmac(cid, CID_HMAC_KEY, 'sha256')
   CREATE INDEX idx_person_cid_hmac ON person USING hash (cid_hmac);
   -- ห้าม deterministic hash ลำดับ

   -- taxonomy/address: global shared RLS (L-D3)
   CREATE POLICY p_taxonomy_select ON taxonomy FOR SELECT TO anon, authenticated USING (true);
   CREATE POLICY p_taxonomy_write ON taxonomy FOR ALL
     TO service_role USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
   ```

**Connection:** pooler URL port **6543** (transaction mode) ผ่าน `@supabase/ssr` (cookie session + RLS); service role เฉพาะ route ใน registry (`/api/cron/*` เท่านั้น C3); connection string `?pgbouncer=true&prepare_threshold=0` + `statement_timeout=10s` + `idle_timeout=30s` (L-D2)

**Realtime (H2):** subscribe `case_events` channel ผ่าน **Realtime Authorization ผูกกับ RLS policy ของ `complaint`** + ใช้ `postgres_changes` filter `org_id`/`created_by` แทน `broadcast`; payload ฝั่ง server sanitize ก่อน push (ห้ามส่ง CID/name ใน event)

**Storage:** bucket `case-attachments` + RLS path `{org_id}/{case_id}/...` + MIME allow-list + max 10 MB + magic byte + signed URL 5 นาที + antivirus scan (M-S6)

### 3.3 Upstash/QStash Wiring

**Redis REST (port 443):** ใช้ `@upstash/redis` (REST) ไม่ใช่ `ioredis` (RESP/TCP) — fit serverless ที่ไม่เปิด TCP keepalive
- Rate-limit: `@upstash/ratelimit` sliding window — citizen ยื่นเรื่อง ≤5 ครั้ง/ชม., login ≤10 ครั้ง/10 นาที, API admin ≤100 req/นาที, **`track/[caseNo]` ≤20 req/นาที (M-S1)**
- Cache taxonomy seed (~30 หมวด) + address lookup — stale-while-revalidate + **write-through invalidate ทุกครั้ง mutation taxonomy/address + TTL 6 ชม. safety net + บันทึก taxonomy version ใน `audit_log` (M-P5)**
- Dedup `book_no + fiscal_year` (composite natural key ต่อปีงบ) — **DB UNIQUE constraint + `ON CONFLICT DO NOTHING` เป็น source-of-truth (H8); Redis เป็น cache ล้วน หาก miss ให้ query DB + cache negative result 6 ชม.**; ทุก command ภายใน 10,000/day free tier

**QStash:** schedule SLA escalation + notify LINE LIFF/P2 + dead-letter retry
- webhook → `api/webhooks/qstash` มี signature verify `QSTASH_CURRENT_SIGNING_KEY` ด้วย **`crypto.timingSafeEqual`/`verifySignature` (M-S3)** ทุกคำขอ; ปฏิเสธ unsigned (OWASP A8); **rotation runbook `docs/security-runbook.md` + ตรวจ `QSTASH_NEXT_SIGNING_KEY`**
- filter ฝั่ง producer: เฉพาะเรื่องงบ > 50,000 หรือ overdue > 7 วัน (ประหยัด 200 msg/day free)
- **Supabase auto-pause ping ทุก 6 ชม. ใช้ Vercel Cron (Pro tier) เป็นหลัก (M-C2) — QStash เก็บสำหรับ SLA escalation เท่านั้น**
- **QStash topic `classify-assign` (M-C1):** producer=Supabase DB webhook consumer=Edge Function `classify+assign` + retry/dead-letter policy

### 3.4 Vercel Config + Edge Runtime Placement (H7)

- **Framework Preset:** Next.js (auto-detect จาก `next.config.ts`)
- **Build Command:** `next build && tsx scripts/verify-env.ts` (fail fast ถ้าขาด secret บังคับ รวม `CID_HMAC_KEY` ≥ 32 char C2)
- **Output Directory:** `.next`
- **Install Command:** `pnpm install --frozen-lockfile`
- **Node.js Version:** 20.x LTS
- **Function Region:** `sin1` (Singapore) — ใกล้ผู้ใช้ตำบลหัวงัว + ลด RTT ไป Supabase pooler ap-southeast-1
- **Function Duration:** webhook receiver (QStash) `maxDuration=30` (รองรับ retry backoff)

**Edge Runtime placement (H7 — ใช้ PostgREST เท่านั้น ไม่ใช่ pg protocol):**
- **Edge:** `/api/cases` (list), `/api/track/[caseNo]`, rate-limit middleware, webhook signature verify (latency ต่ำ cold start P95 < 100ms — M-P7) — ใช้ `@supabase/postgrest-js` หรือ fetch ไป Supabase REST
- **Node.js Runtime:** `/api/webhooks/qstash`, `/api/admin/export`, `/api/cases` (intake INSERT ที่ต้อง transaction+RLS cookie), ทุก route ที่ใช้ `SUPABASE_SERVICE_ROLE_KEY`
- ห้ามใช้ Edge Runtime กับ route ที่เรียก `SUPABASE_SERVICE_ROLE_KEY` + bypass RLS (token จะถูก bundle ใน edge bundle — R-PL-8)
- **service-role route registry (C3):** allow-list `/api/cron/*` เท่านั้น; lint บล็อก `lib/supabase/admin.ts` import ใน `(public)` route group

---

## 4. รายการไฟล์/โมดูลที่จะสร้างต่อ Milestone (PLAN เท่านั้น — ยังไม่สร้าง)

### Milestone 0
- `next.config.ts` (CSP headers M-S5), `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`
- `package.json` + `pnpm-lock.yaml` (หลังอนุมัติ design เท่านั้น)
- `src/styles/tokens.css` (oklch + clamp typography, light/dark ตั้งใจ + `--touch-target-min:44px` C6 + contrast token)
- `src/styles/fonts.css` (subset woff2 weight 400/600 H10)
- `src/components/ui/*` — Radix primitives ร่างเอง (Button, SurfaceCard, AnimatedText, Tabs, Modal, **CaseStatusBadge H13**, **MapPicker H14**, etc.)
- `src/i18n/th.json` + `src/i18n/th-northeast.json` (BCP-47 `x-northeast` H12)
- `.storybook/main.ts` + `preview.ts` + a11y addon + keyboard-traverse story + MapPicker.a11y story + CaseStatusBadge story
- `.env.example` (placeholder ทั้งหมด รวม `CID_HMAC_KEY` — ห้ามใส่ค่าจริง)
- `.gitignore` (ใส่ `secrets\`, `.claude/settings.local.json`, `.env*` ยกเว้น `.env.example`)
- `vercel.json` (project config placeholder)
- `scripts/verify-env.ts` (validate required secrets ตอน boot รวม `CID_HMAC_KEY` ≥ 32 char C2)
- `scripts/check-contrast.ts` (M-A4)
- `.eslintrc.cjs` (touch target C6 + `jsx-a11y/control-has-associated-label` M-A5 + import บล็อก `lib/supabase/admin.ts` ใน `(public)` C3)

### P0 Foundation
- `supabase/migrations/0001_init_schema.sql` (14 ตาราง + index + CHECK C4 + EXCLUDE H5 + composite index H9 + pseudonymized_at M-D5 + partition M-D5)
- `supabase/migrations/0002_seed_taxonomy_address.sql` (~30 หมวด + 13 หมู่บ้าน)
- `supabase/migrations/0003_audit_append_only.sql` (REVOKE C1 + trigger C1 + partition C1 + PII strip C5 + migration role C1)
- `supabase/migrations/0004_rls_policies.sql` (per role + per org + citizen EXISTS H6 + column-level RLS person.cid + taxonomy/address global L-D3)
- `supabase/migrations/0005_cid_pgcrypto.sql` (keyed HMAC C2 + encrypt-at-rest + hash index)
- `supabase/migrations/0006_consent_table.sql` (consent table H1)
- `supabase/migrations/0007_materialized_views.sql` (รายงานเดือน/ไตรมาส refresh ผ่าน QStash H9)
- `supabase/seed/taxonomy.sql` (~30 หมวด)
- `supabase/seed/address.sql` (13 หมู่บ้านตำบลหัวงัว ผ่านกรมการปกครอง API)
- `src/lib/supabase/{server,client,admin}.ts` (admin.ts = service_role registry C3)
- `src/lib/upstash/{redis,qstash}.ts`
- `src/lib/thai-date.ts` (พ.ศ.+543, BE locale)
- `src/lib/cid-checksum.ts` (algorithm กรมการปกครอง)
- `src/lib/cid-hmac.ts` (keyed HMAC helper C2)
- `src/lib/budget-validation.ts` (numeric(14,2) + ggor_code)
- `src/lib/dedup.ts` (DB UNIQUE source-of-truth + Redis cache fallback H8)
- `src/lib/route-registry.ts` (service_role allow-list C3)
- `src/modules/consent/*` (consent flow + version + timestamp + withdraw H1)
- `src/middleware.ts` (authz check ทุก route admin + rate-limit รวม track/[caseNo] M-S1)
- `src/app/api/cron/ping/route.ts` (Vercel Cron: ping Supabase ทุก 6 ชม. — service_role ใน registry)
- `src/app/api/cron/close-stale/route.ts` (service_role ใน registry)
- `src/app/api/cron/retention/route.ts` (redact PII batch M-S4 — service_role ใน registry)
- `src/app/api/cron/escalate/route.ts` (service_role ใน registry)
- `src/app/api/consent/withdraw/route.ts` (H1)
- `docs/security-runbook.md` (QStash rotation SOP M-S3)
- `.github/workflows/ci.yml` (lint + type-check + audit + test + a11y + e2e + bundle analyzer A27 + contrast check M-A4)

### P0.5 Dry-run
- `supabase/seed/source-8-cases.sql` (8 รายการต้นฉบับ 100/344/105/113/50/88/95/96 + dedup cross-file)
- `docs/training-material.md` (คู่มือเจ้าหน้าที่ intake + assignee)
- `docs/dry-run-report-template.md` (ผลทดสอบผู้สูงอายุ ≥ 5 คน + SR test th/th-northeast H12)
- `docs/dpia-export.md` (DPIA CSV export H4 — เริ่มร่าง)

### P1 MVP Core
- `src/app/(public)/page.tsx` (landing + ยื่นเรื่อง)
- `src/app/(public)/track/[caseNo]/page.tsx`
- `src/app/(admin)/cases/page.tsx` (queue งาน intake + cursor pagination M-D2)
- `src/app/(admin)/cases/[id]/page.tsx` (รายละเอียด + timeline + ปิดเรื่อง — RPC get_case_timeline M-D1)
- `src/app/(admin)/reports/page.tsx` (สรุปผล + งบ กก.ทร. + materialized view H9)
- `src/app/(admin)/orgs/page.tsx` (หน่วยงาน + บุคลากร bitemporal)
- `src/app/api/cases/route.ts` (intake endpoint — Node.js Runtime)
- `src/app/api/cases/[id]/events/route.ts`
- `src/app/api/rum/route.ts` (M-P8 web-vitals)
- `src/app/api/webhooks/qstash/route.ts`
- `src/app/api/webhooks/supabase/route.ts`
- `src/app/api/cases/list/rpc.ts` (RPC `get_case_list(page)` M-P3)
- `src/modules/cases/{intake-form.ts, timeline.ts, close-action.ts, repo.ts}` (M-C3 enumerate)
- `src/modules/taxonomy/{list.ts, repo.ts}`
- `src/modules/address/{lookup.ts, repo.ts}`
- `src/modules/budget/{validation.ts, repo.ts}` (M-C4 dependency direction)
- `e2e/keyboard-traverse.spec.ts` (H11)
- `docs/dpia-export.md` (H4 สำเร็จ)
- การย้าย Vercel/Supabase → Pro (ไม่ใช่ไฟล์ — การตั้งค่า dashboard)

### P2 Growth
- `src/app/api/webhooks/line/route.ts` (LINE LIFF OAuth bridge → Supabase Auth)
- `src/modules/live-chat/*` (Live Chat + Telegram)
- `src/app/(public)/queue/page.tsx` (จองคิวนัดช่าง)
- a11y ผู้สูงอายุเพิ่มเติม (M-A1 reduced-motion, M-A2 draft non-PII, M-A3 error pattern) + PMQA reporting + honeypot (L-S1)

### P3 Scale
- `src/app/(field)/` (PWA offline + sync conflict resolution)
- `src/modules/ai-classification/*`
- `src/modules/e-sign/*`
- Multi-tenant: `org_id` + shared schema + RLS + `SET LOCAL app.org_id` service-role (L-S2) + `current_setting('app.org_id')` RLS
- DR: backup + read replica + CQRS event sourcing
- `audit_log` archive cold tier via pg_partman (L-P2)

---

## 5. Env & Secret Management

### 5.1 `.env.example` (placeholder ทั้งหมด — ห้ามใส่ค่าจริง)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CID_HMAC_KEY=                # C2 — ≥32 char, Sensitive, แยกจาก service_role
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
CRON_SECRET=
NODE_ENV=
```

**กฎ:**
- `SUPABASE_SERVICE_ROLE_KEY` server-only ห้าม prefix `NEXT_PUBLIC_`; ใช้เฉพาะ route ใน registry `/api/cron/*` (C3)
- `CID_HMAC_KEY` (C2) — Sensitive, ≥ 32 char, แยกจาก `SUPABASE_SERVICE_ROLE_KEY`, validate ใน `scripts/verify-env.ts`
- `QSTASH_*` signing key สำหรับ verify webhook signature (OWASP A8) — timing-safe verify (M-S3)
- `CRON_SECRET` สำหรับ Vercel Cron route verify header
- validate required secrets ตอน boot (`scripts/verify-env.ts`) → fail fast ถ้าขาด/ผิด shape:
  - `SUPABASE_SERVICE_ROLE_KEY` decode เป็น JWT ที่มี `role: service_role` (M-S7)
  - `UPSTASH_REDIS_REST_TOKEN` ≥ 32 char (M-S7)
  - `CID_HMAC_KEY` ≥ 32 char (C2)
  - `QSTASH_*` ไม่ empty ทุก scope (M-S7)

### 5.2 Vercel Env Vars (Preview/Production แยก)

Vercel แบ่ง env เป็น 3 scope: **Development** (local `.env.local`), **Preview** (preview deployment), **Production** — ทุก secret ผูกกับ branch environment ไม่ใช่ project-wide เพื่อกันรั่วข้าม env

**Production (branch `main`):**
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (public)
- `SUPABASE_SERVICE_ROLE_KEY` (Sensitive — server-only)
- `CID_HMAC_KEY` (Sensitive — C2)
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- `QSTASH_TOKEN` / `QSTASH_CURRENT_SIGNING_KEY` / `QSTASH_NEXT_SIGNING_KEY`
- `CRON_SECRET`
- `NODE_ENV=production`

**Preview (branch `preview` หรือ feature branch):** ใช้ Supabase project แยก (staging) + QStash dev token — ห้ามใช้ service role key ของ prod บน preview เด็ดขาด; staging ใช้สำหรับ **policy test per role (R-PL-2 gate)**

**Sensitive checkbox:** ทุก key ที่ไม่ใช่ `NEXT_PUBLIC_*` ต้องติ๊ก "Sensitive" เพื่อไม่ expose ผ่าน `next dev` และ build log

### 5.3 `.gitignore` บังคับ

- `secrets\` (มี credential ฝั่ง Windows)
- `.claude/settings.local.json`
- `.env*` (ยกเว้น `.env.example`)
- หมุน secret เมื่อรั่ว; ไม่ใช้ `dangerously-skip-permissions`; commit message conventional commits ไม่มี attribution

---

## 6. Test Strategy

| ระดับ | ขอบเขต | เครื่องมือ |
|---|---|---|
| Unit | `lib/thai-date.ts` (พ.ศ.+543), `cid-checksum.ts` (บัตร 13 หลัก), `cid-hmac.ts` (keyed HMAC C2), `budget-validation.ts` (numeric(14,2) + ggor_code), `dedup.ts` (DB UNIQUE fallback H8), consent versioning, PII strip trigger function (C5) | Vitest |
| Integration | API `/cases`, **RLS policy per role (citizen/intake/assignee/admin/sysadmin/service_role)** — รวม `service_role` ไม่ UPDATE/DELETE `audit_log` (C1), `audit_log` PII strip (C5 — ตรวจ `after` ไม่มี CID), `complainant` CHECK mutual exclusion (C4 — insert ผิด fail), EXCLUDE constraint (H5 — insert ทับซ้อน fail), QStash webhook signature verify timing-safe (M-S3), Redis rate-limit sliding window + DB dedup fallback (H8), consent withdrawal pipeline (H1) | Vitest + Supabase local + msw |
| **Policy test per role (R-PL-2 CRITICAL gate)** | **Staging Supabase (DB ทดสอบ + seed 8 รายการ):** citizen เห็นเฉพาะเรื่องตน (EXISTS H6), intake ส่งต่อแทน citizen ไม่รั่ว, assignee เห็น assignment, admin เห็น org_id + อนุมัติ budget, sysadmin bypass (service_role เท่านั้น), service_role ไม่ UPDATE/DELETE audit_log (C1), column-level RLS person.cid (citizen/intake masked, admin full) | Vitest + Supabase staging |
| E2E | ยื่นเรื่อง → ติดตาม → admin timeline → ปิดเรื่อง + อนุมัติงบ 100,000 บาท (คลองไส้ไก่ รายการ 344) + consent withdraw | Playwright |
| **Keyboard suite (H11)** | flow ยื่นเรื่อง + ติดตาม + admin modal (Tab/Shift+Tab/Esc/Enter) + visible-focus assertion (SC 2.4.11) + assert ไม่มี keyboard trap — ผูกเป็น CI gate เทียบเท่า `test:e2e` | Playwright `keyboard-traverse.spec.ts` |
| a11y | คีย์บอร์ด 100%, NVDA (Windows) + VoiceOver (iOS Safari) ทั้ง `th` + `th-northeast` (H12), contrast AA ทุก token light/dark (`scripts/check-contrast.ts` M-A4), ซูม 200% + reflow 400% ไม่เกิด scroll แนวนอน, touch target 44px (C6), MapPicker คีย์บอร์ดตั้งจุดได้ (H14) | axe-core + Storybook a11y addon + manual |
| Visual regression | 320/768/1024/1440 × {light,dark} × {100%,200%} (L-A2) | Playwright screenshot |
| Load/CWV | LCP < 2.5s, INP < 200ms, CLS < 0.1, FCP < 1.5s, TBT < 200ms, Edge cold start P95 < 100ms (M-P7) + RUM (M-P8) | Lighthouse CI + `web-vitals` v4 |
| **Bundle (A27)** | `@next/bundle-analyzer` + `bundlesize` fail PR ถ้า chunk เกิน budget (landing <150kb gz, app <300kb); route-level code splitting admin (lazy `reports`+`orgs`) | `@next/bundle-analyzer` + `bundlesize` |

**Coverage เป้า ≥80%**

**Definition of Done (a11y):** axe 0 critical/serious + คีย์บอร์ด ผ่าน 100% (keyboard suite H11) + contrast ผ่านทุกหน้า light/dark (M-A4) + ผู้ใช้จริง P0.5 (ผู้สูงอายุ ≥ 5 คน) + ภาษาอีสาน iterate ≥ 1 รอบ + SR test ทั้ง `th` + `th-northeast` (H12) + touch target 44px (C6) + MapPicker คีย์บอร์ดตั้งจุดได้ (H14)

**Test ผู้สูงอายุ (P0.5):** ทดสอบ flow ยื่นเรื่อง + ติดตามด้วยอักษรใหญ่; validate touch target 44px + ฟอนต์ 16pt + ซูม 200%; เก็บ feedback ภาษาอีสาน + SR test matrix ทั้งสอง namespace

---

## 7. Deploy / CI Pipeline (Vercel + GitHub Actions)

### 7.1 CI Pipeline (GitHub Actions — gate ก่อน merge)

Vercel build รัน build + deploy อัตโนมัติ แต่ CI gate ก่อน merge อยู่ฝั่ง GitHub Actions:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint` (ESLint flat config — รวม touch target C6 + import บล็อก C3 + `jsx-a11y` M-A5)
3. `pnpm type-check` (`tsc --noEmit`)
4. `pnpm audit --audit-level=high` (OWASP A9)
5. `pnpm test:unit` (Vitest + coverage 80%)
6. `pnpm test:a11y` (axe-core + `scripts/check-contrast.ts` M-A4)
7. `pnpm test:e2e` (Playwright + visual regression 320/768/1440 × {light,dark} + **keyboard-traverse.spec.ts H11**)
8. `pnpm test:policy` (R-PL-2 CRITICAL gate — policy test per role ใน staging)
9. **`pnpm bundle-analyzer` + `bundlesize`** (A27 — fail PR ถ้า chunk เกิน budget)
10. Vercel Preview Deployment (auto)

PR merge ต้องผ่านทั้งหมด + review approval ก่อน promote ไป production

### 7.2 Preview URLs Workflow

- ทุก PR บน GitHub สร้า **Preview Deployment** อัตโนมัติ (Vercel GitHub Integration) ได้ URL แบบ `citizen-help-pr-<n>-<team>.vercel.app`
- **Comment bot:** สร้าง GitHub comment แนบ Preview URL + Lighthouse score (ผ่าน Vercel Speed Insights) + screenshot ของหน้า landing/admin ที่ breakpoint 320/768/1440
- **Preview ใช้ staging Supabase** (DB ทดสอบ + seed 8 รายการต้นฉบับ) ไม่กระทบ prod data — staging ใช้สำหรับ **policy test per role (R-PL-2 gate)**
- **Promote:** PR ที่ merge เข้า `main` → Vercel auto-deploy ไป Production หากผ่าน checklist

### 7.3 Promote / Rollback

- **Promote:** merge PR → `main` → Vercel build pipeline → Production Deployment อัตโนมัติ
- **Rollback:** ใช้ Vercel dashboard "Instant Rollback" กลับเป็น deployment ก่อนหน้า (immutable) — ไม่ rebuild จึงเร็ว <30s ใช้เมื่อ build ใหม่ break production (เช่น RLS policy regression กระทบ citizen flow)
- **Database migration rollback:** แยกจาก deployment rollback — ใช้ `supabase db reset --to <ref>` ด้วยมือเพราะ schema change อาจไม่ reversible; **policy migration safety (M-D4):** (1) add column nullable ก่อน, (2) backfill, (3) add NOT NULL/constraint, (4) รอ release, (5) drop old column release ถัดไป; RLS policy change deploy บน staging ก่อน พร้อม policy test per role (R-PL-2)

### 7.4 Vercel Cron Jobs (Pro tier) — เป็นหลักสำหรับ ping (M-C2)

| Cron | Schedule | Route | หน้าที่ |
|---|---|---|---|
| `ping-supabase` | `0 */6 * * *` | `/api/cron/ping` | ping Supabase pooler ทุก 6 ชม. เพื่อกัน **auto-pause 7 วัน** (R1 mitigation) — Vercel Cron เป็นหลัก ไม่กิน QStash quota |
| `close-stale-case` | `0 1 * * *` | `/api/cron/close-stale` | ปิดเรื่องค้างเกิน SLA + audit append-only |
| `retention-sweep` | `0 0 1 * *` | `/api/cron/retention` | ตรวจ `retention_until` + redact PII fields ใน `audit_log` batch (M-S4) + ตั้ง `pseudonymized_at` flag (M-D5) — PDPA พ.ร.บ. 2562 |
| `sla-escalation` | `*/30 * * * *` | `/api/cron/escalate` | สแกนเรื่อง overdue > 7 วัน → enqueue QStash (filter ฝั่ง producer ประหยัด 200 msg/day free) |

Cron route ต้อง verify `CRON_SECRET` header (Vercel ส่งมาให้) ป้องกัน external trigger; ทุก route ใน registry `/api/cron/*` (C3) + บังคับ audit row ทุก service-role call

### 7.5 Supabase Pooler + Upstash REST (Serverless-friendly)

- **Supabase pooler URL:** ใช้ `supabase.co` pooler endpoint port **6543** (transaction mode) ผ่าน `@supabase/ssr` — ไม่ใช่ direct connection port 5432 เพราะ Vercel serverless ไม่ถือ connection ถาวร
- **Connection string:** `postgresql://postgres.{ref}:{password}@aws-0-{region}.pooler.supabase.com:6543/postgres?pgbouncer=true&prepare_threshold=0` + `statement_timeout=10s` + `idle_timeout=30s` (L-D2)
- **Edge Function cron:** ห้ามใช้ pooler (ใช้ direct connection ผ่าน service_role ฝั่ง Vercel Node runtime — L-D2)
- **Upstash REST (port 443):** ใช้ `@upstash/redis` (REST) ไม่ใช่ `ioredis` (RESP/TCP) — fit serverless ที่ไม่เปิด TCP keepalive ทำให้ไม่กิน connection quota + ไม่มี cold start penalty ฝั่ง connection pool

### 7.6 Cold Start Mitigation

- **Edge Runtime:** P95 < 100ms cold start (M-P7 — ปรับจาก claim ~5ms ไม่จริง) — ใช้กับ route บ่อย (citizen track, rate-limit, landing)
- **Node.js Serverless:** 250-1000ms cold start — ใช้กับ route ที่ไม่บ่อย (admin export, QStash webhook, intake INSERT)
- กัน Supabase auto-pause ด้วย **Vercel Cron ping ทุก 6 ชม. เป็นหลัก (M-C2)** (มิฉะนั้น first query หลัง pause = 30s+ timeout)
- อย่าใช้ `globalThis` cache ใน Node.js route เพราะแต่ละ invocation อาจเป็น instance ต่างกัน (ใช้ Redis cache แทน)

### 7.7 Hobby → Pro Migration Path (P0.5 → P1)

Vercel Hobby ห้ามเชิงพาณิชย์ (ToS) → ต้องย้าย **Pro $25/ด** ก่อน go-live (R6)

**Migration checklist:**
1. Upgrade Vercel project เป็น Pro ใน dashboard (ไม่ต้อง rebuild)
2. ย้าย env vars Sensitive ใหม่ (Hobby → Pro ไม่ migrate Sensitive env อัตโนมัติ ต้อง re-enter) รวม `CID_HMAC_KEY` (C2)
3. Enable Vercel Cron (Pro เท่านั้น) + ตั้ง `CRON_SECRET`
4. ปรับ Function Duration จาก 10s → 60s สำหรับ webhook/retry route
5. Enable Vercel Speed Insights + Web Analytics (Pro only)
6. ปิด preview deployment สาธารณะ (Pro มี password protection สำหรับ preview)

Supabase Pro ($25/ด) + QStash Pro (ถ้าเกิน 200 msg/day) ย้ายคู่ขนานกันใน P1

---

## 8. Go/No-Go Criteria

- **M0 → P0:** axe ผ่าน 0 critical ทุก Storybook story (รวม `CaseStatusBadge` H13 + `MapPicker.a11y` H14); tokens light/dark ครบ + `--touch-target-min:44px` (C6); `scripts/check-contrast.ts` ผ่านทั้ง light/dark (M-A4); `.gitignore` ครอบ `secrets\`/`.claude`; Storybook visual regression baseline 320/768/1024/1440 × {light,dark} ครบ; keyboard suite H11 ผ่าน; font subset woff2 H10; CSP/security headers M-S5; `scripts/verify-env.ts` ผ่าน (รวม `CID_HMAC_KEY` ≥ 32 char C2)
- **P0 → P0.5 (R-PL-2 CRITICAL gate):** migration `0001`/`0003`/`0004`/`0005` แก้ครบ M1-M9 + **policy test per role ใน staging ผ่าน (R-PL-2)** — citizen เห็นเฉพาะเรื่องตน (EXISTS H6), intake ส่งต่อแทน citizen ไม่รั่ว, assignee เห็น assignment, admin เห็น org_id + อนุมัติ budget, sysadmin bypass (service_role เท่านั้น), **service_role ไม่ UPDATE/DELETE audit_log (C1)**, column-level RLS person.cid, **`audit_log.after` ไม่มี CID plaintext (C5)**, `complainant` CHECK บังคับ (C4), EXCLUDE กัน overlap (H5); RLS + MFA + audit append-only; CID keyed HMAC (C2) + encrypt + mask; consent flow + withdrawal (H1); งบ กก.ทร. validation; CI green (lint + type-check + audit + a11y + bundle A27 + contrast M-A4)
- **P0.5 → P1:** ข้อมูล 8 รายการต้นฉบับครบ + dedup cross-file (DB UNIQUE source-of-truth H8); อบรม + ทดสอบผู้ใช้จริงผ่าน (intake/assignee ≥ 5 คน + ผู้สูงอายุ ≥ 5 คน + SR test ทั้ง `th`/`th-northeast` H12); ภาษาอีสาน iterate ≥ 1 รอบ
- **P1 → Go-live:** Vercel Pro + Supabase Pro; CWV ผ่าน (LCP <2.5s, INP <200ms, CLS <0.1) + RUM (M-P8); KPI baseline วัดได้ (ระยะเวลาปิดเรื่อง ≤ 30 วัน, %ติดตามได้ ≥ 95%, รายงานสรุปผลออกทันเดือน 100%); a11y DoD ผ่าน; รายงานสรุปเดือน/ไตรมาส + CSV export (signed URL 5 นาที + MFA + AES-256 + DPIA H4) ทำงานได้; citizen auth ไม่ anonymous (H3)

---

## 9. Risk Register

### 9.1 ความเสี่ยงฝั่ง Plan (เพิ่มเติมจาก PRD ข้อ 11.2)

| ID | ความเสี่ยง | ระดับ | Mitigation ฝั่ง plan |
|---|---|---|---|
| R-PL-1 | M0 ล่าช้ากด P0 | HIGH | จ้าง/มอบหมาย design ก่อน schema; Storybook เป็น gate คู่ขนานได้ (tokens + Storybook ทำไปก่อน P0.1 review เสร็จ) |
| **R-PL-2** | **Migration RLS ผิด → ข้อมูลรั่ว** | **CRITICAL** | **review database-reviewer ก่อน P0.1 merge; policy test per role ใน staging เป็น gate CRITICAL (§0.3) — ไม่ merge จนกว่า policy test ผ่านทุก role รวม service_role ไม่ UPDATE/DELETE audit_log (C1) และ column-level RLS person.cid; migration M1-M9 ครบ; `audit_log.after` ไม่มี CID plaintext (C5)** |
| R-PL-3 | Supabase auto-pause กวาดงาน cron | HIGH | **Vercel Cron (Pro tier) เป็นหลัก ping ทุก 6 ชม. (M-C2)** + monitoring + Pro ก่อน go-live |
| R-PL-4 | Upstash 10,000 cmd/day พัง | MEDIUM | จำกัด cache hit pattern + stale-while-revalidate + **DB UNIQUE fallback dedup (H8)**; monitor ฝั่ง CI; Pro เมื่อเกิน |
| R-PL-5 | ภาษาอีสานไม่ตรงชุมชน | MEDIUM | validate P0.5 ≥ 5 ผู้สูงอายุ + iterate ≥ 1 รอบ; ไม่ใช้ word-for-word translation; SR test ทั้ง `th`/`th-northeast` (H12) |
| R-PL-6 | Multi-tenant P3 ทำลาย RLS | LOW | ออกแบบ `org_id` ตั้งแต่ P0 (shared schema) เพื่อ scale ไม่ต้อง refactor; `SET LOCAL app.org_id` service-role (L-S2) |
| R-PL-7 | Vercel Hobby → Pro migration พลาด Sensitive env | MEDIUM | checklist 7.7 re-enter env Sensitive ทุกตัว รวม `CID_HMAC_KEY` (C2); verify boot `scripts/verify-env.ts` |
| **R-PL-8** | **Edge Runtime bundle service role key** | **HIGH** | **ห้ามใช้ Edge Runtime กับ route ที่เรียก `SUPABASE_SERVICE_ROLE_KEY` (กฎ 3.4) + service-role route registry C3 + lint บล็อก import ใน `(public)`** |
| R-PL-9 | Database migration rollback ไม่ reversible | MEDIUM | แยกจาก Vercel rollback; ใช้ `supabase db reset --to <ref>` ด้วยมือ; **policy migration safety M-D4** (add nullable → backfill → add NOT NULL → รอ release → drop old); review migration safety ก่อน merge; RLS policy change deploy staging ก่อน + policy test (R-PL-2) |
| R-PL-10 | Cold start Node.js route ช้า > 1s | MEDIUM | ใช้ Edge Runtime บน route บ่อย (track, rate-limit); reserve Node.js สำหรับ admin export + webhook + intake INSERT; Edge P95 < 100ms (M-P7) |
| **R-PL-11 (ใหม่)** | **`audit_log` PII รั่วผ่าน jsonb before/after** | **CRITICAL** | trigger strip CID/PII ก่อน INSERT (C5) + column-level RLS `before/after` + integration test ตรวจ `audit_log.after` ไม่มี CID + allow-list field ที่ log ได้ |
| **R-PL-12 (ใหม่)** | **CID keyed HMAC key (`CID_HMAC_KEY`) รั่ว/หมุนไม่ทัน** | **HIGH** | env Sensitive แยกจาก service_role + `verify-env.ts` ตรวจ ≥ 32 char (C2) + rotation SOP ใน `docs/security-runbook.md` + ห้าม commit ใน repo |
| **R-PL-13 (ใหม่)** | **service_role ใช้นอก registry → ข้าม RLS รั่วข้าม org** | **HIGH** | route registry allow-list `/api/cron/*` เท่านั้น (C3) + lint บล็อก import `lib/supabase/admin.ts` ใน `(public)` + บังคับ audit row ทุก call + review service-role usage ทุก PR |
| **R-PL-14 (ใหม่)** | **Consent withdrawal pipeline พัง → PDPA ม.19 ละเมิด** | **HIGH** | `consent` table + `/api/consent/withdraw` + pseudonymize pipeline + `audit_log.action='consent_withdrawn'` (H1) + แจ้ง citizen ทางช่องทางที่ยินยอม + integration test |
| **R-PL-15 (ใหม่)** | **CSV export ไฟล์รั่ว → PDPA ละเมิดข้อมูลประชาชน** | **HIGH** | one-time signed URL หมดอายุ 5 นาที + MFA ก่อนโหลด + AES-256 at rest + DPIA `docs/dpia-export.md` (H4) + watermark + audit |
| **R-PL-16 (ใหม่)** | **Realtime broadcast รั่วข้าม org** | **HIGH** | Realtime Authorization ผูก RLS `complaint` (H2) + `postgres_changes` filter `org_id`/`created_by` แทน `broadcast` + payload server sanitize (ห้าม CID/name) + integration test cross-org ไม่รั่ว |
| **R-PL-17 (ใหม่)** | **Touch target 44px developer ใช้ค่าต่างกัน → a11y regression** | **MEDIUM** | token `--touch-target-min:44px` (C6) + ESLint rule block + Storybook axe gate + visual regression matrix |

### 9.2 ความเสี่ยงจาก PRD (อ้างอิง — ดู `PRD.md` ข้อ 11.2)

R1 (Supabase auto-pause 7 วัน — HIGH), R2 (Upstash 10k cmd/day — MEDIUM), R3 (CID รั่ว — CRITICAL → C2 keyed HMAC), R4 (ภาษาอีสาน — MEDIUM), R5 (ผู้สูงอายุใช้ฟอร์มไม่ได้ — HIGH → C6 touch target + H14 MapPicker), R6 (Vercel Hobby ห้ามเชิงพาณิชย์ — HIGH), R7 (เจ้าหน้าที่ไม่ยอมเปลี่ยนกระดาษ — MEDIUM), R8 (QStash 200 msg/day — MEDIUM), R9 (ส่งต่อหน่วยงานนอกไม่ตอบ — LOW), R10 (dep ช่องโหว่ A9 — MEDIUM), R11 (ข้อมูลต้นฉบับซ้ำซ้อนข้ามไฟล์ — LOW → H8 DB UNIQUE dedup), R12 (Multi-tenant P3 — LOW)

### 9.3 ความเสี่ยงที่ยังไม่ได้ quantified (อ้าง PRD ข้อ 11.3)

- ความสามารถ Edge Function Supabase ในงาน cron ปิดเรื่องค้าง (validate ใน P0) — ใช้ Vercel Cron เป็นหลัก (M-C2)
- ประสิทธิภาพ Realtime subscription ในหน้า admin เมื่อมีหลายเรื่อง concurrent (monitor ใน P0.5) — throttle + poll list 30s (M-P2)

---

## ภาคผนวก: อ้างอิง

- **Source-of-truth:** `D:\toppublic\per\docs\context-package.md`, `D:\toppublic\per\docs\PRD.md`
- **Reviews อ้างอิง:** `D:\toppublic\per\docs\reviews.md` (6 CRITICAL C1-C6 + 15 HIGH H1-H15 + 27 MEDIUM + 12 LOW)
- **Tracking issues:** `D:\toppublic\per\docs\tracking-issues.md` (60 issue แปลงจาก findings)
- **ไฟล์ต้นฉบับ .docx:** `1.ถนน ระบบระบายน้ำ.docx`, `สรุปผลการให้ความช่วยเหลือประชาชน รวมประเ.docx`
- **ปรัชญา stack:** Vercel + Supabase Cloud + Upstash Redis (REST) + QStash + Next.js App Router + TypeScript + Tailwind (custom tokens) + Radix UI (ร่างเอง ไม่ใช้ shadcn)
- **Phasing:** M0 (design system + Storybook) → P0 (foundation, BLOCK go-live, 14 deliverable serial + policy test gate) → P0.5 (dry-run + training) → P1 (MVP) → P2 (growth) → P3 (scale)
- **ปรัชญา:** foundation-first, deliberate, custom identity (ผู้ใช้ปฏิเสธ Recommended ทั้ง 2 — ต้องเคารพ)
- **รอบการแก้:** incorporate ทุก CRITICAL (C1-C6) + HIGH (H1-H15) จาก `reviews.md` + เพิ่ม R-PL-2 CRITICAL gate (policy test per role ใน staging) + เสริม risk register R-PL-11..R-PL-17