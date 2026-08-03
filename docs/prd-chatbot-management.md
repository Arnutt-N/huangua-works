# PRD — Chatbot Management Suite (port จาก jsk-app)

> **เอกสารวางแผน (planning artifact)** — ไม่ใช่ code/scaffold · ทำตาม workflow ใน `AGENT.md` (§2 PRD → §3 PRP-Plan → §4 Review Gate)
> แหล่งอ้างอิง: บทวิเคราะห์ jsk-app ที่ `D:\topbliz\public\huangua-works\research\jsk-reviews\` (00-overview / 01-frontend-admin / 02-backend / 03-remediation-plan)
> Stack ปัจจุบันของ huangua-works: **Next.js 16 (App Router) + Drizzle ORM (postgres-js) + Auth.js v5 + Upstash Redis (REST) + SSE + Tailwind v4 + Radix UI** — ดู `docs/PRD.md` (หมายเหตุสถานะ: stack จริงเปลี่ยนจาก Supabase เป็น self-host Postgres แล้ว)

---

## 1. ภาพรวม / ปัญหา / บริบท

### 1.1 ที่มา
`jsk-app` (`D:\genAI\jsk-app`) คือระบบ LINE Official Account สำหรับ Community Justice Services ที่มี **ชุดเครื่องมือจัดการ chatbot ครบ** (broadcast, intent/auto-reply, reply-objects, rich-menu, file manager, settings, health) เราได้ศึกษาวิเคราะห์ทั้ง frontend (14 เมนู admin) และ backend (FastAPI) แล้ว

`huangua-works` (โปรเจกต์นี้) คือระบบรับเรื่องร้องทุกข์ อบต.หัวงัว ซึ่งมี **พื้นฐาน LINE chat ที่แข็งแรงอยู่แล้ว** (webhook + dedup, SSE real-time, live-chat agent console, canned responses, tags) แต่ **ขาดชุดเครื่องมือ "จัดการ chatbot"** — ปัจจุบัน bot brain ถูก hardcode ใน `src/lib/line/bot/engine.ts` และ rich menu เป็นแค่ CLI script

### 1.2 ปัญหาที่ต้องการแก้
| ปัญหา | สถานะปัจจุบันใน huangua | ผลกระทบ |
|---|---|---|
| Bot brain hardcoded | `engine.ts:routeBotMessage` if/else คงที่ (แจ้งเรื่อง/ติดตาม/handoff) | เพิ่ม/แก้ keyword ต้อง deploy code, เจ้าหน้าที่ทำเองไม่ได้ |
| ไม่มี FAQ management UI | ตาราง `chat_faq` + `faq-matcher.ts` มีแล้ว แต่ seed ผ่าน `scripts/seed-faq.ts` เท่านั้น | เจ้าหน้าที่แก้คำตอบ bot ไม่ได้ |
| ไม่มี broadcast | ไม่มี LINE broadcast/multicast client | แจ้งประกาศหาประชาชนทุกคนไม่ได้ |
| ไม่มี reply-object library | flex สร้าง inline ใน `messages/flex.ts` (3 builder hardcoded) | ใช้ซ้ำ flex/template ไม่ได้ |
| Rich menu เป็น CLI | `messages/rich-menu.ts` + `scripts/upload-rich-menu.ts` (manual) | เปลี่ยนเมนู LINE ต้องรัน script |
| ไม่มี settings UI | LINE token เป็น env-only; ตาราง `chat_settings` ว่างเปล่า (ไม่มีอะไรอ่าน/เขียน) | ปรับแต่ง bot runtime ไม่ได้ |
| ไม่มี file manager / image-resize | `cases.attachments` เป็น jsonb; ไม่มี media library | จัดการรูป/asset ส่วนกลางไม่ได้ |
| ไม่มี health check page | มีแค่ `api/cron/ping` | ผู้ดูแลไม่เห็นสถานะระบบใน UI |

### 1.3 ตาราง mapping ทั้ง 14 เมนู jsk-app → huangua
> ⚠️ หัวใจของ PRD นี้: **ไม่สร้างซ้ำสิ่งที่已有** — port เฉพาะช่องว่าง

| # | เมนู jsk-app | สถานะใน huangua | การตัดสินใจ |
|---|---|---|---|
| 1 | `/admin/chatbot` (overview) | ❌ ไม่มี | **PORT** — bot dashboard |
| 2 | `/admin/chat-histories` | ✅ มีแล้ว (`/admin/chat` + search + conversations) | **SKIP** (已有 ดีกว่า) |
| 3 | `/admin/chatbot/broadcast` | ❌ ไม่มี | **PORT** |
| 4 | `/admin/auto-replies` (intents) | 🟡 บางส่วน (`chat_faq` + matcher แต่ไม่มี UI, engine hardcoded) | **PORT + EXTEND** — FAQ UI + intent engine |
| 5 | `/admin/reply-objects` | ❌ ไม่มี | **PORT** |
| 6 | `/admin/canned-responses` | ✅ มีแล้ว (CRUD UI ใน chat composer) | **SKIP** (已有) |
| 7 | `/admin/rich-menus` | 🟡 บางส่วน (CLI script เท่านั้น) | **PORT** — ยกเป็น admin UI + DB |
| 8 | `/admin/users` | ✅ มีแล้ว (`/admin/users`) | **SKIP** (已有) |
| 9 | `/admin/files` | ❌ ไม่มี | **PORT** (ปรับเป็น Vercel Blob) |
| 10 | `/admin/image-resize` | ❌ ไม่มี (แต่มี `sharp` ใน deps) | **PORT** |
| 11 | `/admin/reports` | ✅ มีแล้ว (`/admin/reports` + `caseStatsDaily`) | **SKIP** (คนละ domain — cases ไม่ใช่ chat) |
| 12 | `/admin/audit` | ✅ มีแล้ว (`/admin/audit` + `auditLogs`) | **SKIP** (已有) |
| 13 | `/admin/health` | ❌ ไม่มี (มีแค่ cron ping) | **PORT** |
| 14 | `/admin/settings` | 🟡 บางส่วน (ตาราง `chat_settings` ว่าง) | **PORT** — เปิดใช้ chat_settings |

**สรุป:** port 8 เมนู (1,3,4,5,7,9,10,13) + settings (14) = **9 เมนูใหม่**, skip 5 เมนูที่已有 (2,6,8,11,12)

---

## 2. เป้าหมาย + Success Metrics

### 2.1 เป้าหมาย (Outcome)
1. เจ้าหน้าที่/ผู้ดูแล **จัดการพฤติกรรม bot ได้เองโดยไม่ต้อง deploy code** (FAQ/intent/keyword)
2. **ส่งประกาศ broadcast** หาประชาชนผู้ติดตาม LINE ได้ (ฉุกเฉิน/ข่าวสาร)
3. **ใช้ซ้ำ message asset** (flex/template) ผ่าน reply-object library
4. **จัดการ rich menu ผ่าน UI** (สร้าง/ซิงค์/สลับ) แทน CLI script
5. **ตั้งค่า bot runtime ผ่าน UI** (welcome message, handoff keywords, business hours)
6. ผู้ดูแล **เห็นสุขภาพระบบ + bot metrics** ในหน้าเดียว

### 2.2 Success Metrics
| KPI | เป้าหมาย | baseline |
|---|---|---|
| เวลาเพิ่ม/แก้ FAQ bot (ไม่ต้อง deploy) | ≤ **2 นาที** | ปัจจุบันต้องแก้ code + deploy (~ชม.) |
| % คำถาม citizen ที่ bot ตอบได้ (FAQ hit rate) | ≥ **60%** ภายใน 3 เดือน | ไม่วัด (hardcoded) |
| เวลาส่ง broadcast ฉุกเฉินถึงผู้ติดตามทุกคน | ≤ **1 นาที** | ทำไม่ได้ (0%) |
| จำนวน bot reply ที่ reuse จาก reply-object | ≥ **50%** ของ flex ที่ส่ง | 0% (inline hardcoded) |
| ระบบล่มที่ผู้ดูแลรู้ตัวผ่าน health page | ≤ **5 นาที** | ไม่มี visibility |

### 2.3 ตัวชี้วัดคุณภาพ
- เจ้าหน้าที่ที่ไม่ใช่เทคนิค (หัวหน้ากอง) เพิ่ม keyword/คำตอบ bot เองได้ใน dry-run
- ทุก mutation ของ chatbot config ถูกบันทึกใน `audit_logs` (PDPA/ตรวจสอบได้)

---

## 3. ผู้ใช้ + Personas (admin-focused)

| Persona | RBAC huangua | ความต้องการ |
|---|---|---|
| **ผู้ดูแลระบบ (sysadmin)** | `superadmin` | ตั้งค่า LINE channel, จัดการ intent/reply-object/rich-menu/broadcast, ดู health |
| **หัวหน้ากอง (supervisor)** | `head` | ดู bot dashboard, จัดการ FAQ/broadcast, approve rich-menu |
| **เจ้าหน้าที่ (operator)** | `officer`/`chief` | ใช้ canned responses ใน live-chat (已有), อาจดู bot overview |

> RBAC huangua (`src/lib/auth/roles.ts`): `citizen < officer < chief < head < superadmin`; `ADMIN_ROLES = [head, superadmin]`, `STAFF_ROLES = [officer, chief, head, superadmin]`

---

## 4. ขอบเขต (Scope)

### 4.1 In-scope (port 9 เมนู)
1. **Settings** (`/admin/settings`) — LINE channel config, welcome message, handoff keywords, business hours (ใช้ตาราง `chat_settings` ที่ว่างอยู่)
2. **FAQ + Intent management** (`/admin/chatbot/auto-replies`) — CRUD `chat_faq` + intent cascade engine (data-driven แทน hardcoded)
3. **Reply Objects** (`/admin/chatbot/reply-objects`) — flex/template asset library อ้างด้วย `$object_id`
4. **Broadcast** (`/admin/chatbot/broadcast`) — LINE broadcast/multicast + ตั้งเวลา (cron-job.org)
5. **Rich Menus** (`/admin/chatbot/rich-menus`) — ยก CLI script เป็น admin UI + DB persistence + sync
6. **Chatbot Dashboard** (`/admin/chatbot`) — bot metrics (FAQ hit rate, handoff count, message volume)
7. **Files** (`/admin/files`) — media library (Vercel Blob)
8. **Image Resize** (`/admin/image-resize`) — client-side canvas resize ตาม LINE preset
9. **Health** (`/admin/health`) — DB/Redis/LINE/Upstash probe + SSE broadcaster status

### 4.2 Out-of-scope (ไม่ทำ / 已有)
- ❌ สร้างซ้ำ chat-histories, canned-responses, users, reports, audit (已有)
- ❌ LIFF mini-apps (jsk มี แต่ huangua ใช้ citizen web form อยู่แล้ว)
- ❌ Live-chat core (已有 เต็มรูปแบบ — SSE + agent console)
- ❌ Telegram/n8n integration (jsk มี แต่ huangua ยังไม่ต้องการ)
- ❌ Multi-tenant, CSAT survey, SLA analytics ขั้นสูง (P3)

### 4.3 Acceptance Criteria (verifiable)
- [ ] `superadmin` เพิ่ม FAQ (question/answer/keywords) ผ่าน UI แล้ว bot ตอบ citizen ได้ทันทีโดยไม่ต้อง deploy
- [ ] `superadmin` สร้าง broadcast แล้วผู้ติดตาม LINE ทุกคนได้รับ (หรือตั้งเวลาได้)
- [ ] สร้าง reply-object (flex) แล้วอ้าง `$object_id` ใน FAQ answer ได้, bot ส่ง flex ถูกต้อง
- [ ] สร้าง rich menu + อัปโหลดรูป + sync ไป LINE ผ่าน UI ได้
- [ ] แก้ welcome message ใน settings แล้ว follow event ใช้ข้อความใหม่
- [ ] ทุก mutation เขียน `audit_logs` (action/resource/userId)
- [ ] หน้าใหม่ทุกหน้าผ่าน a11y gates (contrast AA, touch ≥44px, body ≥17px, reduced-motion)
- [ ] `npx tsc --noEmit` + `npx eslint .` + `npx vitest run` ผ่าน

---

## 5. ข้อกำหนดฟังก์ชัน (ปรับให้เข้า huangua)

### 5.1 Settings — `/admin/settings`
- ใช้ตาราง `chat_settings` (key/value jsonb) ที่**ยังว่างเปล่า**เป็น store
- Keys เริ่มต้น: `line_channel` (token/secret — อ่านจาก env เป็นหลัก, UI แสดงสถานะ/mask), `welcome_message`, `handoff_keywords[]`, `business_hours`, `bot_enabled`
- **ข้อแตกต่างจาก jsk:** jsk เก็บ LINE secret plaintext ใน DB (เป็นข้อเสีย) → huangua **คง LINE token เป็น env** (ปลอดภัยกว่า), UI ตั้งค่าได้เฉพาะ non-secret (welcome/keywords/hours)
- gate: `requireStaff(ADMIN_ROLES)`

### 5.2 FAQ + Intent — `/admin/chatbot/auto-replies`
- **Phase A (quick win):** CRUD UI สำหรับ `chat_faq` ที่มีอยู่แล้ว (question/answer/keywords/priority/hitCount) — ปลดล็อกให้เจ้าหน้าที่แก้ได้ทันที
- **Phase B:** เพิ่ม intent model (categories → keywords + responses) แบบ jsk, cascade `EXACT>STARTS_WITH>CONTAINS>REGEX`
- **engine refactor:** แก้ `engine.ts:routeBotMessage` จาก hardcoded if/else เป็น **data-driven** — เรียก intent matcher ก่อน, fallback ไป case-flow/handoff เดิม
- ⚠️ **บทเรียนจาก jsk:** REGEX ของ admin รันใน Python เคยมี ReDoS → huangua ต้อง precompile + validate ตอน save + ตั้ง cap

### 5.3 Reply Objects — `/admin/chatbot/reply-objects`
- ตารางใหม่ `chat_reply_objects` (object_id unique, object_type enum, payload jsonb, is_active)
- parser แกะ `$object_id` ใน FAQ answer/intent response → สร้าง LINE message
- ⚠️ **บทเรียนจาก jsk:** soft `$object_id` ไม่มี FK → ลบแล้วพังเงียบ + leak `$token` ให้ user → huangua ต้อง **ตรวจ usage ก่อน delete** + parser **ไม่ส่ง raw token**

### 5.4 Broadcast — `/admin/chatbot/broadcast`
- เพิ่ม `broadcastMessage()` + `multicast()` + `getFollowerIds()` ใน `src/lib/line/client.ts` (ปัจจุบันมีแค่ reply/push)
- ตารางใหม่ `chat_broadcasts` (content jsonb, status enum, target, scheduled_at, sent_at, counts)
- scheduler: **cron route** (`api/cron/broadcast-send`) แทน asyncio loop ของ jsk (serverless ไม่มี long-running process) — ตัวเรียกคือ cron-job.org เพราะ Vercel Hobby รัน cron ได้แค่วันละครั้ง
- gate: `requireStaffApi(ADMIN_ROLES)` + audit

### 5.5 Rich Menus — `/admin/chatbot/rich-menus`
- ยกฟังก์ชันใน `messages/rich-menu.ts` (createRichMenu/setDefault/uploadImage) เป็น API routes
- ตารางใหม่ `rich_menus` (name, config jsonb, line_rich_menu_id, image blob-url, status, sync_status)
- รูปเก็บ **Vercel Blob** (ไม่ใช่ดิสก์แบบ jsk — serverless ไม่มี persistent disk)
- sync แบบ idempotent (ตรวจ line_rich_menu_id ก่อนสร้างซ้ำ)

### 5.6 Chatbot Dashboard — `/admin/chatbot`
- KPI: message volume (in/out), FAQ hit rate, handoff count, top keywords, active conversations
- อ่านจาก `chat_messages` + `chat_faq.hitCount` + `chat_conversations` (aggregate ใน cron `stats-refresh` หรือ query ตรง)

### 5.7 Files + Image Resize — `/admin/files`, `/admin/image-resize`
- **Files:** media library เก็บ **Vercel Blob** (เพิ่ม `@vercel/blob`), ตาราง `media_files` (url, filename, mime, size, category, uploaded_by)
- **Image Resize:** client-side canvas (เหมือน jsk) ตาม LINE preset (2500×1686 rich menu, 1040×1040 image message) แล้วอัปโหลดเข้า media library; **server-side ใช้ `sharp`** (มีใน deps แล้ว) สำหรับ thumbnail
- ⚠️ **บทเรียนจาก jsk:** jsk เก็บ BLOB ใน Postgres + `GET /media/{id}` พ้น auth → huangua ใช้ Vercel Blob (signed URL) + gate admin

### 5.8 Health — `/admin/health`
- probe: DB (`SELECT 1`), Upstash Redis (ping), LINE API (validate token), SSE broadcaster status
- ⚠️ **บทเรียนจาก jsk:** jsk `/health/detailed` ไม่มี auth → huangua **gate `requireStaff(ADMIN_ROLES)` ทุก health endpoint**

---

## 6. RBAC + การปรับ Stack (jsk → huangua)

| มิติ | jsk-app | huangua-works (ปรับ) |
|---|---|---|
| Backend | FastAPI + SQLAlchemy (async) | **Next.js API routes + Drizzle ORM** |
| Auth | JWT cookie/bearer + CSRF | **Auth.js v5** (`auth()` session) + `requireStaff`/`requireStaffApi` |
| RBAC | 6 roles + DB `permission_settings` | **5 roles** (citizen/officer/chief/head/superadmin) + role constants; chatbot mgmt gate ที่ `ADMIN_ROLES` |
| Real-time | WebSocket + Redis Pub/Sub | **SSE** + Upstash Redis Pub/Sub (`sse/broadcaster.ts`) |
| Background task | asyncio loop (in-process) | **cron-job.org** ยิง routes (`api/cron/*`) |
| File storage | Postgres BLOB + disk | **Vercel Blob** (ต้องเพิ่ม dep) |
| Secret | Fernet (ยกเว้น LINE plaintext) | **env-only** (LINE token), `chat_settings` เฉพาะ non-secret |
| Design | (jsk theme) | **emerald/amber glassmorphism** + Noto Sans Thai + elderly floor 17px + touch 44px + reduced-motion |

**Navigation:** เพิ่มกลุ่มใหม่ "แชทบอท" ใน `src/components/admin/admin-nav.ts` (ปัจจุบันมี 3 กลุ่ม: งานหลัก/แชท LINE/ระบบ) — เมนู chatbot management ทั้งหมด `supervisorOnly: true` (head/superadmin)

---

## 7. ข้อกำหนดข้อมูล + DB (Drizzle tables ใหม่)

เพิ่มใน `src/lib/db/schema.ts` + migration ผ่าน `drizzle-kit generate`:

| ตาราง | ฟิลด์หลัก | หมายเหตุ |
|---|---|---|
| `chat_reply_objects` | id, object_id (unique), object_type (enum), payload (jsonb), alt_text, is_active, created_by | อ้างด้วย `$object_id` |
| `chat_intents` | id, name (unique), description, is_active | category |
| `chat_intent_keywords` | id, intent_id (FK), keyword, match_type (enum: exact/starts_with/contains/regex) | cascade delete |
| `chat_intent_responses` | id, intent_id (FK), reply_type (enum), text_content, reply_object_id (FK→chat_reply_objects), order, is_active | **ใช้ FK จริง** (แก้จุดอ่อน jsk) |
| `chat_broadcasts` | id, content (jsonb), status (enum: draft/scheduled/sending/sent/failed), target, scheduled_at, sent_at, total/success/failed counts, created_by | |
| `rich_menus` | id, name, chat_bar_text, config (jsonb), line_rich_menu_id (unique nullable), image_url (blob), status, sync_status, last_sync_error | |
| `media_files` | id, url (blob), filename, mime_type, size_bytes, category (enum), uploaded_by | Vercel Blob |
| `chat_settings` | (มีอยู่แล้ว) key/value jsonb | เปิดใช้ |

**คงตารางเดิม:** `chat_faq` (Phase A ใช้เลย), `chat_conversations`, `chat_messages`, `chat_canned_responses`, `chat_tags`, `audit_logs`

---

## 8. สถาปัตยกรรม

### 8.1 Bot engine refactor (หัวใจ)
```
ปัจจุบัน (hardcoded):
  webhook → engine.routeBotMessage → if แจ้งเรื่อง / if ติดตาม / if handoff / matchFaq / fallback

ใหม่ (data-driven):
  webhook → engine.routeBotMessage
    ├─ 1. case-flow active? → processCaseFlow (คงเดิม)
    ├─ 2. intent matcher (data-driven: chat_intents + keywords cascade)  ← ใหม่
    │      └─ resolve responses → reply-objects ($object_id) → LINE messages
    ├─ 3. matchFaq (chat_faq — คงเดิม, เป็น fallback)
    ├─ 4. handoff keywords (อ่านจาก chat_settings แทน hardcoded)
    └─ 5. fallback help text
```

### 8.2 Broadcast scheduling (serverless)
- jsk ใช้ asyncio loop → huangua ใช้ **cron-job.org** ยิง `api/cron/broadcast-send` ทุก 1 นาที + status guard `scheduled→sending` กันส่งซ้ำ (แบบ jsk `FOR UPDATE SKIP LOCKED`)
- ไม่ใส่ `crons` ใน `vercel.json`: Hobby รันได้วันละครั้ง ใส่ถี่กว่านั้น deployment ถูกปฏิเสธทั้ง build (ขึ้น Pro แล้วค่อยย้ายกลับได้)

### 8.3 File storage
- Vercel Blob (`@vercel/blob`) สำหรับ rich menu image + media library — serverless-friendly, มี signed URL, ไม่ต้องจัดการ disk

---

## 9. a11y + Design System (HARD gates จาก DESIGN.md)

ทุกหน้าใหม่ต้องผ่าน:
- **Contrast AA** (emerald/amber light+dark) — รัน `scripts/check-contrast.ts`
- **Touch target ≥44px** (`min-h-touch`)
- **Body text ≥17px** (elderly floor)
- **Noto Sans Thai เท่านั้น** (ห้าม serif)
- **Glassmorphism cards** + emerald primary (The One Emerald Rule)
- **prefers-reduced-motion** respect ทุก animation
- ใช้ primitives ที่มี: `AdminShell`, `AdminCard`, `KpiCard`, `Pagination`, `EmptyState`, Radix (Dialog/Select/Tabs/Toast)
- Pattern หน้า: `page.tsx` (server, `requireStaff`) + `*-client.tsx` (client interactivity)

---

## 10. ความเสี่ยง + สมมติฐาน

### 10.1 สมมติฐาน
1. LINE channel ของ อบต.หัวงัว เปิดใช้ Messaging API + มี channel token/secret ใน env แล้ว
2. Vercel plan รองรับ Cron + Blob (ต้อง Pro ถ้า go-live — ดู `docs/PRD.md` §10)
3. จำนวนผู้ติดตาม LINE ยังไม่มาก (<10K) → broadcast ตรงได้โดยไม่ต้อง audience API
4. เจ้าหน้าที่ head/superadmin รับอบรมจัดการ bot ได้

### 10.2 ความเสี่ยง + mitigation
| # | ความเสี่ยง | ระดับ | Mitigation |
|---|---|---|---|
| R1 | engine refactor ทำ bot เดิมพัง (case-flow/handoff) | **HIGH** | TDD: เขียน test ครอบ routeBotMessage เดิมก่อนแก้, feature flag `bot_engine_v2` ใน chat_settings |
| R2 | REGEX intent → ReDoS | MEDIUM | precompile+validate ตอน save, cap 256 chars, timeout |
| R3 | ลบ reply-object ที่ถูกอ้าง → bot พัง | MEDIUM | ตรวจ usage ก่อน delete (block/เตือน), parser ไม่ส่ง raw `$token` |
| R4 | Vercel Blob cost/limit | MEDIUM | ใช้ Pro, compress รูปฝั่ง client ก่อนอัปโหลด |
| R5 | broadcast ซ้ำ (cron overlap) | MEDIUM | status guard `scheduled→sending` + atomic update |
| R6 | LINE token รั่วผ่าน settings UI | **HIGH** | UI แสดงเฉพาะ mask, secret คงเป็น env, audit ทุกการอ่าน |
| R7 | a11y fail (ผู้สูงอายุใช้ไม่ได้) | MEDIUM | axe + keyboard + contrast gate ทุกหน้า |
| R8 | migration ทำข้อมูล chat เดิมหาย | MEDIUM | drizzle-kit generate + ทดสอบกับ DB copy, ไม่ drop ตารางเดิม |

---

## 11. ข้อจำกัด + Phasing

### 11.1 Phasing (แนะนำ)
| Phase | เมนู | เหตุผล |
|---|---|---|
| **P1 (foundation + quick win)** | Settings + FAQ UI (Phase A) | ปลดล็อกเจ้าหน้าที่เร็วสุด, เสี่ยงต่ำ |
| **P2 (bot brain)** | Intent engine + Reply Objects + engine refactor | หัวใจ data-driven |
| **P3 (outreach)** | Broadcast + Rich Menus | ต้องใช้ LINE API เพิ่ม |
| **P4 (assets)** | Files + Image Resize | ต้องเพิ่ม Vercel Blob |
| **P5 (observability)** | Chatbot Dashboard + Health | อ่านจากข้อมูลที่สะสม |

### 11.2 Go-live criteria (ต่อเมนู)
- migration ผ่าน + seed defaults
- a11y gates ผ่าน (axe 0 critical/serious, keyboard 100%, contrast AA)
- `tsc`/`eslint`/`vitest` เขียว
- audit log เขียนครบทุก mutation
- Vercel preview OK

---

## ภาคผนวก: อ้างอิง
- บทวิเคราะห์ jsk-app: `research/jsk-reviews/` (00-03)
- PRD หลัก huangua: `docs/PRD.md`, `docs/implementation-plan.md`
- Design system: `DESIGN.md`
- Workflow: `AGENT.md` (§2-§4)
- PRP-Plan คู่กัน: `docs/prp-chatbot-management.md`
