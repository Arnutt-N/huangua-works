# PRP-Plan: จำกัดสิทธิ์การอ่านไฟล์สื่อ (media read access)

- วันที่: 28 ตุลาคม 2569
- PRD: `docs/prd-media-read-access.md` (ตอบคำถามครบ 4 ข้อแล้ว)
- Branch: `fix/media-presigned-read`
- Tranche: 5 (T1–T5) เรียงตาม dependency

## คำตอบที่ล็อกไว้

| คำถาม | คำตอบ | เหตุผล |
|---|---|---|
| Q1 read path | **Presigned 5 นาที** | Vercel จำกัด response 4.5 MB แต่ไฟล์ใหญ่สุด 10 MB — proxy พังกับไฟล์ 4.5-10 MB |
| Q2 data shape | **เพิ่ม `storage_key` + คง `url` เป็น fallback** | แถวเก่ารูปแบบ URL อาจต่างกัน · rollback ได้ · ไม่มีสองแหล่งความจริงหลัง cutover |
| Q3 ปุ่มคัดลอก URL | **ลบ** | URL ตายใน 5 นาที · ไม่มี doc · ไม่มีใครใช้ |
| Q4 `cases.attachments` | **งานย่อยใน tranche นี้** | รับ URL จาก public endpoint ไม่ต้อง login · ยังไม่มีหน้า render แต่เป็น URL ภายนอกที่รอวันถูกใช้ |

---

## T1: `readUrlForKey()` — เลิก dead presign

**ไฟล์:** `src/lib/storage.ts`, `src/lib/storage.test.ts`

`getPresignedUrl()` วันนี้เซ็น `PutObjectCommand` และไม่มี caller (dead)
แทนที่ด้วยตัวที่เซ็น `GetObjectCommand` พร้อม header ที่ต้องการ:

```ts
export interface ReadUrlOptions {
  contentType?: string;
  /** inline สำหรับรูป, attachment สำหรับที่เหลือ (กัน stored-XSS) */
  disposition?: 'inline' | 'attachment';
  filename?: string;
  expiresIn?: number; // default 300, ไม่เกิน 900
}

export async function readUrlForKey(key: string, opts?: ReadUrlOptions): Promise<string>
```

ใส่ `ResponseContentType` และ `ResponseContentDisposition`
(ตรวจแล้วว่า `GetObjectCommandInput` รองรับทั้งคู่) — ได้ A4/A5 โดยไม่ต้อง proxy
`nosniff` มาจาก S3 response ของ `response-content-type` + `ResponseContentDisposition`
ถ้า provider ไม่ส่ง `nosniff` ตาม ให้ถือว่า A5 ไม่ผ่านแล้วประเมินซ้ำ (ดูความเสี่ยง R2)

ลบ `getPresignedUrl` และ import `PutObjectCommand` ที่เหลือใช้แค่ใน `uploadFile`

**เกณฑ์ผ่าน:** unit test เซ็นแล้ว URL มี query `X-Amz-Signature`, `response-content-disposition`
ตรงกับที่ขอ, และ `expiresIn` เกิน 900 ถูก clamp

---

## T2: schema + migration + backfill

**ไฟล์:** `src/lib/db/schema.ts`, `drizzle/0035_media_storage_key.sql`,
`drizzle/meta/0035_snapshot.json`, `drizzle/meta/_journal.json`,
`scripts/backfill-media-storage-key.ts`

เพิ่มคอลัมน์ nullable ทั้งสองตาราง:

| ตาราง | คอลัมน์ใหม่ |
|---|---|
| `media_files` | `storage_key` text null |
| `chat_messages` | `storage_key` text null |

index ไม่ต้องเพิ่ม — การอ่าน resolve จาก id ไม่ใช่จาก key

`scripts/backfill-media-storage-key.ts` ตามแบบ `backfill-bot-consent.ts`:

