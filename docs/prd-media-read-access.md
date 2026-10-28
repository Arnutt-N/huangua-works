# PRD: จำกัดสิทธิ์การอ่านไฟล์สื่อ (media read access)

- วันที่: 28 ตุลาคม 2569
- สถานะ: รอ review (ยังไม่เริ่ม implement)
- ที่มา: `project-log-md/perch/handoff-2569-10-28-prod-schema-fixed.md` § ค้างข้อ 1
- Branch ที่จะใช้: `fix/media-presigned-read`

## 1. ปัญหา

รูปและไฟล์ที่ประชาชนส่งผ่าน LINE ถูกเก็บใน S3 แล้วบันทึก URL เต็มลง DB สองที่
(`media_files.url`, `chat_messages.media_url`) URL นั้นคือ
`${S3_ENDPOINT}/${bucket}/${key}` ตรง ๆ ไม่มีลายเซ็น ไม่มีวันหมดอายุ ไม่มีการยืนยันตัวตน
(`src/lib/storage.ts:38`)

ฝั่งแอดมินเอา URL นั้นไปแสดงตรง ๆ สองที่:

| ไฟล์ | บรรทัด | การใช้ |
|---|---|---|
| `src/app/admin/chat/_components/message-bubble.tsx` | 115-121 | `<img src>` และ `<a href target="_blank">` |
| `src/app/admin/files/files-client.tsx` | 89, 97 | `<img src>` และปุ่ม "คัดลอก URL" |

`GetObjectCommand` ไม่ถูกใช้ที่ไหนเลย (`grep` = 0) และ `getPresignedUrl()` เป็น
dead export ที่เซ็นเฉพาะ `PutObjectCommand`

ความเสี่ยงคือรูปที่ประชาชนส่งมักมีสำเนาบัตรประชาชน ทะเบียนบ้าน หรือรูปผู้ป่วย
ถ้า bucket เป็น public ข้อมูลเหล่านั้นเปิดให้ใครก็ได้ที่เดา URL ถูก
ถ้า bucket เป็น private รูปจะแตกบนหน้าแอดมิน

โครงการลงทุนเรื่อง PDPA ไปแล้ว (CID keyed-HMAC, `consentRecords`, audit log)
ช่องนี้ขัดกับงานเหล่านั้นโดยตรง เพราะเป็นข้อมูลอ่อนไหวที่ไม่มีชั้นป้องกันเลย

## 2. ขอบเขต

### อยู่ในขอบเขต

1. เพิ่มการอ่านแบบมีลายเซ็น (presigned GET) และให้ทุกจุดที่แสดงไฟล์ใช้เส้นทางนั้น
2. เก็บ **key** แทน URL เต็มใน DB สำหรับไฟล์ใหม่ พร้อม backfill ของเดิม
3. เสิร์ฟผ่าน route ของเราเอง เพื่อให้ได้ `Content-Disposition` และ
   `X-Content-Type-Options` ตามแบบที่ `jsk-app` ทำ (มาตรการที่ยังขาดอยู่ 1 ใน 3)
4. ปิด dead export `getPresignedUrl` ที่เซ็นผิดคำสั่ง

### ไม่อยู่ในขอบเขต

- การย้าย provider (Supabase Storage → R2) — แยกงาน
- การเข้ารหัส at rest — เป็นคุณสมบัติของ provider
- สิทธิ์ระดับไฟล์ (แยกตามเจ้าของเคส) — ตอนนี้ทุกคนใน `ADMIN_ROLES` เห็นเท่ากัน
- รูป rich menu — ไม่ผ่าน S3 เลย (ดึงจาก LINE ตรง ๆ ที่ `rich-menus/[id]/image/route.ts`)
  และ `rich_menus.image_url` เป็น URL ของ LINE ไม่ใช่ของเรา
- URL รูปในฟีเจอร์อื่นที่ไม่ใช่สื่อประชาชน (`broadcast.imageUrl`, quick-reply icon)
  — เป็น URL ที่แอดมินพิมพ์เอง ไม่ได้มาจาก citizen

## 3. Acceptance criteria

