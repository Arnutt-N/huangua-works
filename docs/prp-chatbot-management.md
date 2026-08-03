# PRP-Plan — Chatbot Management Suite (port จาก jsk-app)

> **Implementation plan** คู่กับ `docs/prd-chatbot-management.md` · ทำตาม `AGENT.md` §3 (PRP-Plan) + §4 (Review Gate)
> ⚠️ **Review Gate ก่อนเขียนโค้ด:** ตรวจ PRP นี้กับ codebase จริง (path/pattern ถูกต้อง), flag สมมติฐาน, รอ user confirm
> Convention huangua: หน้า admin = `page.tsx` (server, `requireStaff`) + `*-client.tsx` (client) · API = `route.ts` (`requireStaffApi`) · branch ต่อ tranche (`feat/<tranche>`)

---

## Dependency Graph (ภาพรวม)

```
T0 Foundation (schema + settings service + nav)
  ├─► T1 Settings UI
  ├─► T2 FAQ UI (Phase A) ──► T3 Intent engine + Reply Objects (Phase B) ──► engine refactor
  ├─► T4 Broadcast (ต้องเพิ่ม LINE client fns)
  ├─► T5 Rich Menus (ต้องเพิ่ม Vercel Blob)
  ├─► T6 Files + Image Resize (ต้องเพิ่ม Vercel Blob)
  └─► T7 Dashboard + Health (อ่านจากข้อมูล T2-T6)
```

**Critical path:** T0 → T2 → T3 (bot brain) · T4/T5/T6 parallelizable หลัง T0 · T7 last

---

## Tranche 0 — Foundation (BLOCK ทุก tranche)

**Branch:** `feat/chatbot-foundation`

### File-level changes
| Action | Path | รายละเอียด |
|---|---|---|
| MODIFY | `src/lib/db/schema.ts` | เพิ่ม tables: `chatReplyObjects`, `chatIntents`, `chatIntentKeywords`, `chatIntentResponses`, `chatBroadcasts`, `richMenus`, `mediaFiles` + enums (`reply_object_type`, `match_type`, `reply_type`, `broadcast_status`, `rich_menu_status`, `media_category`) |
| CREATE | `drizzle/000X_chatbot_management.sql` | migration (gen ผ่าน `pnpm db:generate`) |
| CREATE | `src/lib/line/settings.ts` | `getChatSetting(key)` / `setChatSetting(key,value)` อ่าน/เขียน `chat_settings` + in-memory cache + defaults (welcome_message, handoff_keywords, business_hours, bot_enabled) |
| MODIFY | `src/components/admin/admin-nav.ts` | เพิ่มกลุ่ม "แชทบอท" + items (overview/auto-replies/reply-objects/broadcast/rich-menus/files/image-resize/health/settings) ทั้งหมด `supervisorOnly: true` + เพิ่ม `AdminTab` type |
| CREATE | `src/lib/line/bot/intent-matcher.ts` | (stub) `matchIntent(text)` — skeleton สำหรับ T3 |
| MODIFY | `src/lib/line/client.ts` | เพิ่ม `broadcastMessage()`, `multicast()`, `getFollowerIds()` (stub + types สำหรับ T4) |

### Dependency order
schema → migration → settings service → nav → stubs

### Test strategy
- `settings.ts`: unit test get/set/default/cache (vitest)
- schema: `pnpm db:generate` ต้อง gen migration ได้โดยไม่ error; integration test สร้าง/อ่าน row ใหม่ (ต้อง Docker Postgres :5433)
- nav: unit test `visibleNavGroups(role)` — officer ไม่เห็นกลุ่มแชทบอท, head/superadmin เห็น

### Risks
- migration กระทบตาราง chat เดิม → **ห้าม drop/alter ตารางเดิม**, เพิ่มอย่างเดียว; ทดสอบกับ DB copy ก่อน
- enum naming ชนของเดิม (`chat_message_type` มี template/flex อยู่แล้ว) → ใช้ชื่อ enum ใหม่เฉพาะ

---

## Tranche 1 — Settings UI

**Branch:** `feat/chatbot-settings` · **Depends:** T0

### File-level changes
| Action | Path | รายละเอียด |
|---|---|---|
| CREATE | `src/app/admin/settings/page.tsx` | server: `requireStaff(ADMIN_ROLES)` + อ่าน chat_settings → `<AdminShell active="settings">` |
| CREATE | `src/app/admin/settings/settings-client.tsx` | form: welcome message, handoff keywords (tag input), business hours, bot_enabled toggle; LINE channel status (mask token จาก env, อ่านอย่างเดียว) |
| CREATE | `src/app/api/line/admin/settings/route.ts` | GET/PUT chat_settings; `requireStaffApi(ADMIN_ROLES)`; audit log ทุก PUT |
| MODIFY | `src/lib/line/bot/welcome.ts` | อ่าน welcome จาก `getChatSetting('welcome_message')` แทน hardcoded |
| MODIFY | `src/lib/line/bot/handoff.ts` | อ่าน `HANDOFF_KEYWORDS` จาก settings แทน hardcoded constant |

