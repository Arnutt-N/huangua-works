# PRD — UX/UI แอดมิน Tranche B–E (FORM / FLOW / A11Y / NET)

วันที่: 25 ตุลาคม 2026
Branch: `docs/uxui-prd-prp-tranche-b-e`
อ้างอิง: `docs/uxui-handoff.md` (ผลตรวจ 25 ต.ค. 2026), `AGENTS.md`

> ขอบเขตที่ได้รับมอบหมายรอบนี้: **Tranche B (FORM-01/02/03) + C (FLOW-01/03/04) + D (A11Y-01..04) + E (NET-02/03/04)**
> ไม่รวม Tranche A (ทำเป็นด่าน T0 ในแผน), F (Design System), G (Performance), และงานนอกขอบเขตทุกข้อที่ระบุใน §5

## 1. Skill selection (AGENTS.md step 1)

อ้าง `docs/uxui-handoff.md` §7 ว่าไม่พบ `.claude/skill-collections-20260712.md` — ไฟล์จริงในรีโปคือ `.claude/skill-collections/skill-collections-20261015.md`

- Baseline: karpathy-guidelines (surgical change, no drive-by)
- Process: superpowers (`systematic-debugging` เมื่อ finding ไม่ reproduce, `verification-before-completion` ก่อนปิด tranche)
- UI/a11y: ux-ui-agent-skills (`a11y-audit`, `design-qa`) — ใช้กับ Tranche D
- Browser: playwright ที่มีในรีโป (`e2e/`, `playwright.config.ts`) — ไม่เพิ่ม tool ใหม่

## 2. ปัญหาและความต้องการ

ผลตรวจ static review ยืนยันกับโค้ดปัจจุบันแล้ว **13/13 ข้อในขอบเขต** (รายละเอียดหลักฐานใน PRP §2):

| กลุ่ม | อาการที่ผู้ใช้เจอจริง |
|---|---|
| FORM | กด "บันทึกแบบร่าง" แล้วระบบสร้างรายการตั้งเวลา; ระงับบัญชีทันทีโดยไม่ยืนยันและ error หายเงียบ; mutation ใน reply-objects แจ้งผลไม่ครบ |
| FLOW | เจ้าหน้าที่เห็นฟอร์มที่ตนไม่มีสิทธิ์ กรอกแล้วเด้งกลับแดชบอร์ดโดยข้อมูลหาย; กลับจากรายละเอียดเรื่องแล้วเสียตัวกรอง; บันทึกฟอร์มหนึ่งทำให้ค่าที่พิมพ์ในอีกฟอร์มหาย |
| A11Y | Drawer ที่ปิดอยู่ยังกด Tab เข้าได้; ปุ่มไฟล์เห็นเฉพาะตอน hover; Dialog สูงเกินจอ; คำเตือน session เป็นภาษาอังกฤษและโฟกัสหลุด |
| NET | 401/403 แสดงคำอังกฤษดิบ; error หายใน 4 วินาทีแล้วหน้าโชว์ "ไม่มีข้อมูล" แทน error; ไม่มี timeout/abort |

## 3. ขอบเขต

### In scope (13 รหัส)

- **B:** FORM-01, FORM-02, FORM-03
- **C:** FLOW-01, FLOW-03, FLOW-04
- **D:** A11Y-01, A11Y-02, A11Y-03, A11Y-04
- **E:** NET-02, NET-03, NET-04
- **T0 (ด่านบังคับก่อนแก้ UI):** เก็บ baseline หน้าแรก + admin และกลไกเทียบก่อน–หลัง

### Out of scope (ห้ามแตะในรอบนี้)

