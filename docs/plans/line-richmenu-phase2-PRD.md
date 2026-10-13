# PRD: jsk-app port Phase 2 — เมนู 6 ช่อง LIFF + อัปรูป + sync แข็ง (R1–R3)

ต่อจาก Phase 1 (T1–T6, PR #101, `docs/plans/line-hardening-jsk-port-PRD.md`) ที่ลง runtime ครบแล้ว
รอบนี้เก็บงานที่ค้างจากเมนูบริการงานช่าง อบต.หัวงัว 6 ช่อง (ภาพ `2500×1686, 966KB` พร้อมแล้ว)

## ปัญหา (มีหลักฐานในโค้ด)

1. อัปรูปไม่ได้ — หน้า `/admin/chatbot/rich-menus` (`src/app/admin/chatbot/rich-menus/rich-menus-client.tsx`)
   มีแค่ สร้าง/Sync/Publish; `admin-api.ts` มีแค่ `list/create/sync/publish` (L231–237);
   route มีแค่ `[id]/sync` กับ `[id]/publish` — ไม่มี `[id]/upload` ทั้งที่ schema
   (`src/lib/db/schema.ts` L957) มีคอลัมน์ `imageUrl` และ `src/lib/line/rich-menu-service.ts`
   มี `uploadMenuImage()` รออยู่แล้ว (ไม่มี caller)
2. ลิงก์ LIFF ใช้ไม่ได้ — โค้ดอ่าน `NEXT_PUBLIC_LIFF_ID` (`src/lib/liff/config.ts`)
   แต่ `.env.local` มีแค่ `LINE_LIFF_ID`/`LINE_LIFF_URL` (นับ `NEXT_PUBLIC_LIFF_ID` ได้ 0)
   และ `.env.example` ไม่มีคีย์ LIFF เลย → `liffUrl()` คืน null ทุก path
   ปุ่มเมนู 5 ช่องที่เป็น `uri` เปิด LIFF ไม่ได้จนกว่าจะตั้ง + rebuild
3. กดปุ่มหมวดแล้วฟอร์มไม่เลือกหมวดให้ — `/intake` (`src/app/intake/page.tsx` L50)
   ส่งแค่ `categories` ให้ `IntakeForm`; ฟอร์มเริ่ม `categoryId: ''`
   (`src/app/intake/intake-form.tsx` L57) ไม่รู้จัก `?category=<slug>` ที่ config เมนูส่งมา
4. แก้ config หลัง sync แล้วไม่ขึ้น LINE — `syncRichMenu`
   (`src/lib/line/rich-menu-service.ts` L6–26) ถ้ามี `lineRichMenuId` แล้วแค่ mark `synced`
   ไม่ verify ไม่ recreate (LINE แก้ layout ไม่ได้ — jsk-app แก้ด้วย `_recreate_on_line`)

## ขอบเขต

**ในขอบเขต:**

- R1 อัปรูปเมนู: route `POST [id]/upload` + `adminApi.uploadRichMenuImage` + ปุ่มใน UI +
  validate (≤1MB, PNG/JPEG magic sniff, 413/422 ภาษาไทย) + audit action ใหม่
  `RICH_MENU_IMAGE_UPLOAD` (ของเดิมมีแค่ CREATE/SYNC/PUBLISH ที่ `src/lib/audit.ts` L75–77)
- R2 เมนู 6 ช่อง LIFF: เพิ่ม `NEXT_PUBLIC_LIFF_ID` ใน `.env.example` + doc ตั้งค่า,
  `/intake` อ่าน `?category=<slug>` แล้ว preselect (slug ไม่ตรง/หมวด inactive → ว่างเหมือนเดิม),
  เปลี่ยน `DEFAULT_CONFIG` ใน `rich-menus-client.tsx` เป็น template 6 ปุ่ม
  (ถนน/ไฟฟ้า/ประปา/เรื่องอื่นๆ/ติดตาม/contact-flex ตามภาพที่อนุมัติแล้ว)
- R3 sync แข็ง: เทียบ config projection ก่อน mark synced; เพี้ยน → ลบเมนูเก่าบน LINE
  สร้างใหม่ อัปรูปเดิมซ้ำ ย้าย default ถ้า `status=active`; log ผ่าน `RICH_MENU_SYNC`
  พร้อม metadata `recreated: true`

**นอกขอบเขต (พร้อมเหตุผล):**

- โหมด booking / debt-mediation / หน้าซ้ำ 3 เวอร์ชันของ jsk-app — เป็นโดเมนคนละระบบ
  ลอกมาไม่คุ้ม
- Telegram/n8n infra — หัวงัวไม่มีช่องทางนี้ ใช้ admin notify เดิมพอ
- Fernet pseudonymization — Phase 1 ตัดสินแล้วว่า HMAC CID พอ
- permission-matrix DB, SLA/CSAT, broadcast specific-audience UI,
  scheduler/alias/insights rich-menu — ใหญ่เกินรอบนี้ เก็บเป็น Phase 3
- แจ้งเตือนเจ้าหน้าที่ telegram/discord (เคสเข้า/อัปเดตสถานะ + toggle เปิดปิด) —
  ตรวจแล้ว huangua มีแค่ probe line/s3/smtp (`src/lib/system/probe.ts` L10)
  ยังไม่มีโค้ดส่ง → Phase 3 ตามมติเจ้าของงาน
- ระบบจอง booking — ตรวจแล้วไม่มีใน huangua เลยสักไฟล์ → Phase 3 ตามมติเจ้าของงาน
- handoff keyword ตั้งใน DB — มีแล้ว (`getChatSetting('handoff_keywords')`,
  `src/lib/line/bot/handoff.ts` L10) ไม่ต้องทำซ้ำ

## เกณฑ์ยอมรับ (ตรวจได้)

- R1: อัปไฟล์ >1MB → 413 ไทย; อัป .txt → 422; อัปรูปเมนูที่ sync แล้ว → LINE มีรูป
  (verify ผ่าน get); sync ซ้ำหลังอัป → เขียว (already-uploaded ไม่แดง)
- R2: ตั้ง `NEXT_PUBLIC_LIFF_ID` + rebuild → `liffUrl('/intake')` คืน URL จริง;
  เปิด `/intake?category=water-supply` → ช่องหมวดเลือก "น้ำประปา" ให้เลย;
  slug ผิด → ฟอร์มว่าง + ไม่ error
- R3: แก้ areas ใน DB แล้ว Sync → LINE ได้ id ใหม่, default ยังชี้เมนูใหม่ (ถ้า active),
  sync โดยไม่แก้ → id เดิม (no-op); LINE โดนลบนอกระบบ → Sync สร้างใหม่แทนค้าง stale

## ข้อจำกัด

- `AGENTS.md`: TDD red→green→refactor, lint + typecheck + test หลังแต่ละ unit,
  conventional commits, local gates ก่อน PR; ใช้ `npx` (ห้าม `pnpm`)
- ปุ่ม/สถานะใหม่ใน chat UI ถ้ามีสีใหม่ต้องเพิ่มคู่ใน `src/lib/design/contrast-pairs.ts`
- E2E `fullyParallel: false, workers: 1` ห้ามขนาน
- ห้ามแตะ key format rate-limit / ไม่ขยายสโคปไป Phase 3 ในรอบนี้

## ตัวชี้วัด

- เมนู 6 ช่องสร้าง → Sync → อัปรูป 966KB → Publish ได้ครบจากหน้า admin เดียว
- `npx tsc --noEmit` + `npx eslint .` + `npx vitest run` เขียวทุก tranche
- กดปุ่มถนนจาก LINE (หลัง LIFF พร้อม) เปิดฟอร์มพร้อมหมวดถนน preselect
