# Reviews — อบต.หัวงัว (ระบบรับเรื่องร้องเรียก/ร้องทุกข์)

> Planning artifact — รวม verdicts จาก 5 reviewer (security, code/architecture, database, a11y, perf) สำหรับ `PRD.md` + `PRP-Plan.md` อิง `context-package.md` เป็น source of truth. HARD-GATE: ไม่มีโค้ด/scaffold — เป็น planning artifact เท่านั้น.
> วันที่สร้าง: 2026-06-28

## 1. สรุป Verdicts

| Reviewer | ขอบเขตตรวจ | Verdict | #CRITICAL | #HIGH | #MEDIUM | #LOW | หมายเหตุ |
|---|---|---|---|---|---|---|---|
| Security | PDPA 2562 / RLS / Auth-MFA / secret / CID / OWASP / rate-limit / audit / consent | **WARN** | 3 | 4 | 7 | 2 | 4 CRITICAL + 5 HIGH ต้องแก้ก่อน P0 → P0.5 go/no-go |
| Code / Architecture | data flow consistency / folder structure / dependency direction / DAG | **APPROVE** | 0 | 0 | 4 | 3 | ไม่มี blocker; MEDIUM เป็นความสอดคล้อง/ความชัดเจน |
| Database | schema constraint / RLS / bitemporal / audit append-only / partition / migration | **WARN** | 2 | 3 | 4 | 3 | 2 CRITICAL + 3 HIGH ต้องแก้ใน migration `0001`/`0003`/`0004` ก่อน P0.1 merge |
| Accessibility (a11y) | WCAG 2.2 AA / touch target / contrast / อีสาน i18n / คีย์บอร์ด/SR / reduced motion | **WARN** | 1 | 4 | 5 | 2 | 1 CRITICAL (enforcement token 44px) + 4 HIGH ต้องเพิ่ม test/spec ใน M0/PRP ก่อนอนุมัติ design |
| Performance | CWV / bundle / cold start / N+1 / cache / image-font / Supabase query | **WARN** | 0 | 4 | 7 | 2 | 4 HIGH กระทบ LCP/INP บนผู้สูงอายุมือถือเน็ตช้า ต้องแก้ก่อน P0 freeze |
| **รวม** | | **WARN** | **6** | **15** | **27** | **12** | อนุมัติเป็น planning artifact ได้ภายใต้เงื่อนไขแก้ CRITICAL/HIGH ก่อน scaffold |

**Overall recommendation: WARN (conditional approve)** — ไม่ BLOCK เพราะเป็น planning artifact ยังไม่มี code แต่มี 6 CRITICAL + 15 HIGH ที่ต้องแก้ใน PRP-Plan รุ่นถัดไป + migration `0001`/`0003`/`0004` ก่อน P0.1 merge มิฉะนั้นจะกลายเป็น debt ที่แพงมากหลัง migration เกิด (ตอบโจทย์ R-PL-2 CRITICAL gate).

---

## 2. Findings เรียงตาม Severity

### CRITICAL (6 ข้อ — ต้องแก้ก่อน scaffold/P0.1 merge)

#### C1 — `audit_log` ไม่มี UPDATE/DELETE policy กัน service_role/owner bypass
- **Reviewer**: Security (CRITICAL) + Database (HIGH, escalate เป็น CRITICAL เพราะซ้ำซ้อน)
- **ที่**: PRD 6.3 / 8.8 / PRP-Plan 3.2
- **ปัญหา**: RLS deny UPDATE/DELETE เพียงอย่างเดียวไม่กัน `service_role` (bypass RLS) และ table owner — ใครได้ service role key ลบ/แก้ audit ได้ ทำลาย PDPA R3 + กฎหมายราชการเก็บ audit 10 ปี
- **ข้อแก้ concrete**:
  1. `0003_audit_append_only.sql`: `REVOKE UPDATE, DELETE ON audit_log FROM authenticated, anon, service_role` เก็บเฉพาะ `INSERT, SELECT`
  2. trigger `BEFORE UPDATE OR DELETE ON audit_log RAISE EXCEPTION` ดับเบิ้ลเลย
  3. พิจารณา range-partition รายเดือน/ปี ตาม retention 10 ปี (PRD 6.5) เพื่อ prune ได้
  4. migration role แยกจาก service_role เฉพาะสำหรับ schema migration

#### C2 — CID hash ใช้ plain SHA-256 → rainbow table + cross-DB correlation ละเมิด PDPA data minimization
- **Reviewer**: Security (CRITICAL)
- **ที่**: PRD 8.2 / 8.4 / PRP P0.7
- **ปัญหา**: ระบุ "hash index สำหรับค้น" แต่ไม่ระบุ hash algorithm; plain SHA-256 deterministic ทำให้เปรียบเทียบข้าม DB และ rainbow table ได้
- **ข้อแก้ concrete**:
  1. ใช้ keyed HMAC: `pgcrypto hmac(cid, pgp_sym_decrypt(secret_key), 'sha256')` เก็บในคอลัมน์ `cid_hmac`
  2. key แยกจาก `SUPABASE_SERVICE_ROLE_KEY` ใน env: `CID_HMAC_KEY` (Sensitive)
  3. ห้ามใช้ deterministic hash ลำดับ
  4. เพิ่ม `secret validation` ตรวจ `CID_HMAC_KEY` ≥ 32 char ใน `scripts/verify-env.ts`

