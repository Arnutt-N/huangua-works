# PRP-Plan: jsk-app port Phase 2 — R1–R3 (เรียงเล็ก → ใหญ่)

อ้าง PRD: `docs/plans/line-richmenu-phase2-PRD.md` · branch: `feat/port-jsk-line-hardening`
(ต่อจาก Phase 1 T1–T6 ที่ merge แล้ว — ไม่แตะไฟล์ Phase 1 นอกจากเรียกใช้)

## ลำดับ tranche (R1 → R2 → R3, ตาม laziness-protocol)

### R1 — อัปรูปเมนู (ฐาน, ไม่มีบล็อก)

ไฟล์:

- แก้ `src/lib/audit.ts` — เพิ่ม `RICH_MENU_IMAGE_UPLOAD: 'rich_menu_image_upload'`
  ใน `AUDIT_ACTIONS` (ต่อจาก `RICH_MENU_PUBLISH` L77; union type ได้อัตโนมัติ)
- สร้าง `src/app/api/line/admin/rich-menus/[id]/upload/route.ts` —
  `requireStaffApi(ADMIN_ROLES)` + `parseBody` ไม่ได้ (multipart) → อ่าน `formData()` ตรง,
  เช็คขนาด ≤1MB (413 ไทย), sniff magic PNG/JPEG (422), เรียก `uploadMenuImage()`
  จาก `src/lib/line/rich-menu-service.ts` (มีแล้ว), fail → 422 พร้อม error เดิม
  (route ตั้งใจบาง ไม่แตะ `syncStatus` — อัปล้มไม่เปลี่ยนความหมาย sync ของ config),
  success → `logAudit` + คืน `{ ok: true }`
  (pattern ตาม `[id]/sync/route.ts` ข้างกัน)
- แก้ `src/app/admin/_lib/admin-api.ts` — เพิ่ม `uploadRichMenuImage(id, file)`
  (FormData POST, ต่อจาก `publishRichMenu` L237)
- แก้ `src/app/admin/chatbot/rich-menus/rich-menus-client.tsx` — ปุ่ม "อัปรูป"
  ต่อแถว (disabled ถ้า `!lineRichMenuId`, สอนด้วยข้อความ "ต้อง sync ก่อน" ตาม service
  ที่คืน `'ต้อง sync ก่อนอัปโหลดรูป'`)
- สร้าง `src/app/api/line/admin/rich-menus/[id]/upload/route.test.ts` —
  ไฟล์เกิน → 413, .txt → 422, ไม่มีสิทธิ์ → 401/403

บล็อก: ไม่มี
ทดสอบ: `npx vitest run src/app/api/line/admin/rich-menus`
เสี่ยง: multipart บน Next 16 route — ใช้ `request.formData()` มาตรฐาน;
  up-redis ไม่เกี่ยว (ไม่ใช้ Redis ตรงนี้)

### R2 — เมนู 6 ช่อง LIFF (ต้องมี R1 ก่อนเพราะ test ครบวงจรต้องอัปรูปได้)

ไฟล์:

- แก้ `.env.example` — เพิ่ม `NEXT_PUBLIC_LIFF_ID=` + comment (build-time env,
  ตั้งแล้วต้อง rebuild; ค่าตรงกับ `LINE_LIFF_ID` ใน `.env.local`)
- แก้ `src/app/intake/page.tsx` — รับ `searchParams`, ส่ง `initialCategorySlug`
  ให้ `IntakeForm` (pattern เดิมส่ง `categories` อยู่แล้ว L50)
- แก้ `src/app/intake/intake-form.tsx` — `initialForm` รับ slug → match กับ
  `categories` (slug ตรง + active) แล้วตั้ง `categoryId` ตั้งต้น; ไม่ตรง → `''`
  เหมือนเดิม (ไม่ throw, ไม่ redirect)
- แก้ `src/app/admin/chatbot/rich-menus/rich-menus-client.tsx` — เปลี่ยน
  `DEFAULT_CONFIG` เป็น template 6 ปุ่ม (bounds `833/833/834 × 843` ตามสเปก
  `2500×1686`; 5× `uri` liff + 1× `message` "ติดต่อเจ้าหน้าที่"; placeholder
  `<LIFF_ID>` พร้อม comment ให้แทนค่าจาก `LINE_LIFF_ID`)
