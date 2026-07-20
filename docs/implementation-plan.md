# Implementation Plan — ปิดวงจรระบบ อบต.หัวงัว ให้สมบูรณ์

> **เอกสารแผนปฏิบัติการ (execution plan)** — อนุมัติ 2026-07-20
> Source: audit จริงของ codebase + cross-check กับ `docs/PRD.md`, `docs/PRP-Plan.md`, `docs/tracking-issues.md`
> เป้าหมาย: ปิด gap ระหว่าง "ที่ออกแบบไว้" กับ "ที่ implement จริง" เพื่อให้ระบบทำงานได้ครบวงจร production

---

## 0. บริบทที่สำคัญ (สิ่งที่เปลี่ยนจาก PRD/PRP-Plan)

เอกสาร PRD/PRP-Plan เขียนไว้ 2026-06-28 บน stack **Supabase + 14 ตาราง + 5 role (citizen/intake/assignee/admin/sysadmin)** แต่ในระหว่างพัฒนามีการ migrate เป็น **plain PostgreSQL + Drizzle + Auth.js v5 + 8 ตาราง + 5 role (citizen/officer/chief/head/superadmin)** (เห็นได้ใน `.zcode/plans/` และ `project-log-md/opencode/handoff-supabase-to-authjs.md`) ทีมเลือก **ใช้ schema จริงเป็นหลัก** ดังนั้น "ครบตาม PRD" ในความหมายเดิมไม่ใช่เป้าหมายอีกต่อไป — เป้าคือ **ระบบทำงานได้ครบวงจรจริง**

### 0.1 สถานะปัจจุบัน (ตรวจ 2026-07-20)

**✅ ทำเสร็จแล้ว (จริง):**
- `/intake` + `POST /api/cases/submit` — rate-limit, dedup 7 วัน, CID checksum, PDPA consent, tracking code
- `/track` + `GET /api/cases/[id]` — lookup by trackingCode (HN+9), PII stripped, timeline
- `/admin/login` + Auth.js v5 — Credentials, dual rate-limit (per-IP + per-email), JWT 1h
- `/admin` (dashboard) — ดึงจาก DB จริง, SLA calc, re-check role ทุก request (defense in depth)
- Postgres schema + 2 migrations + seed (superadmin)
- 4 cron jobs: ping, cleanup-hashes, close-stale, stats-refresh

**❌ ยังเป็น UI เปล่า / ยังไม่ได้ทำ:**
- ปุ่ม CTA บน landing (`Navbar`, `Hero`, `CTA`) ชี้ anchor `#tracking` ที่ไม่มีอยู่จริง → **ประชาชนเข้าฟอร์มไม่ได้**
- Filter ใน `/admin` (status/category/search) — UI เท่านั้น (descoped comment)
- ปุ่ม action ใน `/admin` (assign/status/comment) — ไม่มีปุ่ม + ไม่มี PATCH API → **เจ้าหน้าที่ทำงานต่อไม่ได้**
- หน้า `/admin/cases/[id]`, `/admin/reports`, `/admin/users`, `/admin/audit` — ไม่มี
- Stats ใน landing — เลขปลอม (23/18/2847/94%) ไม่ได้ดึงจาก `case_stats_daily`
- `/privacy`, `/terms` — 404
- อัปโหลดไฟล์แนบ — ปิดไว้
- LINE Messaging API / LIFF / live chat — ไม่มี
- Notifications (email/SMS/push) — ไม่มีเลย
- zod, CSP, HSTS, CI workflow, DB backup, error monitoring — ไม่มี

### 0.2 การตัดสินใจที่ฝังไว้ในทุก PR

| # | หลักการ | เหตุผล |
|---|---|---|
| 1 | **ทุก admin action** ผ่าน `requireStaff()` helper (ใหม่ — extract จาก pattern ที่ duplicate 3 ที่) | ลดความซ้ำซ้อน, ป้องกัน gap |
| 2 | **ทุกการเปลี่ยนแปลงเคส** (a) update `cases.updated_at` ด้วยมือ (ไม่มี trigger), (b) insert `case_updates` row (ตารางมีอยู่แต่ไม่เคยถูกเขียน), (c) `logAudit(...)` | audit + timeline + PDPA |
| 3 | **State machine validation** อยู่ใน app layer | DB ไม่ enforce — `received→reviewing→assigned→in_progress→done→closed/rejected` |
| 4 | **Query style**: explicit `leftJoin` เท่านั้น | schema ไม่มี Drizzle `relations()` |
| 5 | **PDPA first** | PII ไม่เคย return ให้ public endpoint; ทุก env var ใหม่เพิ่มใน `verify-env.ts` |
| 6 | **ทุก PR**: `pnpm lint` + `typecheck` + `test` ผ่าน + เปิด PR (branch ใหม่ → commit → push → PR) | กระบวนการเดิม PR #5–#9 |