#### C3 — `sysadmin` bypass RLS + service_role ใช้ใน Edge Fn/cron โดยไม่มี allow-list
- **Reviewer**: Security (CRITICAL)
- **ที่**: PRD 4.3 / 8.4 / PRP 3.4
- **ปัญหา**: ไม่มี allow-list route ที่ขอบเขตใช้ service_role; R-PL-8 ระบุไว้แต่ไม่มี enforcement mechanism
- **ข้อแก้ concrete**:
  1. service-role route registry: ระบุชื่อ route/Edge Fn ที่อนุญาต (`/api/cron/*` เท่านั้น)
  2. ตรวจ `process.env.SUPABASE_SERVICE_ROLE_KEY` เฉพาะในไฟล์ที่อยู่ใน registry
  3. lint rule บล็อก import ใน `(public)` route group
  4. บังคับทุก service-role call ส่ง audit row

#### C4 — `complainant` polymorphic ไม่มี CHECK constraint บังคับ mutual exclusion
- **Reviewer**: Database (CRITICAL)
- **ที่**: PRD 6.1 `complainant`
- **ปัญหา**: มีเพียง `person_id NULL` / `agency_id NULL` ไม่มี CHECK → ใส่ทั้งสองคอลัมน์หรือทั้งสอง NULL ได้ ทำลาย referential integrity ของ citizen vs agency (รายการ 344 อำเภอยางตลาด vs นายวิชิต)
- **ข้อแก้ concrete**:
  1. ใน `0001_init_schema.sql` เพิ่ม:
     ```sql
     CHECK ((party_type='citizen' AND person_id IS NOT NULL AND agency_id IS NULL)
        OR  (party_type='agency'  AND agency_id IS NOT NULL AND person_id IS NULL))
     ```
  2. เพิ่ม index `complainant(person_id) WHERE party_type='citizen'`

#### C5 — `audit_log.before/after` jsonb จับ `person.cid` plaintext → ทำลาย encrypted-at-rest + PDPA R3
- **Reviewer**: Database (CRITICAL) + Security (MEDIUM, escalate เป็น CRITICAL เพราะซ้ำ)
- **ที่**: PRD 8.8 `audit_log` + 8.2 CID
- **ปัญหา**: trigger อาจจับ `person.cid` plaintext ลง jsonb แม้จะ mask ใน UI/log แล้ว → log มี PII ละเอียดอ่อนเท่าตารางหลัก
- **ข้อแก้ concrete**:
  1. สร้าง trigger function ที่ strip คอลัมน์ `cid`/PII ออกจาก jsonb payload ก่อน insert `audit_log`
  2. บังคับ field-level masking ก่อน INSERT: CID → masked, phone → last 4, address → village-level
  3. ทดสอบ integration: insert complaint แล้วตรวจ `audit_log.after` ต้องไม่มี CID
  4. column-level RLS บน `before/after` เช่นกัน

#### C6 — Touch target ≥44px ไม่ประกาศเป็น design token ที่ enforce ผ่าน Tailwind config
- **Reviewer**: a11y (CRITICAL)
- **ที่**: PRD 7.2 / PRP 2.1
- **ปัญหา**: ระบุ "≥44×44 CSS px" แต่ไม่มี token/lint บังคับ → developer ใช้ค่าต่างกันทุก component
- **ข้อแก้ concrete**:
  1. เพิ่ม token `--touch-target-min: 44px` และ `--touch-target-gap: 8px` ใน `styles/tokens.css`
  2. ESLint rule (หรือ Storybook addon) block `<button>`/`<a>` ที่ `min-width/min-height < 44px`
  3. Go/No-Go gate M0: ทุก Radix primitive story ต้องผ่าน `axe` + rule นี้

---

### HIGH (15 ข้อ — ต้องแก้ก่อน P0 freeze / ก่อนอนุมัติ design)

#### H1 — Consent flow มี record แต่ไม่มี withdrawal mechanism (PDPA ม.19)
- **Reviewer**: Security (HIGH)
- **ที่**: PRD 8.3 / PRP P0.5
- **ข้อแก้**: เพิ่ม `consent` table (version, scope, granted_at, withdrawn_at) + endpoint `/api/consent/withdraw` trigger pseudonymize pipeline + บันทึก `audit_log.action='consent_withdrawn'` + แจ้ง citizen ทางช่องทางที่ยินยอม

#### H2 — Realtime `case_events` channel default broadcast ไม่ผ่าน RLS
- **Reviewer**: Security (HIGH)
- **ที่**: PRP 3.2 / PRD 5.3
- **ข้อแก้**: เปิด Realtime Authorization ผูกกับ RLS policy ของ `complaint` + ใช้ `postgres_changes` filter `org_id`/`created_by` แทน `broadcast` + payload ฝั่ง server sanitize ก่อน push (ห้ามส่ง CID/name ใน event)

#### H3 — Citizen identity ใน P1 ไม่ชัดเจน (RLS พังถ้า citizen ไม่มี auth)
- **Reviewer**: Security (HIGH)
- **ที่**: PRP P1 / PRD 8.4
- **ข้อแก้**: กำหนด citizen auth ใน P1: email magic link / phone OTP ผ่าน Supabase Auth (ใช้ SMS provider ที่เลือกใน P1) หรือใช้ signed tracking token ผูกกับ `book_no` — ห้ามปล่อย anonymous intake

#### H4 — CSV export มี watermark + audit แต่ไม่มี DPIA / การคุ้มกันไฟล์
- **Reviewer**: Security (HIGH)
- **ที่**: PRP P1 / PRD 8.8
- **ข้อแก้**: (a) export route ใช้ one-time signed URL หมดอายุ 5 นาที จาก Vercel Blob/Supabase Storage private; (b) บังคับ MFA ก่อนโหลด; (c) ไฟล์เข้ารหัส AES-256 at rest; (d) บันทึก DPIA ใน `docs/dpia-export.md`

#### H5 — Bitemporal `agency`/`person_tenure` ไม่มี EXCLUDE constraint กันช่วงเวลาทับซ้อน
- **Reviewer**: Database (HIGH)
- **ที่**: PRD 6.1
- **ข้อแก้**: `EXCLUDE USING gist (person_id WITH =, tstzrange(valid_from, valid_to, '[]') WITH &&)` + `CHECK ((valid_to IS NULL) = is_current)` + partial index `WHERE valid_to IS NULL`

