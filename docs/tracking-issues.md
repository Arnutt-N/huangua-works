# Tracking Issues — อบต.หัวงัว Citizen-Help Web App

> **Planning artifact (backlog)** — ไม่ใช่ code/scaffold
> Source: `context-package.md` + `PRP-Plan.md` + `reviews.md`
> ฟิลด์: ID | ชื่อ | Milestone | Priority | ประเภท | คำอธิบาย | Acceptance Criteria | Dependency | Estimate
> เรียงตาม Milestone แล้ว Priority (P0 > P1 > P2)
> Priority legend: **P0** = บล็อก gate/merge, **P1** = สำคัญต่อ milestone, **P2** = คุณภาพ/iterate
> Estimate: S (≤1d) / M (2-3d) / L (1w) / XL (>1w)

---

## Milestone 0 — Design system + Storybook (foundation-first)

| ID | ชื่อ | Milestone | Priority | ประเภท | คำอธิบาย | Acceptance Criteria | Dependency | Estimate |
|---|---|---|---|---|---|---|---|---|
| M0-01 | Next.js App Router + TS + Tailwind + Radix primitives scaffold plan | M0 | P0 | infra | ตั้งโปรเจกต์ Next.js App Router + TypeScript + Tailwind (custom tokens) + Radix primitives ร่างเอง (ไม่ใช้ shadcn) | `next.config.ts`/`tsconfig.json`/`tailwind.config.ts`/`postcss.config.js` มี; Radix primitives ร่างเอง; ไม่พบ shadcn dependency | — | M |
| M0-02 | `styles/tokens.css` light/dark ตั้งใจ (oklch + clamp typography) | M0 | P0 | feat | tokens CSS custom properties: oklch palette + clamp typography Thai-first, light/dark ตั้งใจ (ไม่ default dark mode) | tokens ครบ text/surface/accent/spacing/duration/ease; ฟอนต์ Sarabun/Noto Sans Thai 16pt base; ระบุ style direction เฉพาะเจาะจง (ไม่ใช่ "clean minimal"); ≥4 required qualities จาก 10 | M0-01 | M |
| M0-03 | Touch target ≥44px token + ESLint enforcement (CRITICAL C6) | M0 | P0 | a11y | เพิ่ม token `--touch-target-min: 44px` + `--touch-target-gap: 8px` และ ESLint rule block `<button>`/`<a>` ที่ `min-width/min-height < 44px` | token ประกาศใน `tokens.css`; ESLint rule ทำงาน; ทุก Radix primitive story ผ่าน gate | M0-02 | S |
| M0-04 | Contrast token check script (M-A4) | M0 | P0 | a11y | `scripts/check-contrast.ts` รันใน CI ตรวจ 4.5:1 (text) / 3:1 (UI/status) ผ่าน `wcag-contrast` lib | script รันผ่านทั้ง light/dark; รายงานคู่ text/surface ครบ; gate M0 ผ่าน | M0-02 | S |
| M0-05 | Storybook + a11y addon + visual regression baseline 320/768/1024/1440 | M0 | P0 | infra | Storybook + a11y addon + visual regression baseline สำหรับทุก component ที่จะเขียนใน P1 | `.storybook/main.ts`+`preview.ts`+a11y addon ตั้งค่า; baseline screenshot ครบ 4 breakpoint ทุก primitive; axe 0 critical/serious | M0-01 | M |
| M0-06 | Font subset + preload (H10) | M0 | P0 | perf | subset ฟอนต์ไทย weight 400/600 + `font-display: swap` + preload 1 weight ต่อ family + `next/font/local` subset woff2; ห้าม Google Fonts CDN | preload เฉพาะ weight ที่ใช้; ไม่มี render-block CDN; LCP < 2.5s บน profile มือถือช้า | M0-02 | S |
| M0-07 | Preconnect / DNS-prefetch (M-P9) | M0 | P1 | perf | เพิ่ม `<link rel="preconnect">` ไป Supabase domain ใน layout | preconnect ไป Supabase domain; อยู่ใน layout เดียว | M0-01 | S |
| M0-08 | Inline critical CSS for citizen form (M-P10) | M0 | P1 | perf | inline critical CSS ใน `<style>` สำหรับ above-the-fold citizen form | above-the-fold citizen form มี inline critical CSS; ไม่ render-block | M0-02 | S |
| M0-09 | Playwright keyboard suite `keyboard-traverse.spec.ts` (H11) | M0 | P0 | a11y | ครอบ flow ยื่นเรื่อง + ติดตาม + admin modal (Tab/Shift+Tab/Esc/Enter) + visible-focus assertion (SC 2.4.11) + ไม่มี keyboard trap; ผูกเป็น CI gate | suite รันผ่าน; ผูก CI gate เทียบเท่า `test:e2e`; ครอบทุก flow หลัก | M0-05 | M |
| M0-10 | BCP-47 `th-northeast` + SR test (H12) | M0 | P0 | a11y | กำหนด `lang="th-northeast"` หรือ `x-northeast` ตาม BCP-47 + ทดสอบ SR VoiceOver/NVDA กับทั้งสอง namespace เพิ่มใน DoD a11y | BCP-47 tag ถูกต้อง; SR test matrix ครอบ th + th-northeast; เพิ่มใน DoD | M0-05 | S |
| M0-11 | `CaseStatusBadge` Storybook baseline + ARIA pattern (H13) | M0 | P0 | a11y | badge สถานะใช้ `<span role="img" aria-label="ฉุกเฉิน">🚨</span> ฉุกเฉิน` + `aria-live="polite"` timeline text สถานะใน payload (SC 1.4.1 + 4.1.3) | story ครบ; ARIA pattern ใช้งานได้; ผ่าน axe | M0-05 | S |
| M0-12 | `MapPicker.a11y` story — text input พิกัด (H14) | M0 | P0 | a11y | story บังคับ `<input type="text" inputmode="numeric">` พิกัด lat/lng + `aria-label` ไทย + คีย์บอร์ดตั้งจุดได้โดยไม่ต้อง drag (SC 2.5.7) | story ผ่าน gate M0; คีย์บอร์ดตั้งจุดได้; ไม่ต้อง drag | M0-05 | S |
| M0-13 | ESLint `jsx-a11y/control-has-associated-label` (M-A5) | M0 | P0 | a11y | ESLint rule enforce `aria-label` ต้องไม่ empty ใน `components/ui/Button` | rule ทำงาน; ไม่มี button ไม่มี label หลงเข้า merge | M0-01 | S |
| M0-14 | Vercel project config + `.env.example` placeholder + `.gitignore` | M0 | P0 | infra | Vercel config + env placeholder (ไม่ใส่ค่าจริง) + `.gitignore` ใส่ `secrets\` + `.claude/settings.local.json` + `.env*` ยกเว้น `.env.example` | `.env.example` มี placeholder ทั้ง 9 ตัว; `.gitignore` ครอบ `secrets\`/`.claude`/`.env*`; Vercel config ตั้ง region `sin1` + Node 20 | M0-01 | S |
| M0-15 | `scripts/verify-env.ts` shape/length validation (A11) | M0 | P0 | sec | ตรวจ shape/length secret ตอน boot: `SUPABASE_SERVICE_ROLE_KEY` decode JWT `role: service_role`, `UPSTASH_REDIS_REST_TOKEN` ≥ 32 char, `CID_HMAC_KEY` ≥ 32 char, `QSTASH_*` ไม่ empty ทุก scope | script fail fast ถ้าขาด/ผิด shape; รันใน build `next build && tsx scripts/verify-env.ts` | M0-14 | S |
| M0-16 | CSP + security headers in `next.config.ts` (M-S5) | M0 | P1 | sec | `headers()`: HSTS preload, `X-Frame-Options: DENY`, CSP nonce-based, `Permissions-Policy: camera=(),microphone=(),geolocation=()`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff` | headers ครบ; CSP nonce-based ไม่ใช่ `unsafe-inline`; ทดสอบ response header | M0-01 | S |
| M0-17 | Go/No-Go gate M0 → P0 | M0 | P0 | infra | gate: axe ผ่าน 0 critical ทุก Storybook story; tokens light/dark ครบ; `.gitignore` ครอบ `secrets\`/`.claude`; visual regression baseline 320/768/1024/1440 ครบ; touch target 44px + contrast + keyboard + MapPicker.a11y | gate checklist ผ่านครบก่อนเข้า P0.1 | M0-01..M0-16 | S |

---

## P0 — Foundation (BLOCK go-live) — serial ลำดับเข้มงวด

| ID | ชื่อ | Milestone | Priority | ประเภท | คำอธิบาย | Acceptance Criteria | Dependency | Estimate |
|---|---|---|---|---|---|---|---|---|
| P0-01 | DB schema migration `0001_init_schema.sql` — 13 ตาราง + index | P0 | P0 | db | `complaint`, `complainant`, `assignment`, `action`, `outcome`, `budget`, `address`, `taxonomy`, `book_receipt`, `audit_log`, `person`, `agency`, `person_tenure` + index เบื้องต้น | 13 ตารางสร้างครบ; FK index ทุกตัว; `complaint(book_no, fiscal_year)` UNIQUE; `address(village_code, moo)` | M0-17 | L |
| P0-02 | `complainant` CHECK mutual exclusion (CRITICAL C4 / M1) | P0 | P0 | db | CHECK constraint `party_type='citizen' → person_id NOT NULL AND agency_id NULL` (และกลับกัน) + index `complainant(person_id) WHERE party_type='citizen'` | constraint บังคับ; ทดสอบ insert ผิดแล้ว fail; index สร้าง | P0-01 | S |
| P0-03 | `book_receipt.book_no text NOT NULL` + UNIQUE composite (M-D3 / M6) | P0 | P0 | db | `book_no text` ห้ามใช้ `int`/`bigint`; UNIQUE `(book_no, fiscal_year)` | ใช้ `text`; UNIQUE composite ทำงาน; รองรับ leading zero | P0-01 | S |
| P0-04 | Bitemporal EXCLUDE constraint (H5 / M4) | P0 | P0 | db | `agency`/`person_tenure` EXCLUDE `gist (person_id WITH =, tstzrange(valid_from, valid_to, '[]') WITH &&)` + `CHECK ((valid_to IS NULL) = is_current)` + partial index `WHERE valid_to IS NULL` | constraint กัน overlap; ทดสอบ insert ทับซ้อน fail; partial index สร้าง | P0-01 | M |
| P0-05 | Composite + covering index admin/reports (H9, M-D2, L-D1 / M9) | P0 | P0 | db/perf | composite `(received_at DESC, org_id)` + covering `(org_id, status, received_at DESC) INCLUDE (book_no, category_id)` + `(fiscal_year, ggor_code) INCLUDE (amount, complaint_id)` + `complaint(received_at DESC, id)` คู่กับ partial `complaint(status) WHERE deleted_at IS NULL` | index ครบ; EXPLAIN admin queue/reports ไม่ full-scan; cursor pagination ใช้ `(received_at, id)` | P0-01 | M |
| P0-06 | Range-partition `complaint`/`audit_log` รายเดือน + `pseudonymized_at` (M-D5 / M7) | P0 | P0 | db | range-partition รายเดือนด้วย `received_at`; เพิ่ม `complaint.pseudonymized_at timestamptz` + `complainant.pseudonymized_at` | partition สร้าง; flag มี; cron retention ใช้ flag แทนลบ | P0-01 | L |
| P0-07 | RLS policies `0004_rls_policies.sql` per role + per org | P0 | P0 | db | `citizen` EXISTS-subquery; `intake` org_id IN person_tenure; `assignee` เห็น assignment; `admin` org_id + อนุมัติ budget; `sysadmin` bypass (service_role เท่านั้น); column-level RLS `person.cid` | policy ครบ 5 บทบาท; policy test per role ใน staging ผ่าน (R-PL-2) | P0-01 | L |
| P0-08 | Citizen RLS EXISTS-subquery (H6 / M5) | P0 | P0 | db | เปลี่ยน citizen policy เป็น `EXISTS (SELECT 1 FROM complainant c WHERE c.complaint_id = complaint.id AND c.party_type='citizen' AND c.person_id = auth.uid())` + index `complainant(person_id) WHERE party_type='citizen'` | policy ใช้ EXISTS; ทดสอบ citizen เห็นเฉพาะเรื่องตน; intake ส่งต่อไม่รั่ว | P0-07 | S |
| P0-09 | `audit_log` append-only migration `0003_audit_append_only.sql` (CRITICAL C1 / M2) | P0 | P0 | db | `REVOKE UPDATE, DELETE ON audit_log FROM authenticated, anon, service_role` เก็บ INSERT/SELECT + trigger `BEFORE UPDATE OR DELETE RAISE EXCEPTION` + range-partition รายเดือน/ปี + migration role แยกจาก service_role | REVOKE ครบ 3 role; trigger ดับเบิ้ล; partition สร้าง; service_role ลบไม่ได้ | P0-01 | M |
| P0-10 | `audit_log` jsonb strip PII + field-level masking (CRITICAL C5 / M3) | P0 | P0 | db | trigger function strip `cid`/PII ออกจาก jsonb payload ก่อน INSERT: CID → masked, phone → last 4, address → village-level; column-level RLS บน `before/after`; integration test ตรวจ `audit_log.after` ไม่มี CID | trigger strip ทำงาน; integration test ไม่พบ CID plaintext ใน audit_log; column-level RLS ตั้ง | P0-09 | M |
| P0-11 | Supabase Auth + MFA + httpOnly cookie session (P0.3) | P0 | P0 | sec | TOTP สำหรับ admin/sysadmin/intake; assignee/citizen ทางเลือก; ห้ามเก็บ token ใน localStorage; ใช้ `@supabase/ssr` cookie session | MFA TOTP ทำงาน; ไม่มี token ใน localStorage; cookie httpOnly + Secure + SameSite | P0-07 | L |
| P0-12 | Citizen auth P1 กำหนด (H3 / A3) | P0 | P0 | sec | กำหนด citizen auth ใน P1: email magic link / phone OTP ผ่าน Supabase Auth หรือ signed tracking token ผูกกับ `book_no` — ห้าม anonymous intake | design doc ระบุกลไก citizen auth; ห้าม anonymous intake; signed token ผูก book_no | P0-11 | M |
| P0-13 | CID keyed HMAC (CRITICAL C2 / A6) | P0 | P0 | sec | ใช้ keyed HMAC `pgcrypto hmac(cid, pgp_sym_decrypt(secret_key), 'sha256')` → `cid_hmac` คอลัมน์; `CID_HMAC_KEY` env Sensitive ≥ 32 char; ห้าม plain SHA-256; hash index สำหรับค้น | HMAC ใช้งาน; `CID_HMAC_KEY` ใน env; `verify-env.ts` ตรวจ ≥ 32 char; ไม่มี deterministic hash ลำดับ | P0-01, M0-15 | M |
| P0-14 | CID checksum algorithm กรมการปกครอง + mask UI/log (P0.7) | P0 | P0 | sec | validate algorithm บัตร 13 หลักฝั่ง server; mask `x-xxxx-xxxxxx-x` ใน UI/log; pgcrypto encrypt-at-rest + column-level RLS | checksum ทำงาน server-side; mask ทุกจุด; encrypt-at-rest; column-level RLS | P0-13 | M |
| P0-15 | Address/taxonomy seed (P0.4) | P0 | P0 | db | ~30 หมวด taxonomy + 13 หมู่บ้านตำบลหัวงัว ผ่านกรมการปกครอง API | seed ครบ; ผ่านกรมปกครอง API; taxonomy 30 หมวด; 13 หมู่บ้าน | P0-01 | M |
| P0-16 | PDPA consent flow + withdrawal (H1 / A1) | P0 | P0 | sec | `consent` table (version, scope, granted_at, withdrawn_at) + endpoint `/api/consent/withdraw` trigger pseudonymize pipeline + บันทึก `audit_log.action='consent_withdrawn'` + แจ้ง citizen | consent table สร้าง; withdraw endpoint ทำงาน; pseudonymize pipeline รัน; audit บันทึก; แจ้ง citizen | P0-01 | L |
| P0-17 | งบ กก.ทร. structured field + validation (P0.6) | P0 | P0 | db | `numeric(14,2)` + `ggor_code` index + budget validation lib | validation ทำงาน; `numeric(14,2)`; ggor_code index | P0-01 | S |
| P0-18 | Realtime Authorization ผูก RLS (H2 / A2) | P0 | P0 | sec | เปิด Realtime Authorization ผูกกับ RLS policy ของ `complaint` + `postgres_changes` filter `org_id`/`created_by` แทน `broadcast` + payload server sanitize (ห้ามส่ง CID/name ใน event) | Realtime ผ่าน RLS; ใช้ `postgres_changes` filter; payload ไม่มี PII; ทดสอบ cross-org ไม่รั่ว | P0-07 | M |
| P0-19 | service-role route registry + lint rule (CRITICAL C3 / A5) | P0 | P0 | sec | registry ระบุ route ที่อนุญาต (`/api/cron/*` เท่านั้น); ตรวจ `process.env.SUPABASE_SERVICE_ROLE_KEY` เฉพาะไฟล์ใน registry; lint rule บล็อก import ใน `(public)` route group; บังคับทุก service-role call ส่ง audit row | registry ครบ; lint บล็อก import ใน (public); ทุก service-role call มี audit row | P0-11 | M |
| P0-20 | Upstash Redis wiring — rate-limit + cache + dedup (P0.8) | P0 | P0 | infra | `@upstash/redis` (REST) ไม่ใช่ `ioredis`; rate-limit sliding window (citizen ยื่น ≤5/ชม., login ≤10/10นาที, admin API ≤100/นาที); cache taxonomy/address stale-while-revalidate; dedup `book_no + fiscal_year` | ใช้ REST; rate-limit ทำงาน; cache hit; dedup ทำงาน; ภายใน 10,000 cmd/day | P0-15, P0-11 | L |
| P0-21 | Dedup `book_no + fiscal_year` DB fallback (H8 / A17) | P0 | P0 | db/perf | fallback path: DB UNIQUE constraint + `ON CONFLICT DO NOTHING` เป็น source-of-truth; Redis เป็น cache ล้วน; miss ให้ query DB + cache negative result 6 ชม. | DB UNIQUE constraint ทำงาน; Redis cache negative 6 ชม.; ทดสอบ Redis down → DB ยัง dedup ได้ | P0-03, P0-20 | S |
| P0-22 | QStash wiring + signature verify timing-safe (P0.9 / M-S3 / A8) | P0 | P0 | sec | webhook signature verify `QSTASH_CURRENT_SIGNING_KEY` ด้วย `crypto.timingSafeEqual`/`verifySignature`; ปฏิเสธ unsigned (OWASP A8); rotation runbook `docs/security-runbook.md`; ตรวจ `QSTASH_NEXT_SIGNING_KEY`; Supabase auto-pause ping ทุก 6 ชม. | signature verify timing-safe; ปฏิเสธ unsigned; runbook มี; rotation SOP ทดสอบ; ping ทุก 6 ชม. | P0-11, M0-15 | M |
| P0-23 | Storage `case-attachments` MIME/size/scan (M-S6 / A10) | P0 | P0 | sec | MIME allow-list (image/jpeg,png,webp,pdf), max 10 MB, ตรวจ magic byte ฝั่ง server, signed URL upload หมดอายุ 5 นาที, antivirus scan ฝั่ง Edge Function; RLS path `{org_id}/{case_id}/...` | MIME allow-list บังคับ; magic byte ตรวจ; signed URL 5 นาที; antivirus scan รัน | P0-01 | M |
| P0-24 | Retention-sweep redact PII ใน `audit_log` (M-S4 / A9) | P0 | P0 | sec | retention-sweep cron redact PII fields ใน `audit_log` rows (เก็บ metadata actor/action/timestamp ตามกฎหมาย 10 ปี); `cron/retention` ทำ redaction เป็น batch; erasure request → pseudonymize live tables + redact PII audit | redaction batch รัน; ทดสอบ erasure → PII หายจาก live + audit; เก็บ metadata | P0-06, P0-10 | M |
| P0-25 | Edge route ใช้ PostgREST เท่านั้น (H7 / A16) | P0 | P0 | perf/arch | ระบุใน PRP-Plan §3.4 ว่า Edge route ใช้ Supabase REST/PostgREST (`@supabase/postgrest-js` หรือ fetch) ไม่ใช่ pg protocol; intake INSERT ที่ต้อง transaction+RLS cookie ใช้ Node.js Runtime; ห้าม Edge Runtime กับ route ที่ใช้ `SUPABASE_SERVICE_ROLE_KEY` | PRP-Plan ระบุชัด; Edge route ไม่ใช้ pg; intake INSERT ใช้ Node.js Runtime; service_role ไม่ใน Edge bundle | M0-01 | S |
| P0-26 | Async flow QStash topic `classify-assign` (M-C1 / A12) | P0 | P1 | arch | เพิ่ม QStash topic `classify-assign` producer=Supabase DB webhook consumer=Edge Function `classify+assign`; ระบุ retry/dead-letter policy; อัปเดต PRD §5.4 ให้สอดคล้อง | topic สร้าง; retry/dead-letter policy ระบุ; PRD §5.4 อัปเดต | P0-22 | M |
| P0-27 | Vercel Cron เป็นหลักสำหรับ ping กัน auto-pause (M-C2 / A13) | P0 | P1 | arch | เลือก Vercel Cron (Pro tier, ไม่กิน QStash quota) เป็นหลัก QStash เก็บสำหรับ SLA escalation เท่านั้น; แก้ PRD §10.2 | Vercel Cron ใช้; QStash เก็บ SLA เท่านั้น; PRD §10.2 อัปเดต | P0-22 | S |
| P0-28 | `modules/*` sub-files enumerate (M-C3 / A14) | P0 | P1 | arch | แตก sub-files ต่อ module (`modules/cases/{intake-form.ts, timeline.ts, close-action.ts, repo.ts}`) ระบุไฟล์ละ responsibility + ขนาด 200–400 บรรทัด | enumerate ครบทุก module; ไฟล์ละ 200-400 บรรทัด; responsibility ชัด | M0-01 | M |
| P0-29 | Dependency direction `modules/budget` → `modules/cases` (M-C4 / A15) | P0 | P1 | arch | กำหนดกฎ: `modules/budget` → `modules/cases` (budget อ้าง complaint) เท่านั้น; cases เรียก budget ผ่าน slot/composition หรือผ่าน service ใน `modules/budget/index.ts` | กฎระบุใน PRP-Plan; ไม่มี import ย้อนทิศ; cases เรียก budget ผ่าน service | P0-28 | S |
| P0-30 | CI pipeline `ci.yml` — lint/type-check/audit/test/a11y/e2e + bundle analyzer (P0.10 / A27) | P0 | P0 | infra | `pnpm lint` + `type-check` + `audit --audit-level=high` + `test:unit` (coverage ≥80%) + `test:a11y` (axe) + `test:e2e` (Playwright + visual regression) + `@next/bundle-analyzer` + `bundlesize` fail PR ถ้า chunk เกิน budget | CI รันครบ 8 step; coverage ≥80%; axe 0 critical; bundle ไม่เกิน budget (landing <150kb gz, app <300kb) | M0-09, M0-04 | L |
| P0-31 | Go/No-Go gate P0 → P0.5 | P0 | P0 | infra | gate: RLS + MFA + audit append-only ทดสอบผ่าน; CID encrypt + mask; consent flow; งบ กก.ทร. validation; CI green; policy test per role ผ่านใน staging (R-PL-2) | gate checklist ผ่านครบ; policy test ผ่าน; migration M1-M9 ครบ | P0-01..P0-30 | S |

---

## P0.5 — Dry-run & Training

| ID | ชื่อ | Milestone | Priority | ประเภท | คำอธิบาย | Acceptance Criteria | Dependency | Estimate |
|---|---|---|---|---|---|---|---|---|
| P05-01 | โหลดข้อมูลต้นฉบับ 8 รายการ + dedup cross-file | P0.5 | P0 | db | `supabase/seed/source-8-cases.sql` (8 รายการ 100/344/105/113/50/88/95/96) + dedup ด้วย natural key `book_no + fiscal_year` | seed 8 รายการครบ; dedup ทำงาน; ไม่มี duplicate | P0-31 | M |
| P05-02 | อบรม intake + assignee ≥ 5 คน | P0.5 | P0 | feat | `docs/training-material.md` + อบรม; เป้าหมายค้นเลขรับ + จัดประเภท + มอบหมาย ≤ 5 นาทีต่อเรื่อง | คู่มือครบ; อบรม ≥5 คน; เวลาเฉลี่ย ≤5 นาที/เรื่อง | P05-01 | M |
| P05-03 | ทดสอบผู้สูงอายุ ≥ 5 คน | P0.5 | P0 | a11y | `docs/dry-run-report-template.md`; validate touch target 44px + ฟอนต์ 16pt + ซูม 200% + ภาษาอีสาน | ทดสอบ ≥5 คน; ผ่าน touch/ฟอนต์/ซูม; เก็บ feedback | P05-01 | M |
| P05-04 | iterate ภาษาอีสาน ≥ 1 รอบ | P0.5 | P0 | a11y | iterate ตาม feedback ชุมชน (ไม่ใช่ word-for-word translation) | iterate ≥1 รอบ; feedback บันทึก; อัปเดต `th-northeast.json` | P05-03 | S |
| P05-05 | Go/No-Go gate P0.5 → P1 | P0.5 | P0 | infra | ข้อมูล 8 รายการครบ + dedup; อบรม + ทดสอบผู้ใช้จริงผ่าน; ภาษาอีสาน iterate ≥1 รอบ | gate ผ่านครบ | P05-01..P05-04 | S |

---

## P1 — MVP Core

| ID | ชื่อ | Milestone | Priority | ประเภท | คำอธิบาย | Acceptance Criteria | Dependency | Estimate |
|---|---|---|---|---|---|---|---|---|
| P1-01 | รับเรื่อง citizen + หน่วยงานส่งต่อ (intake endpoint) | P1 | P0 | feat | endpoint `/api/cases` + polymorphic `complainant` (citizen + agency) | endpoint ทำงาน; polymorphic party_type; RLS บังคับ; audit บันทึก | P05-05 | L |
| P1-02 | ติดตาม + admin timeline (Realtime) | P1 | P0 | feat | subscribe `case_events` channel; `aria-live="polite"`; Realtime authorization ผูก RLS | Realtime ทำงาน; aria-live ประกาศสถานะ; ผ่าน RLS | P1-01 | L |
| P1-03 | Notification อีเมล/SMS | P1 | P0 | feat | บันทึกใน `audit_log` + opt-out ตาม PDPA | notification ส่ง; opt-out ทำงาน; audit บันทึก | P1-01 | M |
| P1-04 | SLA escalation (QStash filter ฝั่ง producer) | P1 | P0 | feat | filter เฉพาะเรื่องงบ > 50,000 หรือ overdue > 7 วัน (ประหยัด 200 msg/day free) | filter ทำงาน; ภายใน 200 msg/day; escalation enqueue | P1-01, P0-22 | M |
| P1-05 | รายงานสรุปเดือน/ไตรมาส + CSV export (watermark + audit + DPIA) | P1 | P0 | feat/sec | ออกทันเดือน 100% (KPI); CSV export watermark + audit; one-time signed URL หมดอายุ 5 นาที; MFA ก่อนโหลด; AES-256 at rest; DPIA `docs/dpia-export.md` | รายงานออกทันเดือน; signed URL 5 นาที; MFA บังคับ; AES-256; DPIA มี | P1-01 | L |
| P1-06 | ย้าย Vercel/Supabase → Pro | P1 | P0 | infra | Vercel Pro $25/ด + Supabase Pro $25/ด + QStash Pro ถ้าเกิน 200 msg/day; re-enter Sensitive env; enable Vercel Cron; ปรับ Function Duration 10s → 60s | Pro ใช้งาน; env Sensitive re-enter; Cron ทำงาน; `verify-env.ts` ผ่าน | P1-01 | M |
| P1-07 | Admin queue cursor pagination + RPC (M-D2, M-P3) | P1 | P1 | db/perf | cursor pagination `WHERE (received_at, id) < ($last_received, $last_id)`; single RPC `get_case_list(page)` คืน JSON รวม complainant/assignment/budget | cursor pagination ทำงาน; RPC คืน JSON รวม; query count ≤3/page | P0-05, P1-01 | M |
| P1-08 | Admin timeline RPC `get_case_timeline` ป้องกัน N+1 (M-D1) | P1 | P1 | db/perf | single RPC `get_case_timeline(p_complaint_id)` `jsonb_agg` ทุก relation ใน transaction เดียว; integration test นับ query count ≤3 per page | RPC ทำงาน; query count ≤3; ไม่มี N+1 | P1-02 | M |
| P1-09 | Realtime throttle + poll list 30s (M-P2) | P1 | P1 | perf | presence throttle + filter server-side `org_id`; หน้า list ใช้ poll 30s แทน Realtime; Realtime เฉพาะหน้ารายละเอียด 1 เรื่อง | throttle ทำงาน; list poll 30s; Realtime เฉพาะ detail; INP <200ms | P1-02 | M |
| P1-10 | Web Vitals RUM `web-vitals` v4 → `/api/rum` (M-P8) | P1 | P1 | perf | ฝัง `web-vitals` v4 (`onLCP/onINP/onCLS`) → `/api/rum` → audit_log aggregate | RUM ส่งข้อมูล; audit aggregate ทำงาน; dashboard มี | P1-01 | S |
| P1-11 | Image optimization strategy (M-P1) | P1 | P1 | perf | Vercel Image Optimization + `next/image` preview, explicit `width/height` กัน CLS, AVIF/WebP fallback, `loading="lazy"` below-fold, max 1600px, generate derivative ผ่าน Supabase Edge Fn | ใช้ `next/image`; CLS <0.1; AVIF/WebP; explicit dimension; lazy below-fold | P1-01 | M |
| P1-12 | Cache taxonomy/address write-through invalidate (M-P5) | P1 | P1 | perf | cache key version + bust ทุกครั้ง mutation taxonomy/address (write-through invalidate); TTL 6 ชม. safety net; บันทึก taxonomy version ใน `audit_log` | write-through ทำงาน; TTL 6 ชม.; version บันทึก; ไม่ stale | P0-20 | S |
| P1-13 | Go/No-Go gate P1 → Go-live | P1 | P0 | infra | Vercel Pro + Supabase Pro; CWV ผ่าน (LCP <2.5s, INP <200ms, CLS <0.1); KPI baseline (ปิดเรื่อง ≤30 วัน, %ติดตาม ≥95%, รายงานออกทันเดือน 100%); a11y DoD ผ่าน | gate ผ่านครบ; CWV ผ่าน; KPI วัดได้; a11y DoD ผ่าน | P1-01..P1-12 | S |

---

## P2 — Growth

| ID | ชื่อ | Milestone | Priority | ประเภท | คำอธิบาย | Acceptance Criteria | Dependency | Estimate |
|---|---|---|---|---|---|---|---|---|
| P2-01 | LINE LIFF OAuth bridge → Supabase Auth | P2 | P1 | feat | `src/app/api/webhooks/line/route.ts` LINE LIFF OAuth bridge → Supabase Auth | LIFF login ทำงาน; bridge ไป Supabase Auth; RLS ใช้ line uid | P1-13 | L |
| P2-02 | Live Chat + Telegram | P2 | P1 | feat | `src/modules/live-chat/*` Live Chat + Telegram integration | live chat ทำงาน; Telegram ส่งได้; audit บันทึก | P1-13 | L |
| P2-03 | จองคิวนัดช่าง | P2 | P1 | feat | `src/app/(public)/queue/page.tsx` จองคิวนัดช่าง | จองคิวทำงาน; calendar slot; แจ้งเตือน | P1-13 | M |
| P2-04 | a11y ผู้สูงอายุเพิ่มเติม (M-A1, M-A2, M-A3) | P2 | P1 | a11y | `prefers-reduced-motion` ตรวจก่อน (SC 2.3.3); draft เก็บเฉพาะ non-PII ใน `localStorage`; auto-fill จาก server หลัง OTP; `aria-describedby` + `role="alert"` ทุก input; error pattern ใน Storybook | reduced-motion ตรวจ; ไม่เก็บ PII ใน client; error pattern ทำงาน; ผ่าน axe | P1-13 | M |
| P2-05 | PMQA reporting | P2 | P2 | feat | PMQA reporting integration | PMQA report ออก; ฟอร์แมตตามมาตรฐาน | P1-13 | M |
| P2-06 | Honeypot anti-spam (L-S1) | P2 | P2 | sec | invisible honeypot field `website_url` (hidden + `tabindex=-1` + `aria-hidden`) + reject if filled OR submit < 2 วินาที; ไม่ใช้ reCAPTCHA หนัก | honeypot ทำงาน; บล็อก bot; ไม่กระทบ a11y | P1-01 | S |

---

## P3 — Scale

| ID | ชื่อ | Milestone | Priority | ประเภท | คำอธิบาย | Acceptance Criteria | Dependency | Estimate |
|---|---|---|---|---|---|---|---|---|
| P3-01 | Field App offline (PWA) + sync conflict resolution | P3 | P1 | feat | `src/app/(field)/` PWA offline + sync conflict resolution | offline ทำงาน; sync resolve; ไม่ conflict ข้อมูล | P1-13 | XL |
| P3-02 | AI classification | P3 | P2 | feat | `src/modules/ai-classification/*` AI classification + suggest taxonomy | AI suggest ทำงาน; accuracy ≥80%; human review ก่อน accept | P1-01 | XL |
| P3-03 | e-Sign | P3 | P2 | feat | `src/modules/e-sign/*` e-Signature | e-sign ทำงาน; audit บันทึก; legal compliance | P1-01 | L |
| P3-04 | Multi-tenant shared schema + `org_id` + RLS | P3 | P1 | arch | `org_id` + shared schema + RLS (ออกแบบตั้งแต่ P0 — เพิ่ม tenant isolation); `SET LOCAL app.org_id` service-role + RLS `current_setting('app.org_id')` | tenant isolation ทำงาน; cross-tenant ไม่รั่ว; audit ตรวจ | P0-01 | L |
| P3-05 | DR: backup + read replica + CQRS event sourcing | P3 | P2 | infra | DR: backup + read replica + CQRS event sourcing | backup ทำงาน; RPO/RTO ตาม target; event sourcing ใช้งาน | P1-13 | XL |
| P3-06 | `audit_log` archive cold tier via pg_partman (L-P2) | P3 | P2 | db | partition by `at` monthly ผ่าน Supabase pg_partman; archive ปีเก่าไป storage cold tier | pg_partman ทำงาน; archive ปีเก่า; query ยังเร็ว | P0-06 | M |

---

## สรุปสถิติ

- **จำนวน issue ทั้งหมด:** 60
- **จำนวนต่อ Milestone:**
  - M0 (Design system + Storybook): 17
  - P0 (Foundation): 31
  - P0.5 (Dry-run & Training): 5
  - P1 (MVP Core): 13
  - P2 (Growth): 6
  - P3 (Scale): 6
  (รวม gate issues รวมในแต่ละ milestone)
- **จำนวน CRITICAL (จาก reviews):** 6 ข้อ → แปลงเป็น issue P0 priority:
  - C1 → P0-09 (audit_log append-only REVOKE + trigger + partition)
  - C2 → P0-13 (CID keyed HMAC + `CID_HMAC_KEY`)
  - C3 → P0-19 (service-role route registry + lint rule)
  - C4 → P0-02 (complainant CHECK mutual exclusion)
  - C5 → P0-10 (audit_log jsonb strip PII + field-level masking)
  - C6 → M0-03 (touch target 44px token + ESLint enforcement)
- **จำนวน HIGH (จาก reviews):** 15 ข้อ → แปลงเป็น issue P0/P1 priority (ดู H1-H14 ใน reviews.md แมปใน backlog)
- **จำนวน MEDIUM (จาก reviews):** 27 ข้อ → แปลงเป็น issue P1/P2 priority (ดู M-* ใน reviews.md)
- **จำนวน LOW (จาก reviews):** 12 ข้อ → แปลงเป็น issue P2/P3 priority (ดู L-* ใน reviews.md)

## Gate บังคับ (ตาม PRP-Plan §8 + reviews §3.3)

1. **M0 → P0** (M0-17): axe 0 critical ทุก story; tokens light/dark; `.gitignore` ครอบ `secrets\`/`.claude`; visual regression baseline; touch target 44px + contrast + keyboard + MapPicker.a11y
2. **P0 → P0.5** (P0-31): RLS + MFA + audit append-only; CID encrypt + mask; consent flow; งบ กก.ทร. validation; CI green; policy test per role ผ่าน staging (R-PL-2)
3. **P0.5 → P1** (P05-05): ข้อมูล 8 รายการครบ + dedup; อบรม + ทดสอบผู้ใช้จริงผ่าน; ภาษาอีสาน iterate ≥1 รอบ
4. **P1 → Go-live** (P1-13): Vercel/Supabase Pro; CWV ผ่าน; KPI baseline; a11y DoD ผ่าน; CSV export ทำงาน

## หมายเหตุ

- ทุก issue ที่มี priority P0 บล็อก gate ของ milestone นั้น ต้องทำก่อนผ่าน gate
- issue ที่มาจาก reviews ระบุ source finding ID ในวงเล็บ (เช่น C1, H1, M-A1) เพื่อสืบได้
- Estimate เป็น guideline การวางแผน ไม่ใช่ binding
- ลำดับการทำตาม DAG ใน PRP-Plan §2.5 — ห้ามข้าม dependency