- Landing page `/` ทุกไฟล์และไฟล์ร่วมตาม `docs/uxui-handoff.md` §2.2 — รวม `src/app/page.tsx`, `src/components/landing/*`, `src/app/layout.tsx`, `src/styles/tokens.css`, `src/components/ui/button.tsx`, `src/components/site/brand-mark.tsx`, `src/lib/copy.ts`, `src/lib/cn.ts`, `src/lib/thai-date.ts`, `src/components/liff/liff-state-redirect.tsx`
- NET-01, FORM-04 (กระทบ public intake) — ต้องรับมอบหมายแยก
- FLOW-02 (assignment vs status) — ต้องยืนยันกติกาธุรกิจก่อน
- A11Y-05 (ขนาดฟอนต์/ตาราง), FORM-05, FORM-06 (อาจบางส่วนจำเป็นเป็น dependency ของ FORM-02/03 — ดู PRP §3 ข้อ D-1)
- Tranche F (Design System), G (Performance), refactor Auth/`useResource` ทั้งระบบ
- เปลี่ยน Stack, Lifecycle, Schema, Global tokens

## 4. เกณฑ์ยอมรับ (verifiable)

| รหัส | เกณฑ์ผ่าน |
|---|---|
| FORM-01 | ปุ่ม "บันทึกแบบร่าง" สร้าง status `draft` เสมอแม้ผู้ใช้เลือกวันเวลา; มีปุ่ม/ทางแยกชัดเจนสำหรับ "ตั้งเวลา" และ "ส่งเลย"; test ยืนยัน payload และผลจริงของทั้งสามทาง |
| FORM-02 | ระงับ/เปิดบัญชีต้องผ่าน dialog ยืนยัน ระบุผลกระทบ; ปุ่ม disable ระหว่าง pending; error จาก server แสดงให้เห็น (ไม่ถูกทิ้ง) |
| FORM-03 | ทุก mutation ใน reply-objects (create/update/toggle/delete) มี pending, success, error ที่มองเห็นและการเข้าถึงได้; ไม่มี `res.error` ถูกทิ้ง |
| FLOW-01 | ฟอร์มงบประมาณ/รายละเอียดแสดงเฉพาะบทบาทที่ server อนุญาต โดยใช้ tier matrix เดียวกับ `resolveAllowedRoles`; บทบาทอื่นเห็นข้อมูลแบบอ่านอย่างเดียวหรือไม่เห็นฟอร์ม; server ยังตรวจซ้ำเสมอ |
| FLOW-03 | กลับจากรายละเอียดเรื่องแล้วได้ตัวกรอง/คำค้น/หน้าเดิม; return path ถูกตรวจว่าเป็น internal path ก่อนใช้ |
| FLOW-04 | บันทึกฟอร์มหนึ่งแล้วค่าที่พิมพ์ในฟอร์มอื่นไม่หายเงียบ; มีกลไก refresh ข้อมูลโดยไม่ remount ทั้งหน้า |
| A11Y-01 | Drawer ปิด: ไม่มีโฟกัสเข้าถึงได้ (inert/hidden); เปิด: โฟกัสเข้าและคืนกลับ, Escape/backdrop ทำงาน, `aria-controls` เชื่อมปุ่ม |
| A11Y-02 | ปุ่มจัดการไฟล์มองเห็นเมื่อ focus และบนจอสัมผัส โดยไม่ต้อง hover |
| A11Y-03 | Dialog ทุกตัวใช้ได้บนจอเตี้ย (≤600px height) และเมื่อเปิดคีย์บอร์ดมือถือ; ไม่มีปุ่มสำคัญหลุดจอ; caller เดิมไม่เกิด double scrollbar |
| A11Y-04 | ข้อความไทยทั้งหมด; มี `aria-describedby`; โฟกัสเข้า dialog, กักใน dialog, คืนหลังปิด |
| NET-02 | 401 → ข้อความไทย "เซสชันหมดอายุ" พร้อมทางกลับ login (ปลอดภัย); 403 → "ไม่มีสิทธิ์"; error ไม่หายเองก่อนผู้ใช้แก้ |
| NET-03 | request มี timeout (AbortSignal) และ abort เมื่อ unmount/เปลี่ยน query; `data === null` + error → แสดง error state ไม่ใช่ empty state |
| NET-04 | mutation ที่มีอยู่มี in-flight guard (ไม่มี double submit จากปุ่มที่ไม่มี pending); มี `src/app/admin/error.tsx`; server action ที่เขียน DB และยังไม่มี try/catch ถูกครอบ |
| T0 | มีภาพ baseline หน้าแรก (mobile 375 + desktop 1440, light/dark ถ้ารองรับ) และ diff-check ก่อน merge ทุก tranche UI; ภาพก่อน–หลังหน้าแรกเท่ากันหรือรายงานว่ายืนยันไม่ได้ |

