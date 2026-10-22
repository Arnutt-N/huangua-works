# Plan — #143 T1 frontend-only (11 ข้อ)

- Branch: `chore/143-consider-followup` (สร้างแล้ว)
- PRD: `.agents/PRPs/prds/143-consider-t1.prd.md`
- Gate ต่อ tranche: `npx tsc --noEmit` + `npx eslint <ไฟล์ที่แก้>` + `npx vitest run <test ที่เกี่ยว>`

## Tranche A — สกัดซ้ำ (4 ข้อโครง)

### A1. `useMenuAlias` hook ร่วม
- Create: `src/app/admin/chatbot/rich-menus/use-menu-alias.ts` — hook รวม `aliasId/aliasTarget/form states + create/repoint/delete + reload` คืน `{ aliasId, setAliasId, aliasTarget, setAliasTarget, aliases, syncedMenus, loading, feedback?, handleCreateAlias, handleRepoint, handleDeleteAlias }`
- Modify: `rich-menus-client.tsx` (`:115-146` ลบ เหลือเรียก hook), `aliases/aliases-client.tsx` (ทั้งไฟล์ logic `:12-51` เรียก hook)
- Test: เติม `use-menu-alias.test.ts` (create ว่างบล็อก, create สำเร็จล้างฟอร์ม+reload, repoint/delete reload) + test เดิม 2 ไฟล์เขียว
- สกัด `syncedMenus` ไว้ใน hook ผ่าน `isUsableMenu` (A3)

### A2. `readinessOf` ไฟล์เดียว + dashboard reuse `listIntents`
- Create: `src/app/admin/chatbot/auto-replies/readiness.ts` — `export function readinessOf(item: { isActive: boolean; keywords: unknown[]; responses: unknown[] })`
- Modify: `intent-section.tsx:58`, `[id]/intent-detail-client.tsx:19` ลบสำเนา → import; `chatbot-dashboard-client.tsx:18-36` ลบ `listIntentsForReadiness` + `ReadinessIntent` → `load: adminApi.listIntents`, map `readinessOf` แทน logic inline `:106-114`
- Test: `readiness.test.ts` (4 เคส: ปิดใช้งาน/ไม่มี kw/ไม่มีตอบ/พร้อม) + dashboard test เดิมเขียว

### A3. `isUsableMenu` predicate เดียว
- Create: `src/app/admin/chatbot/rich-menus/menu-predicates.ts` — `isUsableMenu(m: RichMenuItem): boolean` = `!!lineRichMenuId && syncStatus === 'synced' && status !== 'inactive'`
- Modify: `rich-menus-client.tsx:120,210`, `aliases-client.tsx:22`, `friends-client.tsx:122` → import เดียว
- หมายเหตุ: friends เดิมตรวจแค่ `lineRichMenuId && status` — ยกระดับต้อง synced (กันผูกเมนูเวอร์ชันเก่า); server ยัง guard `lineRichMenuId` อยู่
- Test: `menu-predicates.test.ts` (local/synced/inactive/unsynced)

### A4. canned reload รวมตัวเดียว
- Modify: `canned-responses-client.tsx:35-62` — `useEffect` เรียก `reload()` แทนลอก fetch ซ้ำ
- Test เดิมเขียว (load/error/delete-confirm/reload)

## Tranche B — ป้าย/UX หลอก (6 ข้อ)

### B1. ป้าย edit/insights
- `rich-menus/[id]/edit/edit-client.tsx`: title `แก้ไขเมนู:` → `ซิงก์/เผยแพร่เมนู:` (ตรง § PATCH รับแค่ display window)
- `rich-menus/[id]/insights/insights-client.tsx`: title `{name}` → `สถานะเมนู: {name}` + เติมบรรทัด `coming soon` สถิติรายปุ่ม (มีโน้ต OA Manager อยู่แล้ว ขยายชัด)
- `rich-menus-client.tsx:254-268`: aria-label `แก้ไข {name}` → `ซิงก์/เผยแพร่ {name}`, `สถิติ {name}` → `สถานะเมนู {name}`
- Test: อัปเดต `rich-menus-client.test.tsx:79-86`, `edit-client.test.tsx` (ป้ายใหม่)