#### H6 — Citizen RLS policy `complaint.created_by = auth.uid()` ไม่ครอบ intake ส่งต่อแทน citizen
- **Reviewer**: Database (HIGH)
- **ที่**: PRD 6.3
- **ข้อแก้**: เปลี่ยน citizen policy เป็น EXISTS-subquery: `EXISTS (SELECT 1 FROM complainant c WHERE c.complaint_id = complaint.id AND c.party_type='citizen' AND c.person_id = auth.uid())` + index `complainant(person_id) WHERE party_type='citizen'`

#### H7 — Edge Runtime ใช้ pg protocol ไม่ได้ ต้องใช้ PostgREST เท่านั้น
- **Reviewer**: perf (HIGH)
- **ที่**: PRD 5.6 / PRP-Plan 3.4
- **ข้อแก้**: ระบุชัดใน PRP-Plan §3.4 ว่า Edge route ใช้ Supabase REST/PostgREST เท่านั้น (`@supabase/postgrest-js` หรือ fetch) ไม่ใช่ pg protocol; intake INSERT ที่ต้อง transaction+RLS cookie ใช้ Node.js Runtime

#### H8 — Dedup `book_no + fiscal_year` ด้วย Redis ไม่มี fallback เมื่อ Upstash 10,000 cmd/day หมด
- **Reviewer**: perf (HIGH)
- **ที่**: PRP-Plan 3.3 / PRD 5.4
- **ข้อแก้**: fallback path: dedup ด้วย DB UNIQUE constraint + `ON CONFLICT DO NOTHING` เป็น source-of-truth; Redis เป็น cache ล้วน หาก miss ให้ query DB แต่ cache negative result 6 ชม.

#### H9 — Admin queue/reports ใช้ index `(org_id, status)` แต่ query จริงใช้ `category_id, received_at DESC` → full-scan 500MB
- **Reviewer**: perf (HIGH)
- **ที่**: PRD 5.6 / PRP-Plan 3.2
- **ข้อแก้**: เพิ่ม composite index `(received_at DESC, org_id)` สำหรับ timeline admin + covering index `(org_id, status, received_at DESC) INCLUDE (book_no, category_id)`; รายงานเดือน/ไตรมาสใช้ materialized view refresh ผ่าน QStash ไม่ใช่ live query

#### H10 — ฟอนต์ Sarabun/Noto Sans Thai โหลด full family → LCP > 2.5s บนมือถือผู้สูงอายุเน็ตช้า
- **Reviewer**: perf (HIGH)
- **ที่**: PRD 7.2 / PRP-Plan M0
- **ข้อแก้**: subset ฟอนต์ไทยเฉพาะ weight ที่ใช้ (400/600), `font-display: swap` + preload 1 weight ต่อ family, ใช้ `next/font/local` subset woff2; ห้ามโหลด Google Fonts CDN (render-block)

#### H11 — คีย์บอร์ด suite เป็น manual อาจพลาด regression
- **Reviewer**: a11y (HIGH)
- **ที่**: PRD 7.4 / PRP 6
- **ข้อแก้**: เพิ่ม Playwright keyboard suite `keyboard-traverse.spec.ts` ครอบ flow ยื่นเรื่อง + ติดตาม + admin modal (Tab/Shift+Tab/Esc/Enter) + visible-focus assertion (SC 2.4.11) + assert ไม่มี keyboard trap; ผูกเป็น CI gate เทียบเท่า `test:e2e`

#### H12 — อีสาน `th-northeast` ไม่ระบุ BCP-47 tag ที่ถูกต้อง → SR อ่านอีสานด้วยเสียงไทยกลาง
- **Reviewer**: a11y (HIGH)
- **ที่**: PRD 7.5 / 7.6
- **ข้อแก้**: กำหนด `lang="th-northeast"` หรือ custom subtag `x-northeast` ตาม BCP-47 + ตั้งค่า `--voice` ใน VoiceOver/NVDA test; เพิ่มใน DoD a11y ว่าต้องทดสอบ SR กับทั้งสอง namespace

#### H13 — สถานะ "ฉุกเฉิน" บอกว่าต้องมี text label คู่กับสี แต่ไม่ระบุ ARIA pattern ใน timeline Realtime
- **Reviewer**: a11y (HIGH)
- **ที่**: PRD 7.3 / 7.4
- **ข้อแก้**: badge ใช้ `<span role="img" aria-label="ฉุกเฉิน">🚨</span> ฉุกเฉิน` + ใน `aria-live="polite"` ของ timeline เพิ่ม text สถานะใน message payload (SC 1.4.1 + 4.1.3); เพิ่มโครง `CaseStatusBadge` ใน Storybook baseline

#### H14 — "ทางเลือกป้อนพิกัดเป็น text แทน drag" ไม่ได้กำหนดเป็น acceptance ของ map component ใน M0
- **Reviewer**: a11y (HIGH)
- **ที่**: PRD 7.4 / PRP 2.1
- **ข้อแก้**: สร้าง story `MapPicker.a11y` ที่บังคับ: มี `<input type="text" inputmode="numeric">` สำหรับพิกัด lat/lng + `aria-label` ภาษาไทย + คีย์บอร์ดสามารถตั้งจุดได้โดยไม่ต้อง drag (SC 2.5.7 Dragging Movements); gate M0 ต้องผ่านก่อน P1

#### H15 — `audit_log` REVOKE/trigger ซ้ำกับ C1 (รวมเป็นข้อเดียวกันที่ database review ยกเป็น HIGH แต่ security ยกเป็น CRITICAL — ถือว่าแก้ใน C1)

---