ด่านรวมทุก tranche:

```bash
npx tsc --noEmit
npx eslint .
npx vitest run
npx tsx scripts/check-contrast.ts
npx next build          # จับ SSR boundary / error.tsx / action return shape — verify-env รันใน build อยู่แล้ว
npx tsx scripts/verify-env.ts   # รันแยกได้ เร็วกว่า full build
```

## 5. ข้อจำกัดและ Dependencies

- Next.js 16 App Router, Tailwind v4 (CSS-first, ไม่มี `tailwind.config.ts`), Radix primitives ที่ติดตั้งแล้ว (`@radix-ui/react-dialog`, `@radix-ui/react-toast`) — **ห้ามเพิ่ม dependency**
- `@radix-ui/react-toast` มี primitive แต่ไม่มี consumer; จะใช้ต้อง mount provider ใน `src/app/admin/**` layout — ต้องไม่แตะ root layout
- `src/components/ui/dialog.tsx` เป็น shared primitive 17 production callers + 1 story (รวม 18 จุด, ไม่มี caller ฝั่ง landing) — แก้ได้ แต่ต้องไล่ caller ตาม A11Y-03
- Integration/E2E ต้องมี Docker stack + seed; E2E รัน `workers: 1` เพราะ share DB/Redis
- GitHub Actions ถูกพักตามนโยบาย — ไม่มี CI run ไม่ใช่ความผิดพลาด
- Rate limit: E2E login admin ใช้ `resetRateLimits()` helper ก่อนทุก test
- ข้อมูลทดสอบต้องไม่ส่งข้อความ LINE ถึงประชาชนจริง (broadcast/send)

## 6. ตัวชี้วัด

- 0 diff ในไฟล์ protected ที่ไม่ได้รับอนุมัติ (ตรวจด้วย `git diff --stat` เทียบรายการ §3)
- 13/13 รหัสผ่านเกณฑ์ §4 + test ใหม่ครอบทุก mutation ที่แก้
- 0 mutation ที่แก้แล้วยังไม่มี pending/success/error
- วัดผลจริงกับเจ้าหน้าที่ (เวลาทำงานสำเร็จ, จำนวน error, การส่งซ้ำ) เป็นงานแยกหลัง deploy — รอบนี้ไม่แต่ง baseline

## 7. ข้อตัดสินใจหลัง Review gate (rev.1 — เดิมเป็นสมมติฐาน)

1. **FORM-01:** 3 ปุ่มแยก (`ร่าง` / `ตั้งเวลา` / `ส่งเลย`) — ปุ่มเดิม "บันทึกแบบร่าง" ทำให้เข้าใจผิด
2. **FLOW-04:** เปลี่ยนพฤติกรรมจาก redirect → in-place success + `router.refresh()`; `?ok=` toast ของหน้า case ถูกแทนที่ด้วย success banner รายฟอร์ม (E2E ที่ assert `?ok=` ต้องอัปเดตพร้อมกัน)
3. **FLOW-03:** ใช้ query param `return` (ไม่ใช้ sessionStorage) — ส่งผ่าน URL/`searchParams` เท่านั้น ไม่ผ่าน redirect ของ server action (FLOW-04 ลบ redirect แล้ว)
4. **NET-02:** ข้อความ 401 มีลิงก์กลับ login; เพิ่ม field `code` ใน `ApiFail` type
5. **A11Y-03:** ยอมให้ base `DialogContent` มี `max-height` และลบ override ซ้ำใน 3 caller ที่ workaround อยู่แล้ว
6. **FLOW-01:** permission helper อยู่ใน `require-staff.ts` (export `resolveAllowedRoles` + เพิ่ม `canUseSupervisorAction`) — ไม่สร้าง `permissions.ts` ใหม่, signature เป็น async เสมอ