### B2. wizard guard + ป้าย
- `broadcast/new/broadcast-wizard-client.tsx`: `goStep` — ออกจาก step 1 ต้อง `buildContent()` ผ่านก่อน (error ค้างหน้าเดิม); `handleCreate` + `goStep` บล็อก `scheduleAt` อดีต (`<= now` → 'ตั้งเวลาต้องเป็นอนาคต'); ปุ่ม step 3 `ทดลองส่ง` → `ประเมินจำนวนผู้รับ` (ตรงกับ step 2, ไม่หลอกว่ามีส่งจริง)
- Test: อัปเดต `broadcast-wizard-client.test.tsx` (ปุ่มชื่อใหม่) + เติมเคสข้าม step ตอนว่าง + อดีตบล็อก

### B3. วันที่ broadcast มีเวลา
- `broadcast/[id]/broadcast-detail-client.tsx:34,88,94,101` + `broadcast/broadcast-client.tsx:239,241`: `toLocaleDateString` (มี hour/minute) → `toLocaleString` options เดิม
- ไม่แตะ `format.ts` (date-only ตั้งใจ) — ยืนยันด้วย grep
- Test: snapshot/text มีเวลาปรากฏ (เติมเคส detail render วันที่)

### B4. composer slash/manage + ยืนยัน retry
- `composer.tsx`: `onClose` picker ไม่ล้าง input (กันกลืน); เพิ่มปุ่ม `จัดการข้อความด่วน` เรียก `onManageCanned` ชัด (เก็บ doubleClick เป็นทางลัด); `handleSend` คงบล็อก `/` (กันส่ง shortcut ดิบ)
- retry: ยืนยันสาย `chat-client → ChatArea → MessageList → MessageBubble → useMessages.retry` ต่อแล้ว (test `message-bubble.test.tsx` มี) — ไม่แก้โค้ด เติมเคส retry ใน test ถ้าขาด
- Test: `composer.quick-replies.test.tsx` เติม slash-persist + ปุ่มจัดการ

### B5. canned manage dialog error
- `canned-manage-dialog.tsx:194`: `{!formOpen && error}` → แสดง error นอกฟอร์มเสมอ (กัน error จมหายตอนฟอร์มเปิด/ปิด); confirm มีแล้ว (`:78`) คงไว้
- Test: เติมเคส delete ล้มเหลวเห็น error + cancel ไม่ยิง API (mirror หน้า canned หลัก)

## Tranche C — เทส (1 ข้อ)

### C1. quick reply 4+ แถว/โฟกัส
- `composer.quick-replies.test.tsx`: เติม canned 5 ตัว → แถบโชว์ 3 ตัวแรกเท่านั้น; กดแล้ว textarea focus + ค่าตรง; ไม่มี listbox เปิดค้าง
- ระวัง `testTimeout` งาน userEvent หนัก — ตั้ง `vi.setConfig({ testTimeout: 30_000 })` ตาม pattern wizard/intake

## ลำดับทำ

1. A1 → A2 → A3 → A4 (สกัดซ้ำ, test ใหม่ 3 ไฟล์)
2. B1 → B2 → B3 → B4 → B5 (ป้าย/UX, อัปเดต test เดิมที่อ้างป้าย)
3. C1 (เทส)
4. Gate รวม: `tsc` + `eslint .` (ไม่เพิ่ม error ใหม่) + `vitest run --exclude '**/*.integration.test.ts'`
5. Commit แยก tranche (A/B/C) → push → PR → ติ๊ก #143 11 ช่อง → T2 แยก follow-up