- default dry-run, `--apply` จึงเขียน
- ใช้ `keyFromUrl()` จาก `src/lib/storage.ts` (มีแล้วจาก #154)
- เลือกเฉพาะแถวที่ `storage_key IS NULL AND <url คอลัมน์> IS NOT NULL`
- report จำนวน: อัปเดตได้ / ข้ามเพราะ URL ไม่ตรงรูปแบบกลุ่ม (พิมพ์ตัวอย่าง 5 แถวแรกที่ข้าม)
- **ไม่ลบ `url`** — เก็บไว้เป็น fallback

**เกณฑ์ผ่าน:** รัน dry-run บน local ได้ตัวเลขจริง · รัน `--apply` ซ้ำได้ไม่เปลี่ยนอะไร (idempotent
เพราะกรอง `storage_key IS NULL`)

---

## T3: เขียน `storage_key` ตอนสร้าง และอ่านผ่าน route ที่ตรวจสิทธิ์

**ไฟล์:** `src/lib/line/media-ingest.ts`, `src/lib/line/conversation/message-service.ts`,
`src/app/api/line/admin/media/route.ts`, `src/app/api/line/admin/conversations/[id]/route.ts`,
`src/app/api/line/admin/media/[id]/read-url/route.ts` (ใหม่)

### T3a — เขียน key

`ingestLineMedia` คืน `key` มาด้วย alongside `url` (หรือเลิกคืน `url` เลย แล้วให้ caller
ใช้ key อย่างเดียว — ดู R3) `attachInboundMedia` และ `recordInboundMessage` เขียน `storageKey`
`POST /api/line/admin/media` เขียน `storageKey` ด้วย

### T3b — route ออก presigned URL

`GET /api/line/admin/media/[id]/read-url` และ
`GET /api/line/admin/conversations/[id]/messages/[messageId]/read-url`

- `requireStaffApi(ADMIN_ROLES)` / `STAFF_ROLES` ตามที่ไฟล์ปลายทางใช้อยู่
- รับ **id เท่านั้น** ไม่รับ key จาก client (กัน IDOR)
- resolve: `storage_key` ก่อน ถ้า null ใช้ `keyFromUrl(url)` ถ้าได้ null คืน 409
- ตั้ง `disposition` จาก `mime_type` ของแถว: `image/jpeg|png|gif|webp` → `inline`, อื่น → `attachment`
- คืน `{ url, expiresIn }` ไม่คืน key

### T3c — ปิดรอยรั่วใน GET ที่มีอยู่

`GET /api/line/admin/media` ส่งทั้งแถวรวม `url` · `GET conversations/[id]` ส่งทั้งแถวรวม
`mediaUrl` ทั้งคู่ทำให้ A3 ไม่ผ่าน ต้อง map เป็น DTO ที่ไม่มี URL และไม่มี key
(ส่ง `hasMedia: boolean` แทน)

**เกณฑ์ผ่าน:** เรียก API แล้ว grep response ไม่เจอ `S3_ENDPOINT` · เรียก read-url ด้วย id
ของแถวที่ไม่มีสิทธิ์ได้ 403 · เรียกด้วย URL ปลอมได้ 409 ไม่ใช่ 500

---

## T4: เปลี่ยน client ให้ใช้ read-url

**ไฟล์:** `src/app/admin/chat/_components/message-bubble.tsx`,
`src/app/admin/files/files-client.tsx`, `src/app/admin/chat/_lib/api.ts`,
`src/app/admin/_lib/admin-api.ts`, `src/app/admin/chat/_lib/types.ts`

- `Message` เลิกมี `mediaUrl` เปลี่ยนเป็น `hasMedia: boolean` + โหลด presigned URL เมื่อ
  bubble ใกล้ viewport (lazy) เก็บใน local state มี cache ตาม id
- รูปที่ presign ไม่สำเร็จ แสดง placeholder เดิม (มีอยู่แล้วที่ `message-bubble.tsx:124`)
- `files-client.tsx` ทำแบบเดียวกัน + **ลบปุ่ม "คัดลอก URL"** และ `copyUrl()` ทั้งฟังก์ชัน
- ลบ `<a href target="_blank">` ที่เปิด URL ตรง — เปลี่ยนเป็นกดแล้วขอ read-url ใหม่
  (เพราะ URL ที่ฝังไว้อาจหมดอายุ)

**เกณฑ์ผ่าน:** `grep -c "mediaUrl" src/app/admin` เหลือ 0 · เปิดหน้าแชทด้วย bucket private
เห็นรูป · รอ 6 นาทีแล้วกดลิงก์เดิม → ได้ 403 (พิสูจน์ A2) แล้วกดใหม่ได้ URL ใหม่

---

## T5: ปิดช่อง `cases.attachments`

**ไฟล์:** `src/lib/validation.ts`, `src/lib/cases/intake.ts`, `src/app/api/cases/submit/route.ts`

ปัจจุบัน `attachments[].url` รับ URL ภายนอกได้จาก endpoint ที่ไม่ต้อง login
เปลี่ยนเป็น:

- ถ้า URL ขึ้นต้นด้วย `${S3_ENDPOINT}/${bucket}/` → เก็บ `key` (แปลงด้วย `keyFromUrl()`)
- ถ้าไม่ใช่ → ปฏิเสธ 400 พร้อมข้อความไทย (ไม่ใช่ปล่อยผ่านเงียบ ๆ)
- `cases.attachments` เก็บ `{ key, type, size }` แทน `{ url, type, size }`

⚠️ **ยังไม่มีผู้เขียน `attachments` จริง** (ฟอร์ม intake ไม่ส่งค่านี้ — grep = 0 ใน
`src/app/intake/intake-form.tsx`) การเปลี่ยน shape จึงไม่มีข้อมูลจริงให้ migrate
แต่ต้องคงการรับ field ไว้เพราะ schema ยังประกาศ — ถ้าจะลบทิ้งทั้ง field เป็นทางเลือกที่
ปลอดภัยกว่า ดู R5

**เกณฑ์ผ่าน:** POST `/api/cases/submit` พร้อม `attachments[0].url = https://evil.example/x.jpg`
ได้ 400 · ด้วย URL ของ storage เราเองได้ 201 และเก็บเป็น key

---

## Throughput checkpoint

- **Blocking first steps:** T1 → T2 → T3 เรียงลำดับ (T3 ต้องมี T1/T2) · T4 ต้องมี T3 · T5 อิสระ
- **Independent workstreams:** T5 แยกทำขนานได้ (ไฟล์ไม่ทับกับ T1-T4 ยกเว้น `validation.ts`)
- **Shared mutable state:** `storage.ts` ถูกแตะโดย T1 เท่านั้น · `schema.ts` โดย T2 เท่านั้น
- **Smallest safe decomposition:** T1-T4 ต้องคนเดียวเพราะ T3/T4 ต้องตกลง shape ของ DTO
  ร่วมกัน · T5 แยกได้

## ลำดับ commit

1. `test(storage): red — readUrlForKey เซ็น GetObject พร้อม disposition`
2. `feat(storage): readUrlForKey แทน dead getPresignedUrl`
3. `feat(db): เพิ่ม storage_key + backfill script`
4. `test(media): red — read-url route ปฏิเสธ key จาก client และ 409 เมื่อ URL ผิดรูปแบบ`
5. `feat(media): read-url route + ปิด url ใน GET ที่มีอยู่`
6. `refactor(admin): client ใช้ read-url + ลบปุ่มคัดลอก URL`
7. `fix(intake): ปฏิเสธ attachments URL ที่ไม่ใช่ storage ของเรา`

## ความเสี่ยง

| # | ความเสี่ยง | ระดับ | ทางรับมือ |
|---|---|---|---|
| R1 | `S3_*` ยังไม่ตั้งบน prod → ทดสอบ A1 ไม่ได้ | HIGH | ต้องตั้งก่อนเริ่ม T3 · ถ้าไม่ได้ ใช้ MinIO local ทดสอบแทนและเลื่อน A1 |
| R2 | provider ไม่ส่งค่า `response-content-disposition` ตามที่เซ็น (Supabase บางเวอร์ชันเพี้ยน) | MEDIUM | ทดสอบจริงใน T1 ก่อนไป T3 · ถ้าไม่ทำงาน เปลี่ยนเป็น proxy เฉพาะไฟล์ที่ไม่ใช่รูป |
| R3 | `ingestLineMedia` คืนทั้ง `url` และ `key` ทำให้มีสองทางเขียน | MEDIUM | ให้คืน `key` อย่างเดียว แล้วให้ caller เก็บ key — URL สร้างตอนอ่านเท่านั้น |
| R4 | แถวเก่าที่ `keyFromUrl` คืน null จะเปิดไม่ได้หลัง cutover | MEDIUM | backfill dry-run ก่อน · นับจำนวนที่ข้าม · ถ้ามีมาก ให้คง fallback `url` ไว้สำหรับแถวนั้นเป็นการถาวร |
| R5 | `cases.attachments` ไม่มีผู้เขียนจริง — แก้ shape อาจเป็นการแก้ปัญหาที่ไม่มีอยู่ | LOW | พิจารณาลบ field ทิ้งแทน · ถ้าเก็บไว้ ให้แก้แค่ validation ไม่แตะ intake |
| R6 | ลบปุ่มคัดลอก URL ทำให้แอดมินที่ใช้อยู่เสีย workflow | LOW | ไม่มีหลักฐานการใช้งาน (no doc, no reader) · ถ้ากังวล ให้ถามผู้ใช้ก่อน merge |

## สิ่งที่ไม่อยู่ในแผนนี้

- การย้าย provider (Supabase → R2)
- การเข้ารหัส at rest
- สิทธิ์ระดับไฟล์ (แยกตามเจ้าของเคส)
- ฟีเจอร์แชร์ไฟล์ให้คนนอก (token + วันหมดอายุ)
- `broadcast.imageUrl` / quick-reply icon — URL ที่แอดมินพิมพ์เอง ไม่ใช่ข้อมูล citizen