### MEDIUM (27 ข้อ — แกะใน P0.5 iterate ไม่บล็อกการอนุมัติ planning)

#### กลุ่ม Security (7)
- M-S1: rate-limit ไม่ครอบ `track/[caseNo]` → เพิ่ม rate-limit ≤ 20 req/นาทีต่อ IP + signed tracking token + ไม่ return note ภายในผ่าน track endpoint
- M-S2: `audit_log.before/after` เก็บ PII → บังคับ field-level masking ก่อน INSERT (รวมกับ C5)
- M-S3: QStash webhook signature verify ไม่ timing-safe + ไม่มี rotation SOP → บังคับ `crypto.timingSafeEqual`/`verifySignature` + rotation runbook ใน `docs/security-runbook.md` + ตรวจ `QSTASH_NEXT_SIGNING_KEY`
- M-S4: retention-sweep "pseudonymize" ไม่ครอบ `audit_log` PII → erasure request → pseudonymize live tables + redact PII fields ใน `audit_log` rows (เก็บ metadata actor/action/timestamp ตามกฎหมาย 10 ปี) + `cron/retention` ทำ redaction เป็น batch
- M-S5: ไม่มี CSP/security headers → เพิ่ม `next.config.ts` `headers()`: HSTS preload, `X-Frame-Options: DENY`, CSP nonce-based, `Permissions-Policy: camera=(),microphone=(),geolocation=()`
- M-S6: Storage `case-attachments` ไม่ระบุ MIME allow-list/size cap/ไวรัส scan → MIME allow-list (image/jpeg,png,webp,pdf), max 10 MB, ตรวจ magic byte ฝั่ง server, signed URL upload หมดอายุ 5 นาที, antivirus scan ฝั่ง Edge Function
- M-S7: secret validation ไม่ตรวจ shape/length → assert `SUPABASE_SERVICE_ROLE_KEY` decode เป็น JWT ที่มี `role: service_role`, `UPSTASH_REDIS_REST_TOKEN` ≥ 32 char, `QSTASH_*` ไม่ empty ทุก scope

#### กลุ่ม Code/Architecture (4)
- M-C1: async flow ไม่ตรงกัน (PRD 5.4 vs PRP 3.3) → เพิ่ม QStash topic `classify-assign` producer=Supabase DB webhook consumer=Edge Function `classify+assign`; ระบุ retry/dead-letter policy; อัปเดต §5.4 ให้สอดคล้อง
- M-C2: กลไก ping กัน auto-pause ซ้ำซ้อน (PRD 10.2 vs PRP 7.4) → เลือก Vercel Cron (Pro tier, ไม่กิน QStash quota) เป็นหลัก QStash เก็บสำหรับ SLA escalation เท่านั้น
- M-C3: `modules/*` ใช้ wildcard ไม่ enumerate ไฟล์ย่อย → แตก sub-files ต่อ module (`modules/cases/{intake-form.ts, timeline.ts, close-action.ts, repo.ts}`) ระบุไฟล์ละ responsibility + ขนาด 200–400 บรรทัด
- M-C4: ทิศทาง dependency `modules/cases` ↔ `modules/budget` ไม่ระบุ → กำหนดกฎ: `modules/budget` → `modules/cases` (budget อ้าง complaint) เท่านั้น; cases เรียก budget ผ่าน slot/composition หรือผ่าน service ใน `modules/budget/index.ts`

#### กลุ่ม Database (4)
- M-D1: admin timeline N+1 → ใช้ single RPC `get_case_timeline(p_complaint_id)` ที่ `jsonb_agg` ทุก relation ใน transaction เดียว; integration test นับ query count ≤ 3 per page
- M-D2: admin queue ไม่ระบุ pagination strategy → cursor pagination `WHERE (received_at, id) < ($last_received, $last_id) ORDER BY received_at DESC, id DESC LIMIT 50`; index `complaint(received_at DESC, id)` คู่กับ `complaint(status) WHERE deleted_at IS NULL`
- M-D3: `book_receipt.book_no` ดูเป็น int แต่ควรเป็น `text` (prefix/leading zero) → `book_no text NOT NULL` + UNIQUE `(book_no, fiscal_year)`; ห้ามใช้ `int`/`bigint`
- M-D4: migration rollback ใช้ `supabase db reset --to <ref>` destructive → กำหนด policy migration ทุกตัว: (1) add column nullable ก่อน, (2) backfill, (3) add NOT NULL/constraint, (4) รอ release, (5) drop old column release ถัดไป; RLS policy change deploy บน staging ก่อน พร้อม policy test per role (R-PL-2)
- M-D5: retention ไม่มี partition/pseudonymized_at flag → range-partition `complaint`/`audit_log` รายเดือนด้วย `received_at`; เพิ่ม `complaint.pseudonymized_at timestamptz` + `complainant.pseudonymized_at`; cron `retention-sweep` อัปเดต flag แทนลบ แล้ว audit ทุก action