---

## PR #1 — 🔴 ปิดบล็อก UX: เชื่อมปุ่ม landing → ฟอร์ม + ซ่อม nav + Stats จริง

**Priority: blocker #1 · ไม่มี dependency · งานเล็ก ผลกระทบสูงสุด**

### สิ่งที่จะแก้

| ไฟล์:บรรทัด | เดิม | ใหม่ |
|---|---|---|
| `src/components/landing/Navbar.tsx:67` | `href="#tracking"` (ปุ่ม "แจ้งเหตุ") | `href="/intake"` |
| `src/components/landing/Navbar.tsx:49` | `href="#tracking"` (nav "ติดตามงาน") | `href="/track"` |
| `src/components/landing/Navbar.tsx:74` | mobile menu button ไม่มี handler | เพิ่ม `useState` + mobile drawer |
| `src/components/landing/Hero.tsx:157` | `href="#tracking"` (ปุ่ม primary) | `href="/intake"` |
| `src/components/landing/Hero.tsx:168` | `href="#tracking"` (ปุ่ม secondary) | `href="/track"` |
| `src/components/landing/CTA.tsx:39` | `href="#tracking"` | `href="/intake"` |
| `src/components/landing/Footer.tsx:38` | `href="#tracking"` | `href="/track"` |
| `src/components/landing/Stats.tsx` | เลขปลอม (23/18/2847/94%) | ดึงจาก `case_stats_daily` ล่าสุด (Server Component) |

### ไฟล์ใหม่
- `src/components/landing/mobile-menu.tsx` — client component สำหรับ mobile nav drawer

### เพิ่มเติม (SEO ขั้นต่ำ + analytics)
- `src/app/sitemap.ts` — sitemap.xml
- `src/app/robots.ts` — robots.txt
- `public/favicon.ico`, `public/icon.svg`, OG image
- `metadataBase` ใน `src/app/layout.tsx`
- dep `@vercel/analytics` + แทรก `<Analytics />` ใน layout

### เกณฑ์สำเร็จ
- คลิกปุ่ม "แจ้งเหตุ" ทุกจุดในหน้า landing → `/intake`
- คลิก "ติดตามงาน" ทุกจุด → `/track`
- Stats แสดงเลขจริง หรือ "—" ถ้ายังไม่มีข้อมูล (ไม่โกหก)
- มี sitemap, robots, favicon, OG

---

## PR #2 — 🔴 ปิดบล็อกเจ้าหน้าที่: Admin case detail + actions + PATCH API

**Priority: blocker #2 · ระบบไม่ปิดวงจรโดยไม่ทำ**

### งานหลัก

1. **Extract `requireStaff()` helper** → `src/lib/auth/require-staff.ts`
   - Signature: `requireStaff(allowedRoles?: UserRole[]): Promise<{ user, ipAddress, userAgent }>`
   - คืนค่าถ้าผ่าน, โยน redirect `/admin/login` ถ้าไม่ผ่าน
   - Extract pattern จาก `admin/page.tsx:91-116` + `admin/actions.ts:87-113`

2. **สร้าง `src/app/admin/layout.tsx`** — layout wrapper
   - เรียก `requireStaff()` ครั้งเดียวใน layout
   - แสดง `AdminHeader` (session-aware) + footer + nav tabs (Dashboard / Reports / Users / Audit)
   - ปรับ `admin/page.tsx` ให้ใช้ layout (ลบ SiteHeader/SiteFooter ออก)

3. **สร้าง `src/app/admin/cases/[id]/page.tsx`** — case detail
   - ดึงข้อมูลเคสเต็มรูปแบบ + timeline (`case_updates`) + submitter + assignee + department + category
   - Forms (useActionState pattern):
     - **เปลี่ยนสถานะ** (dropdown 7 states + validate transition)
     - **มอบหมายเจ้าหน้าที่** (dropdown ในหน่วยงานเดียวกัน + unassign)
     - **เปลี่ยนหน่วยงาน** (chief/head/superadmin เท่านั้น)
     - **เปลี่ยนความเร่งด่วน** (normal↔urgent)
     - **เพิ่มความคืบ** (comment + toggle สาธารณะ/ภายใน)