| # | เงื่อนไข | วิธีพิสูจน์ |
|---|---|---|
| A1 | รูปในหน้าแชทแสดงได้โดยไม่ต้องให้ bucket เป็น public | ตั้ง bucket private แล้วเปิดหน้าแชท เห็นรูป |
| A2 | URL ที่ฝังในหน้าเว็บใช้ได้ชั่วคราวและหมดอายุ | เปิด URL ที่ได้หลังเวลาที่กำหนด ได้ 403 |
| A3 | ไม่มี URL ของ storage ที่ไม่เซ็นหลุดไปถึง client | `grep` response ของ API ไม่เจอ `S3_ENDPOINT` — **ตอนนี้ยังไม่ผ่าน**: `GET /api/line/admin/media` ส่งทั้งแถวรวม `url` และ `GET /api/line/admin/conversations/[id]` ส่งทั้งแถวรวม `mediaUrl` |
| A4 | ไฟล์ที่ไม่ใช่รูปโหลดเป็น attachment ไม่แสดง inline | เปิด PDF ในเบราว์เซอร์ → ดาวน์โหลด ไม่ render |
| A5 | ทุก response มี `X-Content-Type-Options: nosniff` | ตรวจ header |
| A6 | ไม่มี `GetObjectCommand` ที่ไม่ถูกใช้ และไม่มี dead presign export | `grep` |
| A7 | ไฟล์เก่าที่เก็บ URL เต็มยังเปิดได้หลัง backfill | เปิดไฟล์ที่สร้างก่อน deploy |
| A8 | แถวที่ URL ผิดรูปแบบคืน error ที่อ่านรู้เรื่อง ไม่ใช่ 500 | ทดสอบด้วย URL ปลอม |

## 4. ข้อจำกัดและการพึ่งพา

**ต้องตัดสินก่อนเขียนโค้ด:** สองทางที่ให้ผลต่างกันเรื่องภาระ server

| ทาง | ทำงานยังไง | ข้อดี | ข้อเสีย |
|---|---|---|---|
| **A. Presigned URL ระยะสั้น** | เซ็น URL อายุ 5 นาทีส่งให้ client ยิงตรงไป S3 | server ไม่ต้องส่งไบต์ · ไม่ติดเพดาน 4.5 MB | URL หลุดออกนอกระบบได้ในช่วงอายุ; ต้องเซ็นใหม่เมื่อหมดอายุ |
| **B. Proxy ผ่าน route เรา** | `/api/media/[id]` ตรวจสิทธิ์แล้ว stream จาก S3 | ตรวจสิทธิ์ทุกครั้ง; ได้ header ครบ; ไม่มี URL สาธารณะเลย | **ติดเพดาน response 4.5 MB** ซึ่งเล็กกว่าเพดานไฟล์ 10 MB ของเรา |

**เลือก A** — เหตุผลใน § 6

**การพึ่งพา**

- `S3_*` ต้องตั้งบน production ก่อนทดสอบ — ยังไม่ยืนยันว่าตั้งแล้ว (handoff ข้อ 🟠)
- bucket ต้องเป็น private จึงจะพิสูจน์ A1 ได้
- `keyFromUrl()` มีแล้วจาก #154 — reuse ไม่ต้องเขียนใหม่
- ถ้าเลือกทาง B ต้องรู้เพดาน response size ของ Vercel plan ที่ใช้ (รูปสูงสุด 10 MB ตาม `MAX_LINE_MEDIA_BYTES`)

**ข้อจำกัดด้านข้อมูล**

ตารางที่เก็บ URL 2 ตาราง คือ `media_files.url` (เฉพาะไฟล์ที่แอดมินอัปโหลด) และ
`chat_messages.media_url` (สำเนาของไฟล์ที่ประชาชนส่งผ่าน LINE) ทั้งสองตารางไม่มีการ
เชื่อมกันด้วย id — `chat_messages` เก็บ URL เป็นสตริงล้วน การ backfill ต้องทำแยกกัน
และแถวที่ไม่มี `media_url` (เช่นข้อความล้วน) ต้องถูกข้าม

## 5. ตัวชี้วัดความสำเร็จ

- bucket ตั้งเป็น private ได้โดยไม่มีหน้าไหนเสีย (A1 ผ่าน) — นี่คือตัวชี้วัดหลัก
- 0 จุดใน `src/` ที่เอา `mediaUrl` หรือ `url` ไปใช้เป็น `<img src>` โดยตรง
- ไม่มี regression ใน 1205 unit tests เดิม

## 6. คำตอบที่ตัดสินแล้ว