#### กลุ่ม a11y (5)
- M-A1: "ลดการเคลื่อนไหวเปิดเป็นค่าเริ่มต้นสำหรับผู้สูงอายุ" ขัดหลัก prefers-reduced-motion → ตรวจ `matchMedia('(prefers-reduced-motion: reduce)')` ก่อน; โปรไฟล์ผู้สูงอายุคือ toggle เสริมที่ override เป็น reduce เมื่อผู้ใช้เลือก (SC 2.3.3) ไม่ใช่ default เงียบ
- M-A2: auto-fill ชื่อ/ที่อยู่ตอนติดตามไม่ระบุว่า draft ดึงจาก `localStorage` อย่างไรโดยไม่ขัด data minimization → draft เก็บเฉพาะ non-PII (หมวด, รายละเอียดสั้น) ใน `localStorage`; ชื่อ/ที่อยู่ auto-fill จาก `complainant` ที่ server หลัง auth ด้วย OTP — ไม่เก็บ CID/ที่อยู่เต็มใน client (SC 3.3.7 + PDPA 8.2)
- M-A3: ไม่ระบุ error announcement pattern สำหรับฟอร์ม multistep → ทุก `<input>` ใช้ `aria-describedby` → `<p id="err-{id}" role="alert">`; `aria-invalid="true"` เมื่อผิด; ข้อความ error มี icon + ประโยคแนะนำวิธีแก้; เพิ่มเป็น story ใน Storybook a11y baseline
- M-A4: `tokens.css` ไม่ประกาศ contrast token เป็น code → เพิ่ม script `scripts/check-contrast.ts` รันใน CI: อ่าน token ทุกคู่ text/surface + ตรวจ 4.5:1 (text) / 3:1 (UI/status) ผ่าน `wcag-contrast` lib; gate M0 ผ่านทั้ง light/dark
- M-A5: icon-only button มี aria-label ภาษาไทย แต่ไม่มี lint rule enforce → เพิ่ม ESLint rule `jsx-a11y/control-has-associated-label` + `aria-label` ต้องไม่เป็น empty ใน `components/ui/Button`; gate M0

#### กลุ่ม Performance (7)
- M-P1: ภาพแนบเรื่องไม่มี strategy image optimization ฝั่ง display → Vercel Image Optimization + `next/image` สำหรับ preview, explicit `width/height` กัน CLS, AVIF/WebP fallback, `loading="lazy"` below-fold, max dimension 1600px, upload เก็บ original + generate derivative ผ่าน Supabase Edge Fn
- M-P2: Realtime subscription `case_events` ใน `cases/[id]` INP risk → ใช้ presence throttle + filter server-side ตาม `org_id`; หน้า list ใช้ poll ทุก 30s แทน Realtime; Realtime เฉพาะหน้ารายละเอียด 1 เรื่อง
- M-P3: N+1 risk หน้า admin cases list → ใช้ PostgREST RPC `get_case_list(page)` server-side function คืน JSON รวม complainant/assignment/budget ใน query เดียว + RLS ใน SQL; หรือใช้ Supabase `select` embed (`complainant!inner,assignment:person,budget`) เป็น single round-trip
- M-P4: ISR สำหรับ taxonomy/address ฝั่ง serverless route จะ invalidate ทุก cold start → ใช้ ISR revalidate ระยะยาว (24h) + fallback จาก Upstash Redis (stale-while-revalidate); ห้ามพึ่ง ISR เดี่ยว ๆ สำหรับ taxonomy seed
- M-P5: Cache taxonomy/address ใน Redis ไม่ระบุ TTL/invalidation strategy → ระบุ cache key version + bust ทุกครั้ง mutation taxonomy/address (write-through invalidate); TTL 6 ชม. เป็น safety net; บันทึก taxonomy version ใน `audit_log`
- M-P6: Bundle budget ไม่มี mechanism บังคับใน CI → เพิ่ม CI gate: `@next/bundle-analyzer` + `bundlesize` config ใน PRP-Plan §7.1 step 8 หลัง e2e — fail PR ถ้า chunk ใดเกิน budget; route-level code splitting บน admin (lazy `reports` + `orgs` ผ่าน `next/dynamic`)
- M-P7: Edge cold start ~5ms เป็น claim ไม่จริง → ปรับ expectation: Edge cold start "P95 < 100ms" ไม่ใช่ 5ms; วัดจริงใน Lighthouse CI + Vercel Speed Insights

#### ขาดหายไป (perf)
- M-P8: Web Vitals monitoring ฝั่ง RUM ขาด → เพิ่มใน PRP-Plan P1 deliverable: ฝัง `web-vitals` v4 (`onLCP/onINP/onCLS`) → `/api/rum` → audit_log aggregate
- M-P9: Preconnect / DNS-prefetch ขาด → เพิ่มใน M0 tokens/layout: `<link rel="preconnect">` ไป Supabase domain
- M-P10: Critical CSS inline ขาด → inline critical CSS ใน `<style>` สำหรับ above-the-fold citizen form

---

### LOW (12 ข้อ — optional/ตามได้ใน iterate)