### Test strategy
- API route: integration test GET/PUT + 403 สำหรับ officer + audit row ถูกเขียน
- welcome/handoff: unit test ว่าอ่านจาก settings (mock getChatSetting)
- a11y: axe + keyboard form

### Risks
- LINE token รั่ว → UI **ห้าม** return token เต็ม (mask `****1234`), secret คงเป็น env

---

## Tranche 2 — FAQ Management UI (Phase A, quick win)

**Branch:** `feat/chatbot-faq-ui` · **Depends:** T0

### File-level changes
| Action | Path | รายละเอียด |
|---|---|---|
| CREATE | `src/app/admin/chatbot/auto-replies/page.tsx` | server: `requireStaff(ADMIN_ROLES)` → list `chat_faq` |
| CREATE | `src/app/admin/chatbot/auto-replies/auto-replies-client.tsx` | table + CRUD dialog (question/answer/keywords/priority/isActive), แสดง hitCount |
| CREATE | `src/app/api/line/admin/faq/route.ts` | GET (list+filter) / POST (create); `requireStaffApi(ADMIN_ROLES)` |
| CREATE | `src/app/api/line/admin/faq/[id]/route.ts` | PATCH / DELETE (soft: isActive=false) |
| MODIFY | `src/lib/line/bot/faq-matcher.ts` | (ถ้าจำเป็น) ให้คำตอบรองรับ `$object_id` ref (เตรียมสำหรับ T3) |

### Test strategy
- API: integration test CRUD + unique question + 403 non-admin + audit
- faq-matcher: unit test scoring + hitCount increment (มี test เดิมเป็นฐาน)
- UI: test render table + dialog

### Risks
- ตาราง `chat_faq` มีข้อมูล seed อยู่แล้ว → UI ต้อง handle existing rows, ห้าม wipe

---

## Tranche 3 — Intent Engine + Reply Objects (Phase B, หัวใจ)

**Branch:** `feat/chatbot-intent-engine` · **Depends:** T0, T2

### File-level changes
| Action | Path | รายละเอียด |
|---|---|---|
| CREATE | `src/lib/line/bot/intent-matcher.ts` | (แทน stub) `matchIntent(text)` cascade EXACT>STARTS_WITH>CONTAINS>REGEX (Drizzle queries), precompile+cache regex, cap 256 chars |
| CREATE | `src/lib/line/bot/response-parser.ts` | `parseResponse(text)` แกะ `$object_id` → resolve `chat_reply_objects` → LINE messages; **ไม่ส่ง raw token** (fallback text ปลอดภัย) |
| CREATE | `src/app/admin/chatbot/reply-objects/page.tsx` + `-client.tsx` | CRUD reply objects (object_type, payload jsonb editor, preview) |
| CREATE | `src/app/api/line/admin/reply-objects/route.ts` + `[id]/route.ts` | CRUD; **DELETE ตรวจ usage** (ถูกอ้างใน faq/intent ไหม) ก่อนลบ |
| CREATE | `src/app/admin/chatbot/intents/page.tsx` + `-client.tsx` | (optional P2.5) intent category/keyword/response editor |
| CREATE | `src/app/api/line/admin/intents/...` | CRUD intents/keywords/responses |
| MODIFY | `src/lib/line/bot/engine.ts` | refactor `routeBotMessage`: เพิ่ม intent matcher step (data-driven) ระหว่าง case-flow กับ matchFaq; **feature flag** `bot_engine_v2` จาก settings |
| CREATE | `src/components/admin/reply-object-preview.tsx` | preview flex/template (reuse pattern จาก jsk LineFlexRenderer) |

### Dependency order
intent-matcher → response-parser → reply-objects API/UI → engine refactor (flag) → intents UI

### Test strategy
- **TDD engine refactor (สำคัญ):** เขียน test ครอบ `routeBotMessage` พฤติกรรมเดิม (case-flow/ติดตาม/handoff/faq) **ก่อน**แก้ → หลังแก้ test ต้องยังเขียว (กัน R1)
- intent-matcher: unit test cascade แต่ละระดับ + regex invalid/over-cap skip
- response-parser: unit test `$object_id` resolve, object หาย → ไม่ leak token
- reply-objects DELETE: test block เมื่อถูกอ้าง
- engine v2 flag: test ทั้ง on/off