4. **สร้าง `src/lib/cases/state-machine.ts`** — transition validator
   - `ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]>`
   - `assertTransition(from, to): { ok, reason? }`

5. **สร้าง `src/app/admin/actions/cases.ts`** — server actions
   - `changeStatus`, `assignOfficer`, `changeDepartment`, `setPriority`, `addUpdate`
   - แต่ละอัน: `requireStaff()` → validate → `db.transaction` (update cases + insert case_updates + logAudit) → revalidate

6. **สร้าง `src/app/api/admin/cases/[id]/route.ts`** — PATCH API
   - แยกจาก citizen `/api/cases/[id]` (ใช้ trackingCode) — admin ใช้ UUID id + auth
   - Body: `{ status?, assignedTo?, departmentId?, priority? }`
   - `requireStaff()` + zod validate (optional — ใช้ใน PR #4 จริงจัง) + state machine + transaction + audit

7. **แก้ `admin/page.tsx`**
   - เพิ่มลิงก์จากแต่ละแถวเคสไป `/admin/cases/[id]`
   - ลบ dead import `departments`
   - ลบ comment "descoped" (จะไม่จริงอีกต่อไป)

### Migration
ไม่ต้อง — ใช้ตารางที่มี (`cases`, `case_updates`, `audit_logs`)

### ไฟล์ใหม่ (~10 ไฟล์)
- `src/lib/auth/require-staff.ts`
- `src/lib/cases/state-machine.ts` + `.test.ts`
- `src/app/admin/layout.tsx`
- `src/app/admin/cases/[id]/page.tsx`
- `src/app/admin/cases/[id]/case-detail-client.tsx`
- `src/app/admin/actions/cases.ts`
- `src/app/api/admin/cases/[id]/route.ts` + integration test
- `src/components/admin/case-action-form.tsx`

### เพิ่มเติม
- `.github/workflows/ci.yml` — lint + typecheck + unit test on PR

### เกณฑ์สำเร็จ
- เจ้าหน้าที่ login → คลิกเคส → เปลี่ยนสถานะ/มอบหมาย/เพิ่มความคืบได้
- ประชาชนเห็น timeline อัปเดตใน `/track`
- ทุก action มีใน `audit_logs` + `case_updates`
- CI ทำงานบน PR

---

## PR #3 — 🟡 Filter + Reports + User Management (admin completeness)

**Priority: medium · หลัง PR #2 · ใช้ requireStaff helper**

1. **Filter ที่ใช้ได้จริง** — แก้ `admin/page.tsx`
   - Query params: `?status=&category=&priority=&q=&assignee=&page=`
   - Thai→enum mapping (`'รับเรื่อง'` → `'received'`)
   - ILIKE search (title/location/trackingCode)
   - Pagination (limit 50)

2. **หน้า `/admin/reports/page.tsx`** — dashboard สรุป
   - ดึงจาก `case_stats_daily`
   - แยกตามหน่วยงาน/หมวด/สถานะ + SLA breach + avg resolution days
   - Simple bar chart (CSS/SVG inline ถ้าเป็นไปได้ ไม่เพิ่ม dep)

3. **หน้า `/admin/users/page.tsx`** — user management (superadmin/head เท่านั้น)
   - List users (role/department/isActive)
   - Create user (email + password + role + department) — ใช้ `hashPassword`
   - Toggle isActive, เปลี่ยน role/department
   - Reset password (superadmin เท่านั้น)
   - ทุก action → server action + audit

4. **หน้า `/admin/audit/page.tsx`** — ประวัติการกระทำ (ใช้ `getAuditLogs` ที่มี)

### เพิ่มเติม
- ใช้ `@axe-core/playwright` (มี dep อยู่แล้วแต่ไม่ได้ใช้) ใน e2e

### เกณฑ์สำเร็จ
- filter ใช้ได้จริง
- superadmin สร้าง/ระงับ account โดยไม่ต้องยุ่ง DB
- มีหน้ารายงาน KPI

---

## PR #4 — 🟡 PDPA + Privacy/Terms + Security hardening

**Priority: medium · อิสระ (ใช้ zod จาก #2 ถ้า merge แล้ว)**

1. **สร้าง `/privacy/page.tsx` + `/terms/page.tsx`** — แก้ 404 จาก Footer
   - เนื้อหา PDPA ภาษาไทย (ทำเครื่องหมาย "ต้องกฎหมายตรวจอีกครั้ง")

2. **Consent withdrawal endpoint** `src/app/api/consent/withdraw/route.ts`
   - POST: รับ trackingCode + CID → verify เป็นเจ้าของ → revoke consent
   - case ที่ถูก withdraw → ไม่แสดงใน track หรือ anonymized

3. **ติดตั้ง `zod`** + ปรับ validate ใน `submit/route.ts`, `cases/[id]/route.ts`, และใหม่ทุกที่
   - Length limits: title ≤200, description ≤5000, location ≤500

4. **CSP header** ใน `next.config.ts` + HSTS สำหรับ production
   - `default-src 'self'`, `connect-src 'self'`, `img-src 'self' data:`, `style-src 'self' 'unsafe-inline'`
   - `Strict-Transport-Security: max-age=63072000`

5. **DB backup script** `scripts/backup.sh` + `docs/BACKUP.md` (PDPA critical)

6. **Error monitoring** — Sentry free tier (dep `@sentry/nextjs`)

7. **Clean scratch dirs** (`_unp1/`, `_unp2/`, `dev.log`, `nb.log`, `data/huangua.db` artifact SQLite เก่า)

### เกณฑ์สำเร็จ
- ไม่มี 404
- consent withdrawal ทำงานได้
- ทุก input validated ด้วย zod
- CSP + HSTS active
- มี backup procedure

---

## PR #5 — 🟡 Notifications framework (email + abstraction สำหรับ LINE)

**Priority: medium · หลัง PR #2 (hook เข้า actions)**

### งานหลัก

1. **NotificationProvider abstraction** → `src/lib/notifications/provider.ts`
   ```ts
   interface NotificationProvider {
     name: string;
     send(to: Recipient, message: NotificationMessage): Promise<SendResult>;
   }
   ```

2. **Log provider** (default ไม่ต้อง dep) → development

3. **Email provider** ใช้ Resend (dep `resend`, `react-email`)
   - ยืนยันรับเรื่องให้ประชาชน (ถ้าใส่ email)
   - แจ้งเจ้าหน้าที่เคสใหม่ในหน่วยงาน
   - แจ้ง SLA breach ให้ supervisor

4. **LINE provider stub** → `src/lib/notifications/providers/line.ts`
   - Implement interface ด้วย mock (log + audit)
   - `LINE_PROVIDER_ENABLED=false` default

5. **Dispatcher** → `src/lib/notifications/dispatcher.ts`
   - `dispatchCaseEvent(event: CaseEvent)` — fan-out ไปยัง providers ที่ enabled + recipient อนุญาต
   - Events: `case_submitted`, `status_changed`, `sla_breach`, `message_received`

6. **Async queue** ใช้ Upstash QStash (dep `@upstash/qstash` — env vars มี document แล้ว แต่ SDK ไม่ได้ติดตั้ง)

7. **Hook เข้ากับ PR #2** — ทุก `changeStatus`/`assignOfficer`/`addUpdate` → dispatch event

### Env vars ใหม่
- `RESEND_API_KEY` (optional), `NOTIFICATION_FROM_EMAIL`
- `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`
- `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET` (optional, default false)
- อัปเดต `verify-env.ts`

### เกณฑ์สำเร็จ
- ประชาชนแจ้งเหตุ → ได้รับ email ยืนยัน (ถ้ากรอก)
- เจ้าหน้าที่ได้รับ email/ping เคสใหม่
- เปลี่ยนสถานะ → แจ้งประชาชน
- LINE provider stub พร้อมรองรับของจริงใน PR #7

---

## PR #6 — 🟢 Live chat (web admin panel) + real-time

**Priority: low-medium · หลัง PR #5 · งานใหญ่ที่สุด**

### ปัญหาเทคนิคที่แก้ในแผนนี้
- **Vercel free tier**: SSE lambda timeout 10s → **hybrid: SSE + auto-reconnect + REST polling fallback**
- **LISTEN/NOTIFY ใช้ไม่ได้บน Serverless** → **ใช้ Upstash Redis pub/sub** (มี dep แล้ว)

### งานหลัก

1. **Migration `drizzle/0002_*.sql`** — เพิ่มตาราง `case_messages`
   ```sql
   CREATE TABLE case_messages (
     id text PRIMARY KEY,
     created_at timestamp NOT NULL DEFAULT NOW(),
     case_id text NOT NULL REFERENCES cases(id),
     sender_id text NOT NULL REFERENCES users(id),
     sender_role user_role NOT NULL,
     body text NOT NULL,
     attachments jsonb,
     read_at timestamp,
     is_internal boolean NOT NULL DEFAULT false
   );
   CREATE INDEX case_messages_case_id_idx ON case_messages(case_id, created_at);
   ```

2. **API routes**
   - `GET/POST /api/admin/cases/[id]/messages` — admin auth
   - `GET/POST /api/cases/[id]/messages` — citizen by trackingCode+CID verify, PII-safe, rate-limited
   - `GET /api/chat/sse?channel=case:<id>` — SSE push (Upstash pub/sub)
   - `POST /api/chat/publish` — internal helper

3. **UI components**
   - `src/components/chat/chat-window.tsx`
   - `src/components/chat/chat-composer.tsx`
   - `src/components/chat/use-chat-stream.ts` — SSE + reconnect + polling fallback
   - เพิ่ม chat panel ใน `admin/cases/[id]/page.tsx`
   - เพิ่ม chat panel ใน track page (ถ้าเปิดให้ประชาชนคุย)

4. **Real-time strategy**
   - Officer ใน admin: SSE → `/api/chat/sse?channel=case:<id>` (reconnect ทุก 10s)
   - Server เมื่อเขียน message: publish ไป Upstash `chat:case:<id>`
   - SSE lambda: subscribe channel → stream จน timeout
   - Fallback: polling `/api/.../messages?since=<ts>` ทุก 5s ถ้า SSE fail

5. **Human handoff toggle** — เปลี่ยน channel จาก bot/auto ไป officer queue

### เกณฑ์สำเร็จ
- ประชาชนคุยกับเจ้าหน้าที่ real-time ใน track page
- เจ้าหน้าที่เห็นและตอบใน admin
- ข้อความ persist ใน DB
- ทำงานได้บน Vercel free tier ผ่าน SSE + polling hybrid

---

## PR #7 — 🟢 LINE Messaging API + LIFF integration (เสียบของจริง)

**Priority: low · หลัง PR #6 · ต้องรอคุณสมัคร LINE**

### งานหลัก

1. **LINE provider จริง** — replace stub ใน PR #5
   - fetch ตรงไป LINE Messaging API (ไม่เพิ่ม dep)
   - `sendPushMessage`, `sendReplyMessage`
   - รองรับ Flex Message / Template Message

2. **LIFF integration** → `/intake` และ `/track` รันใน LINE In-App Browser
   - `src/app/api/liff/[endpoint]/route.ts`
   - ปรับ intake form detect LIFF context + autofill profile
   - `src/components/liff/liff-provider.tsx` (LIFF v2 SDK ผ่าน CDN — ไม่ต้อง npm dep)

3. **LINE Login** (ทางเลือก) — OAuth provider ที่สามใน `src/auth.ts`
   - เชื่อม LINE userId → citizen account

4. **Webhook receiver** `src/app/api/webhooks/line/route.ts`
   - รับข้อความ/เหตุการณ์จาก LINE → dispatch ผ่าน chat system (PR #6)
   - Verify signature ด้วย `LINE_CHANNEL_SECRET` (HMAC-SHA256)
   - Map LINE userId → case → insert message

5. **คู่มือสมัคร LINE** → `docs/LINE-SETUP.md`

### เกณฑ์สำเร็จ
- เมื่อคุณสมัคร LINE + กรอก env vars 5 ตัว → LINE notification ทำงาน
- ประชาชนใช้ผ่าน LIFF ได้
- คุยผ่าน LINE ได้
- เจ้าหน้าที่ตอบในเว็บ admin ข้อความเด้งไป LINE ประชาชน

---

## ลำดับ Dependency

```
PR #1 (landing links + stats)  ──┐
                                  ├─→ PR #5 (notifications) ──→ PR #6 (chat) ──→ PR #7 (LINE real)
PR #2 (admin actions + PATCH)  ──┤
                                  │
PR #3 (filter/reports/users)  ───┘ (หลัง #2)

PR #4 (PDPA/security)  ──────────┘ (อิสระ แต่ใช้ zod จาก #2)
```

- **PR #1, #2** ทำได้พร้อมกัน (ไม่ dependent)
- **PR #3** ตามหลัง #2 (ใช้ requireStaff helper)
- **PR #4** อิสระ (แต่อาจทำพร้อม #2 เพื่อ zod)
- **PR #5** ตามหลัง #2 (hook เข้า actions)
- **PR #6** ตามหลัง #5 (ใช้ dispatcher)
- **PR #7** ตามหลัง #6 + ต้องรอคุณสมัคร LINE

---

## ขอบเขต session นี้

ผมจะเริ่มจาก **PR #1 และ PR #2** (สอง blocker หลักที่คุณรายงาน) เมื่อ merge แล้วค่อยทำ #3 → #4 → #5 → #6 ตามลำดับ PR #7 จะเตรียม code scaffolding ไว้ แต่ต้องรอคุณสมัคร LINE ถึงจะเสียบของจริงได้

## หลัง PR แต่ละอัน
- `pnpm lint` + `typecheck` + `test`
- เปิด branch ใหม่ + commit + push + เปิด PR
- รอคุณ review + merge ก่อนเริ่มอันถัดไป

---

## ภาคผนวก: สิ่งที่ผมแนะนำเพิ่ม (นอกเหนือจากที่คุณขอ)

| ข้อ | ระดับ | แทรกใน PR |
|---|---|---|
| **DB backup script** (`scripts/backup.sh` + `docs/BACKUP.md`) | 🔴 สำคัญมาก (PDPA) | PR #4 |
| **CI workflow** `.github/workflows/ci.yml` | 🟡 สำคัญ | PR #2 |
| **SEO ขั้นต่ำ** (sitemap, robots, favicon, OG, metadataBase) | 🟡 สำคัญ | PR #1 |
| **Vercel Analytics** (dep `@vercel/analytics`) | 🟢 เสริม | PR #1 |
| **ทดสอบหน้าเว็บด้วย axe-core** (มี dep อยู่แล้ว แต่ไม่ได้ใช้) | 🟢 เสริม | PR #3 |
| **Error monitoring** — Sentry free tier | 🟢 เสริม | PR #4 |
| **`force-dynamic` → ISR** ที่ไม่จำเป็น (`/intake` ใช้ categories ที่นานๆ เปลี่ยน) | 🟢 เสริม | PR #1 |
| **Clean scratch dirs** (`_unp1/`, `dev.log`, ฯลฯ) | 🟢 เสริม | PR #4 |

---

## ภาคผนวก: ข้อเท็จจริงเทคนิคที่ใช้อ้างอิง (recon)

- **Stack**: Next.js 16 + Drizzle 0.45 + Auth.js v5 beta + PostgreSQL (postgres-js) + Tailwind 4 + Radix UI + Upstash Redis (REST)
- **DB pool**: `max: 10` (postgres-js) — ไม่เหมาะกับ long-lived LISTEN
- **Session**: JWT 1h maxAge, httpOnly cookie (Auth.js default name), Credentials provider only
- **Session shape**: `{ user: { userId, role, email } }` — role snapshot ที่ login (re-check DB ทุก admin request)
- **No Drizzle `relations()`** — ต้องใช้ explicit `leftJoin` ทุก query
- **No PATCH/PUT** on cases — citizen `/api/cases/[id]` เป็น GET only
- **`case_updates` table** wired แต่ไม่เคยถูกเขียน (เขียนครั้งแรกโดย cron close-stale เท่านั้น)
- **No zod** — validation เป็น ad-hoc truthy checks
- **No CSP** — comment ใน next.config.ts บอก "จะเติมใน P1"
- **Vercel config**: region `sin1` only, no `functions.maxDuration` (10s SSE cap on free tier), no `crons` (ใช้ cron-job.org)
- **Env vars**: UPPER_SNAKE_CASE, verify ที่ build time ผ่าน `scripts/verify-env.ts`
- **ไม่มี admin layout** — แต่ละ admin page ต้องเรียก `auth()` + re-check เอง
- **Seed**: superadmin `admin@huangua.go.th` / `ChangeMe123!` (local dev only)