- test: `intake-form` preselect (slug ตรง/ผิด/inactive) ผ่าน vitestที่มีอยู่ของ intake

บล็อก: R1 (test ครบวงจรเมนูต้องอัปรูปได้ก่อน)
ทดสอบ: `npx vitest run src/app/intake` + สร้างเมนูจาก template ใหม่แล้ว sync dry-check
เสี่ยง: `NEXT_PUBLIC_*` ฝังตอน build — dev ต้อง restart `npx next dev` หลังตั้ง;
  Endpoint URL ใน LINE console ต้องเป็น root (มี § ใน `src/lib/liff/config.ts` แล้ว)

### R3 — sync recreate-on-drift (ใหญ่สุด, ต้องมี R1+R2)

ไฟล์:

- แก้ `src/lib/line/rich-menu-service.ts` — ใน `syncRichMenu`: ถ้ามี `lineRichMenuId`
  ให้ `getFromLine`-style verify (ผ่าน `client.ts` export ที่มี) เทียบ projection
  `{size,name,chatBarText,areas}` กับ `config` ใน DB; เพี้ยน/stale → ลบเก่า
  (`deleteLineRichMenu` — เช็ค `client.ts` มีไหม ไม่มีให้เพิ่ม) → สร้างใหม่ →
  อัปรูปเดิม (`imageUrl` ใน DB; jsk-app เก็บ bytes — เราเก็บ URL/S3 ตาม `uploadMenuImage`
  ที่รับ buffer: ดึง bytes กลับไม่ได้ถ้าเป็น URL ภายนอก → ถ้าไม่มี bytes ให้ข้ามอัป
  พร้อม `lastSyncError` เตือน ไม่ fail) → ย้าย default ถ้า `status=active` →
  `logAudit(RICH_MENU_SYNC, {recreated: true})`; ตรงกัน → mark synced (no-op)
- test: `rich-menu-service` recreate (mock client: old→new id, default ย้าย),
  no-op (id เดิม), stale (404 → สร้างใหม่)

บล็อก: R1+R2 (ต้องมีรูป + config 6 ปุ่มจริงก่อน test drift มีความหมาย)
ทดสอบ: `npx vitest run src/lib/line` (integration ที่ต้องใช้ DB/Redis ข้ามถ้า docker ไม่ขึ้น —
  unit mock client ต้องเขียวเสมอ)
เสี่ยง: ลบเมนูที่เป็น default อยู่ → ย้าย default **ก่อน** ลบ (แบบ jsk-app);
  ถ้า `imageUrl` เป็น URL ภายนอกดึง bytes ไม่ได้ → ข้ามอัปแบบเตือน ไม่ fail sync

## Review gate (ก่อนลงมือ R1) — ตรวจแล้ว ✓/✗ ข้างท้ายคือผล verify รอบนี้

- [x] PRD ครบ ปัญหา/ขอบเขต/เกณฑ์/ข้อจำกัด — ตรงคำขอ "ของดีทุกอย่าง + ที่ขาด"
  (ของใหญ่เกินรอบตัดเป็น Phase 3 พร้อมเหตุผลใน PRD)
- [x] PRP file-level ถูก — path ตรวจมีจริงทั้งหมด:
  `admin-api.ts` L231–237 ✓, `[id]/sync|publish` มี `[id]/upload` ไม่มี ✓,
  `audit.ts` L75–77 ✓, `schema.ts` L957 `imageUrl` ✓,
  `rich-menu-service.ts` L6–26 + `uploadMenuImage` ไร้ caller ✓,
  `intake-form.tsx` L57 + `page.tsx` L50 ✓, `config.ts` liffUrl ✓,
  `.env.example` ไร้ LIFF ✓, `.env.local` มี `LINE_LIFF_*` แต่ `NEXT_PUBLIC_LIFF_ID`=0 ✓,
  handoff keywords มีใน DB แล้ว ✓ (ตัดออกจากสโคป)
- [x] ลำดับ R1→R2→R3 ไม่มีวงจร (R3 กินผล R1+R2 ทางเดียว)
- [x] สมมติฐานยืนยันแล้ว: fail-open ไม่เกี่ยวรอบนี้ (ไม่มี Redis ตรง);
  multipart มาตรฐาน Next; `imageUrl`-ภายนอกมี fallback ข้ามอัปแบบเตือน