### Risks
- **R1 (HIGH):** engine refactor ทำ bot เดิมพัง → TDD + feature flag + rollout ทีละขั้น
- **R2:** ReDoS → precompile + validate + cap
- **R3:** ลบ reply-object พัง → usage check + parser ปลอดภัย

---

## Tranche 4 — Broadcast

**Branch:** `feat/chatbot-broadcast` · **Depends:** T0 (parallel กับ T2/T3 ได้)

### File-level changes
| Action | Path | รายละเอียด |
|---|---|---|
| MODIFY | `src/lib/line/client.ts` | (แทน stub) `broadcastMessage(messages)`, `multicast(userIds, messages)`, `getFollowerIds(limit, start)` |
| CREATE | `src/lib/line/broadcast-service.ts` | CRUD + `sendBroadcast()` (status guard scheduled→sending, chunk multicast 500), `getDueScheduled()` |
| CREATE | `src/app/admin/chatbot/broadcast/page.tsx` + `-client.tsx` | list + wizard สร้าง (content builder, target all/specific, ตั้งเวลา) |
| CREATE | `src/app/admin/chatbot/broadcast/new/page.tsx` | wizard สร้าง |
| CREATE | `src/app/api/line/admin/broadcasts/route.ts` + `[id]/route.ts` + `[id]/send/route.ts` | CRUD + send; `requireStaffApi(ADMIN_ROLES)`; audit |
| CREATE | `src/app/api/cron/broadcast-send/route.ts` | cron-job.org ยิงทุก 1 นาที: ส่ง broadcast ถึงกำหนด; Bearer `CRON_SECRET`; status guard กันซ้ำ |
| ~~MODIFY~~ | ~~`vercel.json`~~ | ~~เพิ่ม cron schedule `/api/cron/broadcast-send`~~ — **ยกเลิก** ขัดกับ implementation-plan.md §Vercel config ("no `crons` (ใช้ cron-job.org)") ทำจริงแล้ว deploy ล้ม → ตั้งใน cron-job.org แทน (DEPLOY.md §4.3 job #5) |

### Test strategy
- client fns: unit test (mock fetch) broadcast/multicast/followers
- broadcast-service: test status guard, chunking, count tally
- cron: integration test ส่ง broadcast ถึงกำหนด + ไม่ส่งซ้ำ
- API: 403 non-admin + audit

### Risks
- **R5:** cron ซ้ำ → status guard + atomic update
- LINE broadcast API ไม่รายงาน reach → `total_recipients` เป็นประมาณการ (UI สื่อชัด)

---

## Tranche 5 — Rich Menus

**Branch:** `feat/chatbot-rich-menus` · **Depends:** T0 + T6 (Vercel Blob) หรือติดตั้ง Blob เอง

### File-level changes
| Action | Path | รายละเอียด |
|---|---|---|
| MODIFY | `src/lib/line/messages/rich-menu.ts` | refactor: รับ config จาก DB แทน `RICH_MENU_BODY` hardcoded; idempotent sync |
| CREATE | `src/lib/line/rich-menu-service.ts` | create/sync/publish/alias logic (adapt จาก jsk RichMenuService) |
| CREATE | `src/app/admin/chatbot/rich-menus/page.tsx` + `-client.tsx` | list + template-based editor (area layout) + อัปโหลดรูป + sync/publish |
| CREATE | `src/app/admin/chatbot/rich-menus/[id]/edit/page.tsx` | editor |
| CREATE | `src/app/api/line/admin/rich-menus/route.ts` + `[id]/...` + `[id]/sync` + `[id]/publish` | CRUD + sync + publish; `requireStaffApi(ADMIN_ROLES)`; audit |
| DEPRECATE | `scripts/upload-rich-menu.ts` | คงไว้เป็น fallback แต่ UI เป็นทางหลัก |

### Test strategy
- rich-menu-service: unit test idempotent sync (mock LINE API), publish
- API: integration test CRUD + sync + 403
- UI: test area editor + image upload

### Risks
- LINE rich menu ต้องรูปขนาดเป๊ะ (2500×1686/843, ≤1MB PNG/JPEG) → validate + ใช้ image-resize (T6) ช่วย
- edit-after-sync divergence (LINE ไม่มี update API) → UI เตือนให้ re-sync

---

## Tranche 6 — Files + Image Resize

**Branch:** `feat/chatbot-files` · **Depends:** T0

### File-level changes
| Action | Path | รายละเอียด |
|---|---|---|
| MODIFY | `package.json` | เพิ่ม `@vercel/blob` |
| CREATE | `src/lib/blob.ts` | Vercel Blob helper (upload/delete/signed-url) |
| CREATE | `src/app/admin/files/page.tsx` + `-client.tsx` | media library: grid/list, upload, delete, copy URL |
| CREATE | `src/app/api/line/admin/media/route.ts` + `[id]/route.ts` | upload (Vercel Blob) / list / delete; `requireStaffApi(ADMIN_ROLES)`; audit |
| CREATE | `src/app/admin/image-resize/page.tsx` + `-client.tsx` | client-side canvas resize ตาม LINE preset + อัปโหลดเข้า media |
| CREATE | `src/lib/image.ts` | (optional) server-side `sharp` thumbnail |

### Test strategy
- blob helper: unit test (mock @vercel/blob)
- API: integration test upload/list/delete + 403 + size cap
- image-resize: test canvas preset dimensions (jsdom + mock)

### Risks
- **R4:** Vercel Blob cost → Pro plan + compress ฝั่ง client
- serverless body size limit → cap upload 10MB

---

## Tranche 7 — Dashboard + Health (observability)

**Branch:** `feat/chatbot-observability` · **Depends:** T2-T6 (ต้องมีข้อมูลก่อน)

### File-level changes
| Action | Path | รายละเอียด |
|---|---|---|
| CREATE | `src/app/admin/chatbot/page.tsx` + `-client.tsx` | bot dashboard: message volume, FAQ hit rate, handoff count, top keywords, active conversations (KpiCard + charts) |
| CREATE | `src/app/api/line/admin/chatbot-stats/route.ts` | aggregate จาก chat_messages/chat_faq/chat_conversations |
| CREATE | `src/app/admin/health/page.tsx` + `-client.tsx` | health: DB/Redis/LINE/SSE status (auto-refresh) |
| CREATE | `src/app/api/line/admin/health/route.ts` | probe DB (SELECT 1) + Upstash ping + LINE token validate + broadcaster status; **`requireStaffApi(ADMIN_ROLES)`** |
| MODIFY | `src/app/api/cron/stats-refresh/route.ts` | (optional) เพิ่ม bot metrics เข้า `caseStatsDaily` หรือตารางใหม่ |

### Test strategy
- stats API: integration test aggregate
- health API: test probe + **403 non-admin** (กันบทเรียน jsk `/health/detailed` ไม่มี auth)
- UI: test render KPIs

### Risks
- aggregate query หนัก → ใช้ cron refresh + cache (Upstash) แทน query ตรงทุก call

---

## สรุป Tranche + Effort + Parallelization

| Tranche | เมนู | Effort | Parallel ได้กับ | Branch |
|---|---|---|---|---|
| T0 | Foundation (schema/settings/nav) | M | — (ต้องก่อน) | `feat/chatbot-foundation` |
| T1 | Settings UI | S | T2 | `feat/chatbot-settings` |
| T2 | FAQ UI (Phase A) | S | T1, T4, T6 | `feat/chatbot-faq-ui` |
| T3 | Intent engine + Reply Objects | L | — (ต่อ T2) | `feat/chatbot-intent-engine` |
| T4 | Broadcast | M | T2, T5, T6 | `feat/chatbot-broadcast` |
| T5 | Rich Menus | M | T4, T6 | `feat/chatbot-rich-menus` |
| T6 | Files + Image Resize | M | T2, T4, T5 | `feat/chatbot-files` |
| T7 | Dashboard + Health | S | — (หลังสุด) | `feat/chatbot-observability` |

**Effort รวม:** ~M×4 + S×3 + L×1 ≈ **3-4 สัปดาห์** (1 dev) · parallel 2 dev ≈ **2 สัปดาห์**

---

## Review Gate Checklist (ก่อน implement — AGENT.md §4)

- [ ] PRD ครอบ original request ครบ (port 9 เมนู, skip 5 เมนูที่已有) — no scope creep
- [ ] PRP path ถูกต้องตาม codebase จริง (ตรวจ `src/app/admin/`, `src/lib/line/`, `src/lib/db/schema.ts`)
- [ ] Pattern ตรงกัน: `page.tsx`+`*-client.tsx`, `requireStaff`/`requireStaffApi`, `AdminShell`
- [ ] Flag สมมติฐาน: (a) Vercel Blob ตกลงใช้ไหม, (b) LINE channel token มีใน env แล้วหรือยัง, (c) intent Phase B ทำเลยหรือหลัง FAQ Phase A
- [ ] **User confirm** ก่อนเขียนโค้ด (โดยเฉพาะ R1 engine refactor ที่กระทบ bot เดิม)

---

## คำสั่ง verification (ต่อ tranche — AGENT.md CI section)
```bash
npx tsc --noEmit       # typecheck
npx eslint .           # lint
npx vitest run         # unit + integration (ต้อง Docker Desktop: Postgres :5433 + Redis)
pnpm db:generate       # gen migration (T0)
```