- L-S1: honeypot ไม่มี spec → invisible honeypot field `website_url` (hidden + `tabindex=-1` + `aria-hidden`) + reject if filled OR submit < 2 วินาที; ไม่ใช้ reCAPTCHA หนักตาม a11y
- L-S2: multi-tenant service_role ข้าม tenant ได้ → ใน P3 เพิ่ม `SET LOCAL app.org_id` ฝั่ง service-role query + RLS policy อ่าน `current_setting('app.org_id')` + ตรวจ cross-tenant query ใน audit
- L-C1: โครงโฟลเดอร์ใน PRD §5.2 ขาด `api/cron/*`, `src/middleware.ts`, `i18n/`, `lib/cid-checksum.ts`, `lib/budget-validation.ts` → เพิ่มรายการขาดใน PRD §5.2 หรือใส่หมายเหตุ "extended in PRP-Plan §3.1"
- L-C2: `P0.8(Redis) ◄── P0.4` เข้มงวดเกินไป → แยกเป็น `P0.8a(rate-limit+dedup) ◄── P0.3` และ `P0.8b(cache taxonomy) ◄── P0.4` เพื่อทำคู่ขนานได้
- L-C3: คำผิด "รองบประมาณ" → แก้เป็น "รอเบิกงบประมาณ" (PRD §4.2 line 109)
- L-D1: `ggor_code` index เดี่ยว ไม่พอสำหรับรายงานงบตามปีงบ → composite index `(fiscal_year, ggor_code) INCLUDE (amount, complaint_id)`
- L-D2: pgbouncer transaction mode ไม่รองรับ prepared statements → connection string เพิ่ม `?pgbouncer=true&prepare_threshold=0`; ตั้ง `statement_timeout=10s` + `idle_timeout=30s`; ห้ามใช้ pooler สำหรับ Edge Function cron (ใช้ direct connection ผ่าน service_role ฝั่ง Vercel Node runtime)
- L-D3: `taxonomy`/`address` global shared RLS → policy SELECT `USING (true)` + INSERT/UPDATE/DELETE `USING (auth.role() = 'service_role')`; สร้าง `org_id` index บนทุก tenant-scoped table ตั้งแต่ P0
- L-A1: ปุ่มใกล้ขอบจอเว้น inset ≥12px ไม่ map กับ `env(safe-area-inset-*)` → ระบุใช้ `padding: max(12px, env(safe-area-inset-*))` ใน token เพื่อรองรับ PWA P3 + iOS notch
- L-A2: Visual regression ไม่รวม dark mode + ซูม 200% → เพิ่ม dark mode variant และซูม 200% ใน visual regression matrix (320/768/1440 × {light,dark} × {100%,200%})
- L-P1: "compress ฝั่ง client" ไม่ระบุตัว compress และขนาด threshold → ใช้ `browser-image-compression` (lib) compress JPEG quality 0.7 max 1280px ก่อน upload; สำหรับผู้สูงอายุบนมือถือเย่น ปิด compress ได้ถ้าตรวจพบ device low-RAM
- L-P2: `audit_log` append-only โตเร็ว → เพิ่ม partition by `at` monthly ผ่าน Supabase pg_partman; archive ปีเก่าไป storage cold tier (P3) — ระบุตั้งแต่ P0 schema ป้องกัน refactor ภายหลัง

---

## 3. Action Items รวม (ต้องแก้ก่อน scaffold)

> เรียงตาม dependency: แก้ใน PRP-Plan รุ่นถัดไปก่อน → แก้ใน migration `0001`/`0003`/`0004` → gate P0.1 merge

### 3.1 แก้ใน PRP-Plan รุ่นถัดไป (planning artifact)

