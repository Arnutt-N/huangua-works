# Plan — LINE admin parity JSK (9 tranches, ธีมหัวงัว)

- PRD: `.agents/PRPs/prds/line-admin-parity-jsk.prd.md`
- หลัก: แตะเฉพาะ `src/app/admin/chat*/**`, `friends/**`, reuse `admin-api.ts` + `/api/line/admin/*` เดิม
- ทุก tranche: TDD (red→green→refactor) + `tsc` + `eslint` + `vitest run` ที่เกี่ยว + review gate ก่อนถัดไป

## T1 — Reply Objects กริดการ์ด
- File: `chatbot/reply-objects/reply-objects-client.tsx`, `reply-preview.tsx`
- ทำ: ตาราง → กริด 3 คอลัมน์ รหัส `$$object_id` + badge type (`payloadSummary`/`typeBadgeClass` เดิม) + modal เดิมคง validate `reply-object-validation` + hint อ้าง `$id`
- อ้าง JSK: `reply-objects/page.tsx:259-306` card grid, `:319-463` modal + preview
- Test: render card/badge/empty + save invalid payload ถูก block

## T2 — Broadcast list + detail
- File: `chatbot/broadcast/broadcast-client.tsx` + ใหม่ `broadcast/[id]/page.tsx` + client
- ทำ: ตาราง 6 คอลัมน์ ชื่อ/ประเภท/สถานะ/ผู้รับ/วันที่ส่ง/จัดการ + `STATUS_MAP` 5 แบบเดิม (ร่าง/รอส่ง/กำลังส่ง/ส่งแล้ว/ล้มเหลว) + empty + pagination + detail stats + timeline (reuse `GET /broadcasts`, `/:id/send`)
- อ้าง JSK: `broadcast/page.tsx:148-326` list, `[id]/page.tsx:172-396` detail
- Test: badge ครบ 5 สถานะ + detail render stats/timeline + ส่งจาก detail ได้

## T3 — Broadcast wizard 4 ขั้น
- File: `chatbot/broadcast/new/broadcast-wizard-client.tsx`
- ทำ: 3→4 ขั้น (ประเภท/เขียน/กลุ่มเป้าหมาย/ตรวจ+ส่ง) + dry-run preview จำนวน + schedule flow เดิม + preview เนื้อหา
- อ้าง JSK: `broadcast/new/page.tsx:233-544` stepper + `handleDryRun/handleSaveDraft/handleSaveAndSend/handleSaveAndSchedule`
- Test: stepper guard ข้ามขั้นไม่ได้ + dry-run แสดงจำนวน + schedule ต้องมีเวลา

## T4 — Auto-Replies หน้า detail + readiness
- File: `chatbot/auto-replies/*` + ใหม่ `auto-replies/[id]/page.tsx` + client
- ทำ: list เติม toggle + readiness badge + หน้า detail keywords (match_type) + responses (reply_type) + modal สร้าง 2 ทาง (ตั้งค่าต่อ/อย่างเดียว)
- อ้าง JSK: `auto-replies/page.tsx:56-376`, `[id]/page.tsx:44-100`, `MATCH_TYPES/REPLY_TYPES`
- Test: readiness 3 แบบ + keyword CRUD + response CRUD แยก

## T5 — Canned Responses ปรับคอลัมน์
- File: `chatbot/canned-responses/canned-responses-client.tsx`
- ทำ: ตาราง ชอร์ตคัต `/...`/ข้อความ 2 บรรทัด/หมวดหมู่/ใช้ไป/จัดการ + `CATEGORY_OPTIONS info/greeting/closing/escalation` + 409 duplicate shortcut (ใกล้ของเดิมสุด เปลี่ยนน้อย)
- อ้าง JSK: `canned-responses/page.tsx:61-395`
- Test: 409 ค้าง modal + focus shortcut + หมวดครบ 4

## T6 — Rich Menus แยก aliases/edit/insights
- File: `chatbot/rich-menus/*` + ใหม่ `aliases/page.tsx`, `[id]/edit/page.tsx`, `[id]/insights/page.tsx` + client
- ทำ: list badge `ACTIVE/Live Now` + ปุ่ม Aliases/New Menu + แยก aliases หน้า (pattern `[a-zA-Z0-9_-]{1,50}` + repoint select) + แยก edit หน้า (Basic/Template+Area/Design&Sync + display mode) + insights (reuse stats ถ้ามี)
- อ้าง JSK: `rich-menus/page.tsx:34-319`, `aliases/page.tsx:32-275`, `new/page.tsx` preset 6-buttons
- Test: alias pattern reject + repoint + display mode 3 แบบ

## T7 — Friends bulk + detail + history
- File: `friends/friends-client.tsx` + ใหม่ `[id]/page.tsx`, `history/page.tsx`
- ทำ: ตารางเติมคอลัมน์ Rich Menu/Chat Mode/Since/Last Active + checkbox bulk assign/unassign (reuse `POST/DELETE /friends/:id/rich-menu`) + refollow badge + detail + history
- อ้าง JSK: `friends/page.tsx:45-506` bulk + `RichMenuAssignModal`, `maskLineUserId`
- Test: bulk assign/unassign + validate unsynced block + mask ทุกแถว

## T8 — Chat Histories ค้นหา group + detail
- File: `chat-histories/chat-histories-client.tsx` + `[conversationId]` detail
- ทำ: debounce 500ms + group ตาม user + relativeTime ไทย + pagination + refresh + detail reuse `MessageList`
- อ้าง JSK: `chat-histories/page.tsx:89-407`, `relativeTime`, `[lineUserId]/page.tsx`
- Test: group ถูก user + relativeTime ครบหน่วย + pagination

## T9 — Chat เสริม picker + session + analytics
- File: `chat/_components/*`, `chat-client.tsx`
- ทำ: Emoji/Sticker picker + QuickReplies (`/` reuse canned) + SessionActions (claim/release/transfer) + StatusLegend + Typing + UnreadDivider + analytics (reuse `chatbot-stats`)
- อ้าง JSK: live-chat `_components/*`, `_hooks/*`, `_store/liveChatStore`, `analytics/page.tsx`
- ห้าม: สร้าง `/admin/live-chat` ใหม่ — เสริม `/admin/chat` ในที่เดิม + คง SSE เดิม
- Test: picker แทรกข้อความ + session claim/release + analytics render

## Review gate ทุก tranche
- `npx tsc --noEmit` + `npx eslint <files>` + `npx vitest run <test>` เขียว
- diff เฉพาะ tranche นั้น ไม่มี drive-by refactor
- roles/audit/PDPA เดิมไม่ถดถอย (test เดิมเขียว)
