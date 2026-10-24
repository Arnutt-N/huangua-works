# PRP-Plan — เทียบเมนู LINE ให้เหมือน jsk-app 100%

อ้างอิง: [PRD](./jsk-line-menu-parity-PRD.md) · โค้ดต้นฉบับ `D:\genAI\jsk-app` @ `8d4c979` · screenshot 19 ใบ

## หลักการทั้งแผน

- คง token หัวงัว — เปลี่ยนเฉพาะโครง/ฟิลด์/ข้อความ/ฟีเจอร์
- shared component สร้างครั้งเดียวใช้ทุกหน้า (`PageHeader`, `DetailModal`, `ViewToggle`) — แบบ jsk ที่เพิ่ง dedupe ตัวเอง (PR #290) อย่า copy ซ้ำ
- ทุก tranche ปิดด้วย `tsc` + `eslint` + `vitest` + เทียบ screenshot ของหน้านั้นก่อนไปต่อ

---

## Tranche 0 — ของกลาง + sidebar (ฐานให้ทุกหน้า)

**สร้าง**
- `src/components/admin/page-header.tsx` — h1 `text-xl sm:text-2xl` + subtitle + actions slot (`PageHeader.tsx:13-41` ยกมา ใช้สี token หัวงัว)
- `src/components/admin/detail-modal.tsx` — modal ดูรายละเอียดแบบ rows (`DetailModal.tsx` ของ jsk)
- `src/components/admin/view-toggle.tsx` — toggle grid/list (`ViewToggle.tsx` ของ jsk)
- `src/hooks/use-session-timeout.ts` + `src/components/admin/session-timeout-warning.tsx` — ยก `useSessionTimeout.ts` + `SessionTimeoutWarning.tsx` เปลี่ยนสีเป็น token; mount ใน `admin-shell.tsx`
- `src/components/liff/leave-confirm.tsx` — `useLiffLeave` + `LeaveConfirmDialog` (จาก PR #291 ฝั่ง LIFF ใช้ร่วมกับหน้า intake ทีหลัง)

**แก้**
- `src/components/admin/admin-nav.ts:102-118` — ลำดับ/ป้าย/ไอคอน ตาม `layout.tsx:193-201`: Chatbot Overview → Live Chat → Chat Histories → Broadcast → Auto-Replies → Reply Objects → Canned Responses → Rich Menus → Friend Histories (ป้ายอังกฤษตาม jsk; "การสนทนา" ย้ายเข้ากลุ่มเดียวกัน)
- `src/components/liff/liff-sdk.ts:8` — pin LIFF SDK เวอร์ชัน ≥2.31.x

**Test**: `use-session-timeout.test.ts` (นับถอยหลัง/reset/logout), `admin-nav.test.ts` แก้ expectation กลุ่ม/ลำดับใหม่

**ความเสี่ยง**: `token.expiresAt` หัวงัว (1 ชม./30 วัน) ต่างจาก inactivity 30 นาทีของ jsk — `extendSession` ต่อได้แค่ตัวเตือน ห้ามหลอกว่าต่อ JWT (§ comment กำกับ)

---

## Tranche 1 — Chat Histories + Friend Histories

**แก้**
- `chat-histories-client.tsx` — PageHeader "ประวัติแชท"/"ประวัติการสนทนาทั้งหมด", placeholder "ค้นหาข้อความในสนทนา...", เวลา "…ที่แล้ว" (`format.ts:27-38`), "ยังไม่มีข้อความ" ตัวเอียง, mask ดอกจัน (`lib/mask.ts` ของ jsk), skeleton ตาราง, ผลค้นหาจับกลุ่มต่อคน "พบ N ผลลัพธ์"
- `chat-histories/[conversationId]/` — ปุ่ม export CSV/TXT, badge ผู้ส่งต่อ bubble, ปุ่ม "โหลดข้อความเก่า"
- `friends-client.tsx` — เพิ่มคอลัมน์ Chat Mode + Since (วันที่ไทย "8 เม.ย. 2569"), หัว "ประวัติเพื่อน"/subtitle, ปุ่ม "ประวัติ", placeholder "Search users...", "All Status"+BLOCKED, DateRangePicker + "ล้างตัวกรอง", bulk unassign, ไอคอน RefreshCw บน badge
- **สร้าง** `friends/history/page.tsx` — stat cards 4 ใบ + timeline FOLLOW/UNFOLLOW/BLOCK/UNBLOCK/REFOLLOW + pagination (ตาราง `lineFriendEvents` มีแล้ว ขาดแค่ UI)
- `friends/[id]/` — เพิ่ม timeline เหตุการณ์รายคน

**Test**: แก้ `friends-client.bulk.test.tsx:56` ให้ assert หัวคอลัมน์ Chat Mode/Since จริง (stale test ที่เจอ), `chat-histories` format เวลา

---

## Tranche 2 — Broadcast + Auto-Replies

**แก้**
- `broadcast-client.tsx` — footer "ทั้งหมด N รายการ" + pagination, คอลัมน์จัดการ Eye/Send/Trash2, สถานะ `cancelled`, ชื่อแคมเปญ (schema ใหม่ `title`), skeleton
- `broadcast-wizard-client.tsx` — การ์ด Reply Object ใบที่ 4 (`object_ref`), field ชื่อแคมเปญ, ตัวนับ 5000, stepper pill+icon แบบ jsk, "ทดลองส่ง" dry-run, ปุ่ม "บันทึกแบบร่าง"/"ส่งเลย", `DateTimePickerTH` (สร้าง `src/components/ui/thai-date-picker.tsx` ถ้ายังไม่มี wrapper), step 3 preview แบบ split
- `broadcast-detail-client.tsx` — ปุ่มยกเลิกการส่ง/ลบ + Modal, preview text/image/flex/multi
- `intent-section.tsx` — คอลัมน์สถานะ + Switch, dialog "เพิ่ม Category ใหม่" ปุ่มคู่ "สร้างและตั้งค่าต่อ"/"สร้างอย่างเดียว", หัว "Intent Categories", ConfirmDialog ลบ
- `intent-detail-client.tsx` — ฟอร์มเพิ่ม/แก้ไข Keyword (match types 4) + Response (reply types 9) ในหน้า detail, banner `?created=1`, แก้ชื่อ/คำอธิบาย/Active ที่หน้านี้

**Schema/API**: `broadcast` เพิ่ม `title`; DELETE broadcast → soft-delete; auto-replies DELETE → `is_active=false` (นโยบาย PR #291)

**Test**: soft-delete toggle กลับ, wizard validate ชื่อแคมเปญ+5000, match types

---

## Tranche 3 — Canned + Reply Objects

**แก้**
- `canned-responses-client.tsx` — คอลัมน์หมวดหมู่/สถานะ/ใช้ไป (6 คอลัมน์), PageHeader "ข้อความสำเร็จรูป" + subtitle ตาม jsk, dialog label "(พิมพ์ / คำ เพื่อเรียก)" + ชอร์ตคัต required maxLength 30, ปุ่ม "ยกเลิก" ghost, DetailModal, Switch is_active
- `src/app/admin/chat/_lib/types.ts:62-67` — `CannedResponse` เพิ่ม `category`/`isActive`/`usageCount`
- `reply-objects-client.tsx` + หน้า — ฟอร์มตาม `ReplyObjectForm.tsx` ของ jsk: Universal ID (`flex_welcome`)/Internal Name (`Welcome Message 2.0`)/Message Protocol/Grouping Category (`Marketing / Support`)/Alt Text accessibility, CONTENT editor พื้นเข้ม + LIVE PREVIEW "invalid flex" คู่กัน, QuickReplyEditor (≤13), หน้า `reply-objects/new` เต็ม, การ์ดแสดง name+category+Eye

**Schema/API**: `cannedResponses` เพิ่ม `category`/`isActive`/`usageCount`; `replyObjects` เพิ่ม `name`/`category`; ทั้งคู่ DELETE = soft-delete + `?include_inactive=true`

**Test**: zod schema ใหม่, preview invalid flex, quick-reply 13 ช่อง, stale-write 409 "มีคนแก้" (แบบ jsk `updated_at`)

---

## Tranche 4 — Rich Menus (ใหญ่สุด)

**แก้**
- `rich-menus-client.tsx` — thumbnail `<img>` + onError fallback, ปุ่มลบ+ConfirmDialog, DetailModal, badge "N ผู้ใช้", pill 8 สถานะ (`lib/rich-menu.ts` ของ jsk ยกมา), เกต `canPublish`+Re-sync
- `rich-menu-builder-client.tsx` (new) — 3 การ์ด 1/2/3, Change Template + modal 11 เทมเพลต (Large 7+Compact 4), 6 AREA dropdown (Open URL/Send Msg/สลับเมนู), โซนอัปโหลดรูป + กล่องเหลือง "Max size 1MB" + preview ซ้อนเลข, "การแสดงผล" 3 radio, ปุ่ม "บันทึกฉบับร่าง"/"บันทึกและซิงค์ →"
- `edit-client.tsx` — ฟอร์มเต็ม: แก้ชื่อ/Chat Bar ได้, Area Actions 6 การ์ด, รูปซ้อนเลข 1-6, ปุ่ม ยกเลิก/บันทึกฉบับร่าง/บันทึกและซิงค์
- `aliases-client.tsx` — ตาราง 4 คอลัมน์ + คอลัมน์สถานะ Sync + regex `/^[a-zA-Z0-9_-]{1,50}$/` + ConfirmDialog
- `insights-client.tsx` — สถิติจริง LINE Insight (summary/daily, KPI, กราฟ, privacy warning 20 คน)

**Schema/API**: richMenus เพิ่ม `displayMode`/`startAt`/`endAt`/`syncStatus` detail; upload image auto-fit 1MB; insights proxy

**Test**: `canPublish` gate, alias regex, image auto-fit, scheduled display window

---

## Tranche 5 — Chatbot Overview + Live Chat

**แก้**
- `chatbot-dashboard-client.tsx` — เขียนใหม่ทั้งไฟล์: StatsCard 3 ใบ (Reply Objects/Intent Categories/Active Responses) + Recent Templates 5 + Active Intents 5 (ตาม `chatbot/page.tsx` ของ jsk; สถิติ KPI เดิมย้ายไปหน้า reports หรือตัด — เสนอตัด)
- `chat-client.tsx` + `_components/*` — คงอยู่ในแอปเดียว **ไม่เปิดแท็บใหม่** (คำตัดสินผู้ใช้): ไซด์บาร์หลัก (AdminShell) + ไซด์บาร์แชท หุบ/ขยายได้ทั้งคู่, หัว "Live Chat", "Live Chat Console"+badge Connected, empty state "Select a Conversation"+Waiting/Active, footer "N active/N waiting/N offline", filter All/Waiting/Active, ปุ่ม "โอน"/"คืนให้ทีม", CUSTOMER INFO (LINE ID/Session/ACTIVITY/หมายเหตุ/EXPORT CSV PDF), banner "Bot กำลังคุยกับลูกค้าอยู่"

**Test**: full-screen layout, export CSV/PDF, presence mapping

---

## ลำดับพึ่งพา

```
T0 (ของกลาง+sidebar) → T1..T5 ทำขนานได้ แต่แนะนำเรียง T1→T2→T3→T4→T5 (T4 ใหญ่สุด, T5 ต้องใช้ของกลางจาก T0)
```

## จุดเสี่ยงรวม

| ความเสี่ยง | ลดผลกระทบ |
|---|---|
| schema ใหม่หลายตาราง | ทำ `drizzle-kit generate` ทีเดียวช่วงท้าย T2/T3/T4 แล้ว push ครั้งเดียว |
| session timeout หลอกเรื่อง JWT | § comment + test ว่า `extendSession` ไม่แตะ token |
| jsk เปลี่ยน UI ระหว่างทาง | pin ที่ `8d4c979` — ถ้า jsk เดิน ค่อย diff เฉพาะไฟล์ที่แตะ |
| insights ของจริงต้องมี user ≥20 | แสดง privacy_restricted state ตาม jsk |

## จบแต่ละ tranche

```bash
npx tsc --noEmit && npx eslint . && npx vitest run
```

+ จับ screenshot หน้านั้นเทียบ `secrets/jsk-app/screenshot/line/` ทีละใบ ห้ามปิดงานด้วย "test ผ่าน" อย่างเดียว (บทเรียนรอบก่อน)