| # | Action | Severity | Reviewer | ไฟล์เป้าหมาย |
|---|---|---|---|---|
| A1 | เพิ่ม `consent` table + `/api/consent/withdraw` endpoint + pseudonymize pipeline + audit `consent_withdrawn` | HIGH (H1) | Security | PRP-Plan §3.2, P0.5 |
| A2 | เปิด Realtime Authorization ผูก RLS `complaint` + `postgres_changes` filter `org_id`/`created_by` + sanitize payload | HIGH (H2) | Security | PRP-Plan §3.2 |
| A3 | กำหนด citizen auth ใน P1 (email magic link / phone OTP / signed tracking token) ห้าม anonymous intake | HIGH (H3) | Security | PRP-Plan §4 P1 |
| A4 | CSV export: one-time signed URL หมดอายุ 5 นาที + MFA ก่อนโหลด + AES-256 at rest + DPIA `docs/dpia-export.md` | HIGH (H4) | Security | PRP-Plan P1 |
| A5 | service-role route registry (`/api/cron/*` เท่านั้น) + lint rule บล็อก import ใน `(public)` + บังคับ audit row | CRITICAL (C3) | Security | PRP-Plan §3.4 |
| A6 | ใช้ keyed HMAC สำหรับ CID (`cid_hmac` + `CID_HMAC_KEY` env Sensitive) ห้าม plain SHA-256 | CRITICAL (C2) | Security | PRP-Plan §3.2, P0.7 |
| A7 | เพิ่ม CSP/security headers ใน `next.config.ts` `headers()`: HSTS preload, `X-Frame-Options: DENY`, CSP nonce-based, `Permissions-Policy` | MEDIUM (M-S5) | Security | PRP-Plan §3.1 |
| A8 | QStash signature verify timing-safe + rotation runbook `docs/security-runbook.md` + ตรวจ `QSTASH_NEXT_SIGNING_KEY` | MEDIUM (M-S3) | Security | PRP-Plan §3.3 |
| A9 | retention-sweep redact PII fields ใน `audit_log` rows (เก็บ metadata ตามกฎหมาย 10 ปี) + `cron/retention` ทำ redaction เป็น batch | MEDIUM (M-S4) | Security | PRP-Plan P0 |
| A10 | Storage `case-attachments`: MIME allow-list + max 10 MB + magic byte check + signed URL upload หมดอายุ 5 นาที + antivirus scan | MEDIUM (M-S6) | Security | PRP-Plan §3.2 |
| A11 | `scripts/verify-env.ts` ตรวจ shape/length: `SUPABASE_SERVICE_ROLE_KEY` decode JWT `role: service_role`, `UPSTASH_REDIS_REST_TOKEN` ≥ 32 char, `CID_HMAC_KEY` ≥ 32 char, `QSTASH_*` ไม่ empty ทุก scope | MEDIUM (M-S7) | Security | PRP-Plan P0.2 |
| A12 | เพิ่ม QStash topic `classify-assign` producer=Supabase DB webhook consumer=Edge Function `classify+assign` + retry/dead-letter policy; อัปเดต PRD §5.4 ให้สอดคล้อง | MEDIUM (M-C1) | Code | PRP-Plan §3.3, PRD §5.4 |
| A13 | เลือก Vercel Cron (Pro tier) เป็นหลักสำหรับ ping กัน auto-pause QStash เก็บสำหรับ SLA escalation เท่านั้น; แก้ PRD §10.2 | MEDIUM (M-C2) | Code | PRP-Plan §7.4, PRD §10.2 |
| A14 | แตก sub-files ต่อ module (`modules/cases/{intake-form.ts, timeline.ts, close-action.ts, repo.ts}`) ระบุไฟล์ละ responsibility + ขนาด 200–400 บรรทัด | MEDIUM (M-C3) | Code | PRP-Plan §3.1, §4 P1 |
| A15 | กำหนดกฎ dependency: `modules/budget` → `modules/cases` เท่านั้น; cases เรียก budget ผ่าน slot/composition หรือผ่าน service ใน `modules/budget/index.ts` | MEDIUM (M-C4) | Code | PRP-Plan §3.1 |
| A16 | Edge route ใช้ Supabase REST/PostgREST เท่านั้น ไม่ใช่ pg protocol; intake INSERT ที่ต้อง transaction+RLS cookie ใช้ Node.js Runtime | HIGH (H7) | Perf | PRP-Plan §3.4 |
| A17 | Dedup `book_no + fiscal_year` fallback: DB UNIQUE constraint + `ON CONFLICT DO NOTHING` เป็น source-of-truth; Redis cache negative result 6 ชม. | HIGH (H8) | Perf | PRP-Plan §3.3 |
| A18 | เพิ่ม composite index `(received_at DESC, org_id)` + covering index `(org_id, status, received_at DESC) INCLUDE (book_no, category_id)`; รายงานเดือน/ไตรมาสใช้ materialized view refresh ผ่าน QStash | HIGH (H9) | Perf | PRP-Plan §3.2 |
| A19 | subset ฟอนต์ไทย weight 400/600 + `font-display: swap` + preload 1 weight ต่อ family + `next/font/local` subset woff2; ห้าม Google Fonts CDN | HIGH (H10) | Perf | PRP-Plan M0 |
| A20 | เพิ่ม Playwright keyboard suite `keyboard-traverse.spec.ts` + visible-focus assertion (SC 2.4.11) + ผูกเป็น CI gate | HIGH (H11) | a11y | PRP-Plan §6 |
| A21 | กำหนด BCP-47 `lang="th-northeast"` หรือ `x-northeast` + ทดสอบ SR กับทั้งสอง namespace เพิ่มใน DoD a11y | HIGH (H12) | a11y | PRP-Plan §6, PRD §7.5 |
| A22 | badge สถานะใช้ `<span role="img" aria-label="ฉุกเฉิน">🚨</span> ฉุกเฉิน` + `aria-live="polite"` timeline text สถานะใน payload (SC 1.4.1 + 4.1.3); เพิ่ม `CaseStatusBadge` ใน Storybook baseline | HIGH (H13) | a11y | PRP-Plan §6 |
| A23 | สร้าง story `MapPicker.a11y` บังคับ `<input type="text" inputmode="numeric">` พิกัด lat/lng + `aria-label` ไทย + คีย์บอร์ดตั้งจุดได้ (SC 2.5.7); gate M0 | HIGH (H14) | a11y | PRP-Plan M0 |
| A24 | เพิ่ม token `--touch-target-min: 44px` + `--touch-target-gap: 8px` ใน `styles/tokens.css` + ESLint rule block `<button>`/`<a>` ที่ `min-width/min-height < 44px`; gate M0 | CRITICAL (C6) | a11y | PRP-Plan §2.1, M0 |
| A25 | เพิ่ม script `scripts/check-contrast.ts` รันใน CI ตรวจ 4.5:1 (text) / 3:1 (UI/status) ผ่าน `wcag-contrast` lib; gate M0 ผ่านทั้ง light/dark | MEDIUM (M-A4) | a11y | PRP-Plan §6 |
| A26 | เพิ่ม ESLint rule `jsx-a11y/control-has-associated-label` + `aria-label` ต้องไม่เป็น empty ใน `components/ui/Button`; gate M0 | MEDIUM (M-A5) | a11y | PRP-Plan §6 |
| A27 | เพิ่ม CI gate: `@next/bundle-analyzer` + `bundlesize` config ใน PRP-Plan §7.1 step 8 หลัง e2e — fail PR ถ้า chunk เกิน budget; route-level code splitting บน admin | MEDIUM (M-P6) | Perf | PRP-Plan §7.1 |
| A28 | ฝัง `web-vitals` v4 → `/api/rum` → audit_log aggregate (P1 deliverable) | MEDIUM (M-P8) | Perf | PRP-Plan P1 |
| A29 | เพิ่ม `<link rel="preconnect">` ไป Supabase domain ใน M0 tokens/layout | MEDIUM (M-P9) | Perf | PRP-Plan M0 |
| A30 | inline critical CSS ใน `<style>` สำหรับ above-the-fold citizen form | MEDIUM (M-P10) | Perf | PRP-Plan M0 |

### 3.2 แก้ใน migration `0001`/`0003`/`0004` (schema)

