# PRD — LINE LIFF สำหรับ /intake และ /track (ประสบการณ์มือถือใน LINE)

> สถานะ: **ร่างรอ Review Gate** — การตัดสินใจ D1–D4 (ท้ายเอกสาร) ใช้ค่าแนะนำไว้ก่อน ต้องได้รับการยืนยันจากเจ้าของระบบก่อนเริ่ม implement
> แหล่งอ้างอิงเจตนาเดิม: `docs/PRD.md` (P2), `docs/tracking-issues.md` (P2-01), `docs/implementation-plan.md` (PR #7)
> หมายเหตุ: PR #7 เดิมอิงสถาปัตยกรรม Supabase Auth — แผนนี้แทนที่ด้วย Auth.js/postgres จริงของโค้ดปัจจุบัน

---

## 1. ปัญหา / ความต้องการ

ประชาชนกลุ่มเป้าหมายหลักคือ**ผู้สูงอายุตำบลหัวงัว** (ดู `PRODUCT.md`) ปัจจุบันเมื่ออยู่ใน LINE แล้วแจ้งเรื่องผ่านเว็บ `/intake` ต้อง:

1. กรอกเลขบัตรประชาชน 13 หลักทุกครั้ง (บังคับโดย `submitCaseSchema.cid`)
2. กรอกชื่อ-นามสกุล + เบอร์โทรทุกครั้ง
3. จำรหัสติดตาม `HN` + 9 หลักเพื่อดูสถานะที่ `/track`

ทั้งที่อยู่ในบัญชี LINE ที่ยืนยันตัวตนได้ การเปิดฟอร์มแบบ LIFF จะตัด friction ทั้งสามข้อ

## 2. ผู้ใช้เป้าหมาย

- ประชาชนที่เพิ่ม LINE OA ของ อบต.หัวงัว เป็นเพื่อนแล้ว (ผู้สูงอายุเป็นหลัก)
- รองรับผู้เปิดลิงก์จากเบราว์เซอร์ปกติ (non-LIFF) — ฟอร์มเดิมต้องใช้ได้เหมือนเดิม 100%

## 3. Scope

**In:**
- LIFF app ครอบ `/intake` และ `/track` (โดเมน `huangua-works.vercel.app`)
- การยืนยันตัวผ่าน LINE ID token (verify ฝั่ง server เท่านั้น)
- Autofill ชื่อ/เบอร์จากโปรไฟล์ + การไม่ต้องกรอก CID (ตาม D1)
- Dedup สำหรับช่องทาง LINE (ปัจจุบันไม่มีเลย)
- หน้า "เรื่องของฉัน" ใน `/track` (ตาม D2)
- ปุ่ม rich menu `type: 'uri'` เปิด LIFF
- อัปเดตข้อความ consent + `/privacy` + `/terms` ให้ครอบข้อมูลโปรไฟล์ LINE (PDPA)
- ทางถอนความยินยอมสำหรับผู้ใช้ที่ไม่มี CID

**Out:**
- การเขียนฟอร์มใหม่เป็น mini-app แยกจาก Next.js ปัจจุบัน
- LINE Login สำหรับ staff `/admin`
- LINE Notify (บริการปิดตัวแล้ว), chat_message.write scope
- การเปลี่ยนแปลงระบบแชทบอท/ห้องแชทเจ้าหน้าที่

## 4. Acceptance Criteria (ตรวจได้)

1. กดปุ่ม rich menu ใน LINE → เปิด `/intake` ใน LIFF → ชื่อ/เบอร์ถูก autofill, ช่อง CID ไม่ปรากฏ (D1) → ส่งเรื่องสำเร็จ ได้รหัสติดตาม และเคสเกิดใน DB พร้อม `metadata.source = 'liff'` + consent record
2. ผู้ใช้ LINE เดียวกันแจ้งเรื่องเดิม (title+description เดิม) ภายใน 7 วัน → ได้ 409 duplicate เหมือนทางเว็บ
3. กด "ติดตาม" → เห็นรายการเคสของตัวเองโดยไม่พิมพ์รหัส (D2) และยังพิมพ์รหัสค้นแบบเดิมได้
4. เปิด `/intake` `/track` จากเบราว์เซอร์ปกติ → พฤติกรรมเหมือนวันนี้ทุกประการ (CID ยังบังคับ)
5. เคสที่ส่งผ่าน LIFF มี audit row และผูก `lineUsers.linkedUserId` ถูกต้อง
6. `POST /api/liff/session` ที่ได้รับ ID token ปลอม/หมดอายุ/aud ไม่ตรง → ปฏิเสธ; ไม่มี path ไหนที่ client ส่ง `lineUserId` ตรงมาโดยไม่ผ่านการ verify
7. ทุก mutation/ข้อความใหม่ผ่าน gates: `tsc` + `eslint` + `vitest run` + Vercel preview ผ่าน
8. ผู้ใช้ LINE ถอนความยินยอมได้โดยไม่ต้องมี CID

## 5. ข้อจำกัด & Dependencies

| ข้อจำกัด | ผลกระทบ |
|---|---|
| LIFF ต้องใช้ **LINE Login channel** แยกจาก Messaging API channel ที่มีอยู่ และต้องอยู่ใน **provider เดียวกัน** | ไม่งั้น `userId` ของประชาชนไม่ตรงกันระหว่างบอทกับ LIFF → ผูกเคสให้คนผิดทันที (ทั้งระบบ key บน `lineUserId`) |
| หนึ่ง LIFF app = หนึ่ง Endpoint URL | Vercel preview ใช้กับ LIFF ตรง ๆ ไม่ได้ ต้องมี LIFF app ที่สองชี้ staging (D4) |
| `NEXT_PUBLIC_*` เป็น build-time env | เพิ่มใน Vercel แล้วต้อง redeploy ถึงมีผล |
| Vercel Hobby + GitHub Actions หยุดอยู่ | gates คือ local + Vercel preview checks |
| ID token ของ LIFF อาจถูกเซ็นด้วยอัลกอริทึม HS256 **หรือ** ES256 | ห้าม verify เองด้วย channel secret อย่างเดียว — ต้องใช้ verify endpoint ของ LINE (ดู PRP §2 ข้อ 1) |

## 6. ตัวชี้วัดความสำเร็จ

- อัตราส่งฟอร์มสำเร็จจากมือถือ (submit/visit) เพิ่มขึ้นเทียบฟอร์มเดิม
- เวลาเฉลี่ยตั้งแต่เปิดฟอร์มถึงส่งสำเร็จลดลง (เป้า: ตัดการพิมพ์ CID 13 หลักออก)
- จำนวนการใช้ "เรื่องของฉัน" เทียบกับการพิมพ์รหัสติดตาม
- อัตราแจ้งซ้ำจากช่องทาง LINE ≈ 0 (dedup ทำงาน)

## 7. การตัดสินใจที่รอยืนยัน (Review Gate)

| # | คำถาม | ค่าที่ตั้งไว้ในแผนนี้ | ทางเลือก |
|---|---|---|---|
| D1 | ใน LIFF ยังบังคับ CID ไหม | **ไม่บังคับ** (identity = LINE ที่ verify แล้ว + dedup ตาม lineUserId) | คงบังคับ ทำแค่ autofill — เหมาะถ้าอบต.ต้องใช้บัตรเป็นหลักฐานทางกฎหมาย |
| D2 | `/track` ทำ "เรื่องของฉัน" อัตโนมัติไหม | **ทำ** (reuse `linkedUserId`) | แค่เปิดหน้าเดิมใน LIFF |
| D3 | LIFF Size | **Full** | Tall |
| D4 | LIFF app ที่สองสำหรับ staging | **มี** | ทดสอบบน prod |
