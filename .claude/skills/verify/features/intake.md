# แจ้งเรื่องใหม่ (intake)

ผู้ใช้ทั่วไปแจ้งเรื่องร้องเรียนผ่านฟอร์มสาธารณะที่ `/intake` — กรอกชื่อ เลขบัตรประชาชน หมวด หัวเรื่อง รายละเอียด ที่อยู่ (province → district → subdistrict → village) แล้วติ๊กยินยอม PDPA ก่อนส่ง เมื่อส่งสำเร็จได้เลขติดตามรูปแบบ `HG…` กลับมา

## Sub-features

- `intake-open` เปิดฟอร์มเปล่า ได้ cascade จังหวัดอัตโนมัติ
- `intake-validate` validation client-side บล็อกช่องว่าง ไม่ยิง network
- `intake-geography` เลือกจังหวัด→อำเภอ→ตำบล→หมู่บ้าน เปลี่ยนจังหวัดทำให้ downstream reset
- `intake-submit` ส่งสำเร็จ → หน้า "รับเรื่องเรียบร้อย" + tracking code + แถว `cases`
- `intake-dedup` ส่ง title+description เดิมซ้ำภายใน 7 วัน → ปฏิเสธ

## How to get to it (user POV)

- เปิด `http://localhost:3000/intake` ตรงๆ ในเบราว์เซอร์
- คลิกปุ่ม "แจ้งเรื่องใหม่" จาก landing (`/`) — ปรากฏใน Navbar, Hero, CTA, และ Footer
- เปิด `/intake?liffmock=<LINE_USER_ID>` เพื่อจำลอง session LINE (ต้องรัน dev ด้วย `LIFF_E2E_MOCK=1`) — ในโหมดนี้ช่องเลขบัตรประชาชนหายไป และ banner `liff-auth-banner` ปรากฏ
- ช่องที่กรอกได้จริง: ชื่อ, เลขบัตรประชาชน (เว็บอย่างเดียว), หมวด, หัวเรื่อง, รายละเอียด, รายละเอียดเพิ่มเติม, เบอร์ติดต่อ (ไม่บังคับ), ชื่อหมู่บ้าน (ไม่บังคับ), ที่อยู่ cascade, กล่องไฟล์แนบ (ปิดไว้ ข้อความ "ยังไม่เปิดใช้งานในเฟสนี้"), consent

## Driving it with Playwright

Preconditions:

- dev server ตอบ 200 ที่ `/intake` และ geography ไม่ว่าง (doctor ข้อ 4 ใน SKILL.md)
- rate-limit `submit` ถูกล้าง: `await resetRateLimits(rateLimitKey('submit', '::1'))`

- **เปิดฟอร์ม.** `await page.goto('/intake')`. ปุ่ม `ส่งเรื่อง` และช่อง `ชื่อ - นามสกุล`, `เลขบัตรประชาชน 13 หลัก`, `หมวดเรื่อง`, `หัวเรื่อง`, `รายละเอียด` ปรากฏ
- **validation ก่อนกรอก.** คลิก `ส่งเรื่อง` ทั้งที่ฟอร์มว่าง. `page.getByRole('button', { name: 'ส่งเรื่อง' }).click()`. ข้อความ `กรุณากรอกชื่อ-นามสกุล`, `เลขบัตรประชาชนไม่ถูกต้อง (13 หลัก)`, `กรุณายินยอมให้เก็บข้อมูลก่อนส่งเรื่อง` ปรากฏ และไม่มี row ใหม่ใน `cases`
- **กรอกฟิลด์.** `page.getByLabel('ชื่อ - นามสกุล').fill('ทดสอบ E2E Playwright')`, `page.getByLabel('เลขบัตรประชาชน 13 หลัก').fill('1101200563040')`, `page.getByLabel('หัวเรื่อง').fill('ทดสอบ E2E intake')`, `page.getByLabel('รายละเอียด', { exact: true }).fill('รายละเอียดทดสอบ')`
- **เลือกหมวด.** `page.getByLabel('หมวดเรื่อง').click()` แล้ว `page.getByRole('option').first().click()`
- **กรอก geography cascade.** ใช้ helper — `await fillGeographyCascade(page, geo)` เมื่อ `geo = await loadFirstGeography()`. ทุกครั้งที่เลือกระดับหนึ่ง ระดับถัดไปต้อง `toBeEnabled()` ก่อนคลิก
- **เปลี่ยนจังหวัด → reset.** เลือกจังหวัดคู่กับ `#province` อีกจังหวัด. `#district` มีข้อความ `เลือกอำเภอ`, `#subdistrict` และ `#villageId` เป็น disabled
- **ส่งเรื่อง.** `page.getByRole('checkbox').check()` แล้ว `page.getByRole('button', { name: 'ส่งเรื่อง' }).click()`
- **proof รูปแบบหนึ่ง (UI).** heading `รับเรื่องเรียบร้อย` ปรากฏ. `page.getByTestId('tracking-code')` มีข้อความ matching `/^HG\d{9}$/` และมี `data-case-id` attribute
- **proof รูปแบบที่สอง (DB + view อีกทาง).** เปิด `http://localhost:3000/track?id=<tracking-code>`. หัวเรื่องที่กรอกไว้ปรากฏบนหน้า track — ยืนยันว่าเคสถูกสร้างและเรียกค้นได้จริง
- **dedup.** ส่งฟอร์มเดิม (CID + title + description เหมือนเดิม) อีกครั้งภายใน 7 วัน. ข้อความ `คุณเคยแจ้งเรื่องนี้ไปแล้วภายใน 7 วัน` ปรากฏ และจำนวน row ใน `cases` ไม่เพิ่ม — key ของ dedup คือ `HMAC(cid|title|description)` (`src/lib/dedup.ts:13` window 7 วัน) เลยเปลี่ยน CID หรือ title คือเรื่องใหม่

## Gotchas

- `next dev` 16.3.8 ยิง GET+POST คู่ซ้ำต่อหนึ่งการโหลดหน้า — `POST /api/liff/session` จำกัด 5 ครั้ง/5 นาทีต่อ IP (`failOpen: false`) LIFF spec จึง reset `rate:liff-session:::1` ใน `beforeEach` ไม่ใช่แค่ `beforeAll`
- ช่อง `รายละเอียด` และ `รายละเอียดเพิ่มเติม / จุดสังเกต` มี label คล้ายกัน — ตัวแรกใช้ `{ exact: true }` ไม่งัน match สองช่อง
- geography ต้องมีข้อมูล seed ก่อน มิฉะนั้น `loadFirstGeography()` throw error ตรงๆ ไม่ให้ TypeError เปล่า
- ช่องค้นหาหมวด (`หมวดเรื่อง`) อาจช้าโหลด — รอ `toBeVisible({ timeout: 30_000 })` ก่อนคลิก
- ทุก spec ลบ row ที่สร้างเองใน `afterAll` — ระวังว่า `e2e/intake.spec.ts` ลบแค่ `dedupHashes` + `cases` + `users` **ไม่ลบ `consentRecords`** (เฉพาะ `intake-liff.spec.ts` กับ `track.spec.ts` ลบ consent) เลยมี consent row ค้างจากการรัน intake เว็บทุกครั้ง
- วัด dedup ด้วยการนับ row ไม่ใช่แค่อยู่บนหน้า — หน้า error อาจมาจาก validation client เหมือนกัน