| # | Action | Severity | Reviewer | ไฟล์ migration |
|---|---|---|---|---|
| M1 | `complainant` CHECK constraint mutual exclusion `party_type='citizen' → person_id NOT NULL AND agency_id NULL` (และกลับกัน) + index `complainant(person_id) WHERE party_type='citizen'` | CRITICAL (C4) | Database | `0001_init_schema.sql` |
| M2 | `audit_log` REVOKE UPDATE/DELETE จาก authenticated/anon/service_role + trigger `BEFORE UPDATE/DELETE RAISE EXCEPTION` + range-partition รายเดือน | CRITICAL (C1) | Security+Database | `0003_audit_append_only.sql` |
| M3 | trigger function strip `cid`/PII ออกจาก jsonb payload ก่อน insert `audit_log` + field-level masking (CID → masked, phone → last 4, address → village-level) + integration test ตรวจ `audit_log.after` ไม่มี CID | CRITICAL (C5) | Security+Database | `0003_audit_append_only.sql` |
| M4 | `agency`/`person_tenure` EXCLUDE constraint `gist (person_id WITH =, tstzrange(valid_from, valid_to, '[]') WITH &&)` + `CHECK ((valid_to IS NULL) = is_current)` + partial index `WHERE valid_to IS NULL` | HIGH (H5) | Database | `0001_init_schema.sql` |
| M5 | citizen RLS policy เปลี่ยนเป็น EXISTS-subquery `EXISTS (SELECT 1 FROM complainant c WHERE c.complaint_id = complaint.id AND c.party_type='citizen' AND c.person_id = auth.uid())` | HIGH (H6) | Database | `0004_rls_policies.sql` |
| M6 | `book_receipt.book_no text NOT NULL` + UNIQUE `(book_no, fiscal_year)` ห้ามใช้ `int`/`bigint` | MEDIUM (M-D3) | Database | `0001_init_schema.sql` |
| M7 | `complaint.pseudonymized_at timestamptz` + `complainant.pseudonymized_at` + range-partition `complaint`/`audit_log` รายเดือนด้วย `received_at` | MEDIUM (M-D5) | Database | `0001_init_schema.sql` + `0003_audit_append_only.sql` |
| M8 | `taxonomy`/`address` RLS: SELECT `USING (true)` + INSERT/UPDATE/DELETE `USING (auth.role() = 'service_role')` + `org_id` index บนทุก tenant-scoped table | LOW (L-D3) | Database | `0004_rls_policies.sql` |
| M9 | composite index `(fiscal_year, ggor_code) INCLUDE (amount, complaint_id)` + composite index `(received_at DESC, id)` คู่กับ `complaint(status) WHERE deleted_at IS NULL` + covering index `(org_id, status, received_at DESC) INCLUDE (book_no, category_id)` | LOW+MEDIUM (L-D1, H9, M-D2) | Database+Perf | `0001_init_schema.sql` |

### 3.3 Gate P0.1 merge (R-PL-2 CRITICAL)

ก่อน merge P0.1 ต้องผ่าน:
1. migration `0001`/`0003`/`0004` แก้ครบ M1–M9 + policy test per role ใน staging (R-PL-2)
2. PRP-Plan รุ่นถัดไปแก้ครบ A1–A30
3. `scripts/verify-env.ts` ตรวจ secret shape/length ครบ (A11)
4. Storybook M0 gate: ทุก Radix primitive story ผ่าน `axe` + touch target 44px + contrast token + keyboard suite (A20, A24, A25, A26)
5. CI gate: `@next/bundle-analyzer` + `bundlesize` + `check-contrast.ts` (A25, A27)

---

## 4. Recommendation รวม

### Overall: **WARN (conditional approve)**

- ไม่ BLOCK เพราะเป็น planning artifact ยังไม่มี code และเนื้อหา PRD ข้อ 7 ครอบ WCAG 2.2 AA ใหม่ครบ (2.4.11, 2.5.7, 2.5.8, 3.3.7, 3.3.8, 1.4.11, 1.4.4, 1.4.10) และสถาปัตย์ไม่มี CRITICAL blocker
- แต่มี **6 CRITICAL + 15 HIGH** ที่ต้องแก้ก่อน scaffold/P0.1 merge มิฉะนั้นจะกลายเป็น debt ที่แพงมากหลัง migration เกิด (ตอบโจทย์ R-PL-2 CRITICAL gate)

### เส้นทางที่อนุมัติได้ (approval path)

1. **แก้ 6 CRITICAL ใน PRP-Plan รุ่นถัดไป + migration `0001`/`0003`/`0004`**:
   - C1: `audit_log` append-only REVOKE + trigger + partition
   - C2: CID keyed HMAC (`cid_hmac` + `CID_HMAC_KEY`)
   - C3: service-role route registry + lint rule
   - C4: `complainant` CHECK constraint mutual exclusion
   - C5: `audit_log` jsonb strip PII + field-level masking
   - C6: touch target 44px token + ESLint rule
2. **แก้ 15 HIGH ใน PRP-Plan/M0 + migration**:
   - consent withdrawal + DPIA export + Realtime authorization (Security)
   - bitemporal EXCLUDE + citizen RLS EXISTS-subquery (Database)
   - Edge/PostgREST + dedup fallback + admin index + font loading (Perf)
   - keyboard suite + BCP-47 + status badge ARIA + map picker a11y (a11y)
3. **ผ่าน policy test per role ใน staging** (R-PL-2) ก่อน P0.1 merge
4. **Storybook M0 gate**: `axe` + touch target + contrast + keyboard + MapPicker.a11y

### หลังแก้ครบทั้ง 6 CRITICAL + 15 HIGH และผ่าน policy test per role ใน staging จึงอนุมัติเป็น **APPROVE**

### PDPA compliance gaps สรุป (ต้องเติมใน PRP-Plan)
1. consent withdrawal ขาด (H1)
2. erasure ไม่ครอบ audit_log PII (M-S4)
3. DPIA สำหรับ export ขาด (H4)
4. retention schedule ไม่แยกตามประเภทข้อมูล (งบ/เรื่อง/CID ควรต่างกัน) (M-D5)
5. data processing record (PDPA ม.41) ไม่ถูก document

---

## 5. ไฟล์อ้างอิง

- `D:\toppublic\per\docs\context-package.md` — source of truth (ต้นฉบับ .docx + stack decision + domain model + constraints + phasing)
- `D:\toppublic\per\docs\PRD.md` — ข้อ 4.2/4.3/5.2/5.3/5.4/5.6/6.1/6.3/6.5/7.2/7.3/7.4/7.5/7.6/8.2/8.3/8.4/8.7/8.8/9.1/9.2/9.5/9.6/10.2/11.3
- `D:\toppublic\per\docs\PRP-Plan.md` — ข้อ 2.1/2.2/2.3/2.5/3.1/3.2/3.3/3.4/4 P0/P1/6/7.1/7.3/7.4/7.5/7.6/9 R-PL-2/R-PL-8/R-PL-9