### Q1: ใช้ทาง A (presigned) ไม่ใช่ proxy

**เหตุผลที่เป็นข้อเท็จจริง ไม่ใช่ความเห็น:** Vercel จำกัด response body ที่ **4.5 MB**
(vercel.com/docs/functions/limitations, อ่าน 28 ต.ค. 2569) แต่ `MAX_LINE_MEDIA_BYTES`
คือ **10 MB** (`media-ingest.ts:6`) — ทาง B จะทำให้ไฟล์ 4.5-10 MB อัปโหลดได้แต่ดาวน์โหลด
ไม่ได้ ซึ่งเป็นบั๊กที่เกิดจากเพดาน platform

เงื่อนไขบังคับของการเลือกทาง A:

- route รับ **`mediaId` หรือ `messageId`** เท่านั้น **ห้ามรับ `key` จาก client**
  (กัน IDOR และ SSRF — client ที่ล็อกอินได้จะขอ presign ของ key อะไรก็ได้ถ้าเปิดช่อง)
- ใส่ `ResponseContentDisposition` และ `ResponseContentType` ตอนเซ็น
  (`GetObjectCommandInput` รองรับ ตรวจแล้ว) → ได้ A4/A5 โดยไม่ต้อง proxy
- อายุ 5 นาที ไม่เกิน 15

### Q2: เก็บ `storage_key` เป็นแหล่งความจริงเดียว

เพิ่มคอลัมน์ `storage_key` (nullable) แทนการเขียนทับ `url` เพราะแถวเก่ามี URL ที่รูปแบบ
อาจต่างกัน วิธี cutover:

1. เพิ่ม `storage_key` ทั้ง `media_files` และ `chat_messages`
2. backfill ด้วย `keyFromUrl()` (มีแล้วจาก #154) — แถวที่คืน `null` คงไว้ให้ `url` เป็น fallback
3. เขียนใหม่ที่ `storage_key` เท่านั้น แถวใหม่ตั้ง `url = NULL`
4. `url` ยังอยู่ในตารางเพื่อ rollback แต่ไม่มีโค้ดอ่านหลัง cutover

ไม่เก็บทั้งคู่แบบซิงก์กัน เพราะสองแหล่งความจริงที่ drift ได้โดยไม่มีใครรู้

### Q3: ลบปุ่ม "คัดลอก URL"

URL จะมีอายุ 5 นาที ปุ่มที่ให้ลิงก์ตายใน 5 นาทีคือกับดัก · ปุ่มนี้ไม่มี doc อธิบาย
จุดประสงค์ (อยู่ตั้งแต่ #52) และไม่มีฟีเจอร์ไหนอ่านค่าที่คัดลอกไป
ถ้าต้องการแชร์ไฟล์ให้คนนอกจริง ต้องเป็นฟีเจอร์แยก (token + วันหมดอายุ) ซึ่งอยู่นอกขอบเขตนี้

### Q4: ยังไม่เปิดให้คนนอก — แต่ต้องปิดช่อง `cases.attachments`

`cases.attachments` (`schema.ts:340`) รับ URL จาก `/api/cases/submit` ซึ่ง **ไม่ต้อง login**
(`validation.ts:146-160` บังคับแค่ `http/https`) ผู้ใช้匿名ใส่ URL ภายนอกได้
ปัจจุบันไม่มีหน้าไหน render ค่านี้ (`grep` ใน `src/app/admin/` = 0) จึงยังไม่รั่ว
แต่เป็น URL ภายนอกที่ถูกฝังรอวันมีคนเอาไป render — comment ใน `validation.ts:151-153`
เตือนเรื่องนี้ไว้เองแล้ว

**เพิ่มเข้า PRP-Plan เป็นงานย่อย:** `attachments[].url` ที่ชี้ storage ของเรา → แปลงเป็น key ·
ที่ชี้ที่อื่น → ปฏิเสธตอน validate

## 7. สิ่งที่ยังไม่รู้ (ต้องวัดก่อนตัดสินใจ)

- จำนวนไฟล์จริงใน bucket — ไม่กระทบการเลือกทางแล้ว แต่กระทบเวลา backfill
- ว่า `S3_*` ตั้งบน production แล้วหรือยัง (handoff ข้อ 🟠) — ต้องรู้ก่อนทดสอบ A1

