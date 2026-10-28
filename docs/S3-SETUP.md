# ตั้งค่า S3 Storage (คลังรูปภาพ)

> ไฟล์แนบจาก LINE และรูปที่แอดมินอัปโหลดเก็บที่ object storage ผ่าน S3 protocol
> เอกสารนี้บอกว่าต้องตั้ง key อะไร หาจากไหน และกับดักในโค้ดที่ต้องรู้ก่อนตั้ง

## สถานะปัจจุบัน (ตรวจ 28 ต.ค. 2569)

| ที่ | มี `S3_*`? |
|---|---|
| `.env.local` | ❌ ไม่มีเลย |
| `.env.production` | ❌ ไม่มี |
| `.env.local.example` | ❌ ไม่มีแม้แต่ตัวอย่าง |
| `.env.example` | ✅ มีตัวอย่างแบบ comment ไว้ (L79-89) |

**ยังไม่เคยตั้ง `S3_*` ที่ไหนทั้งสิ้น** → `isStorageConfigured()` คืน `false` ทุก environment
ผลคือ รูปจาก LINE ถูกข้ามด้วย `skipped: 'storage_unconfigured'` และ `/admin/files` อัปโหลดไม่ได้

## 5 key ที่ต้องมี

ผู้ให้บริการที่ออกแบบไว้คือ **Supabase Storage ผ่าน S3 protocol** (ไม่ใช่ AWS S3)

| key | ตัวอย่าง | หาจาก |
|---|---|---|
| `S3_ENDPOINT` | `https://<project_ref>.supabase.co/storage/v1/s3` | Dashboard → Storage → S3 Connection |
| `S3_REGION` | `ap-southeast-1` | เดียวกัน |
| `S3_BUCKET` | `case-attachments` | Storage → Buckets |
| `S3_ACCESS_KEY_ID` | — | Storage → S3 Access Keys |
| `S3_SECRET_ACCESS_KEY` | — | เดียวกัน (secret แสดงครั้งเดียว) |

⚠️ `SUPABASE_SECRET_KEY` / `SERVICE_ROLE_SECRET` ใน `secrets/secret-keys.txt` **คนละตัว** กับ S3 access key — ใช้แทนกันไม่ได้

⚠️ `isStorageConfigured()` (`src/lib/storage.ts:51`) เช็คแค่ 3 ตัว: `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
`S3_REGION` และ `S3_BUCKET` มี default (`'auto'` / `'media'`) จึง**ไม่ถูกตรวจ** — ตั้งผิดแล้วระบบไม่ฟ้อง

## ขั้นตอน

### 1. สร้าง bucket

Supabase Dashboard → **Storage** → New bucket

- ตั้งเป็น **private** — โค้ดปัจจุบันคืน public URL ตรง ๆ (`storage.ts:38`) ถ้า bucket public รูปที่ประชาชนส่งมาจะเปิดได้ด้วยใครก็ตามที่เดา URL ถูก
- ซ่อนชื่อ bucket ให้คาดเดายากไม่ช่วยอะไร — key มี `generateId()` แต่นั่นไม่ใช่การยืนยันตัวตน

### 2. สร้าง S3 access key

Dashboard → Storage → **S3 Access Keys** → สร้างใหม่
คัดลอก **ทั้งคู่ทันที** — secret แสดงครั้งเดียว ปิดหน้าแล้วต้องสร้างใหม่

### 3. ใส่ค่า

**Local** — เพิ่มใน `.env.local`:

```bash
S3_ENDPOINT=https://<project_ref>.supabase.co/storage/v1/s3
S3_REGION=ap-southeast-1
S3_BUCKET=<bucket-name>
S3_ACCESS_KEY_ID=<key>
S3_SECRET_ACCESS_KEY=<secret>
```

**Production** — Vercel → Project Settings → Environment Variables → Production
ทำซ้ำกับ Preview ถ้าต้องการให้ PR preview อัปรูปได้

### 4. ตรวจว่าใช้ได้

```bash
# 1) env ครบไหม (ไม่ตรวจ S3 — script ยังไม่รู้จัก key เหล่านี้)
npx tsx scripts/verify-env.ts

# 2) probe host ถึงไหม — ต้อง login แอดมินก่อน
#    GET /api/admin/api-connections?provider=s3
#    หรือกดปุ่มทดสอบในหน้า settings

# 3) อัปโหลดจริงที่ /admin/files
```

`probeS3()` (`src/lib/system/probe.ts:42`) ทำ HEAD แบบไม่เซ็นชื่อ — ถือว่า `connected` ถ้า host ตอบ (403 ก็ผ่าน) แปลว่า**แค่ host มีจริง ไม่ได้ยืนยัน credential** ต้องอัปโหลดจริงถึงจะรู้ว่า key ใช้ได้

## กับดักในโค้ด (ตรวจแล้ว)

### 🔴 URL ที่เก็บใน DB ไม่มีลายเซ็น

```ts
// src/lib/storage.ts:38
return `${process.env.S3_ENDPOINT}/${getBucket()}/${key}`;
```

`getPresignedUrl()` (L46-49) เซ็นเฉพาะ `PutObjectCommand` — **ไม่มี GET presigned เลย** (`GetObjectCommand` = 0 hit)
และ export ตัวนี้ **ไม่มี caller เลย** (`grep` = 0) — เป็นโค้ดตายที่ชี้ว่าเจตนาเดิมคือทำ presigned แต่ทำไม่จบ

แล้ว `message-bubble.tsx:115-121` เอา `mediaUrl` ไป `<img src>` กับ `<a href>` ตรง ๆ
และ `admin/files/files-client.tsx:43-45` มีปุ่ม **"คัดลอก URL"**

→ bucket **public** = รูปบัตรประชาชน/ทะเบียนบ้าน/รูปผู้ป่วยรั่ว
→ bucket **private** = รูปแตกบนหน้าแอดมิน

**ผิดทั้งคู่** นี่คือช่องที่ต้องแก้ที่ตัวโค้ด (presigned GET + เก็บ key แทน URL) ไม่ใช่แก้ด้วยการตั้งค่า bucket

### 🟠 key derivation พังถ้า endpoint มี path prefix

```ts
// src/app/api/line/admin/media/[id]/route.ts:26
const key = row.url.split('/').slice(4).join('/');
```

`slice(4)` ตัดสินว่ามี 3 ส่วนก่อน bucket (`scheme` / `''` / `host`) แล้วข้าม `bucket` — ถูกสำหรับ `http://host/bucket/key`

แต่ Supabase endpoint มี **path 3 ส่วน** ต่อท้าย:

```
https://abc.supabase.co/storage/v1/s3/media/general/xyz.jpg
split('/')  → ['https:', '', 'abc.supabase.co', 'storage', 'v1', 's3', 'media', 'general', 'xyz.jpg']
slice(4)    → 'v1/s3/media/general/xyz.jpg'     ← ผิด (มี v1/s3/media ติดมา)
```

ผล: **ลบไฟล์ใน DB ได้ แต่ object บน S3 ไม่ถูกลบ** (`deleteFile` error ถูก `.catch(() => {})` กลืนไปแล้ว) → ขยะสะสมเงียบ ๆ

ใช้ MinIO local (`http://localhost:9000`) รูปแบบเดิมจะถูก — จึงไม่เห็นปัญหาตอน dev

### 🟡 S3 ไม่อยู่ใน env gate

`scripts/verify-env.ts` มี `S3` = **0 ครั้ง** — `build` ผ่านแม้ไม่มี S3 เลย
(`AGENTS.md § Env contract` ระบุว่าเป็นช่อง "fail silently" ที่รู้อยู่แล้ว)

### 🟡 `/admin/health` ไม่มี S3 probe

`src/app/api/line/admin/health/route.ts` probe แค่ `PostgreSQL`, `Upstash Redis`, `LINE API`, `SSE Broadcaster`, `LIFF Config`
— **ไม่มี S3** ทั้งที่ `probeS3()` มีอยู่แล้วใน `src/lib/system/probe.ts`

## เรื่องเงิน

⚠️ **ตัวเลขข้างล่างผมไม่ได้เปิด dashboard ยืนยัน** — ตรวจ supabase.com/pricing เองก่อนตัดสินใจ

จากความเข้าใจ: Supabase free tier ให้ Storage ~1 GB และ egress ~5 GB/เดือน

ประมาณการจากขนาดงานนี้ — `MAX_LINE_MEDIA_BYTES` = 10 MB/ไฟล์ แต่รูปมือถือจริงมัก 1-3 MB
→ 1 GB ≈ **300-1,000 รูป** ซึ่งเกินพอสำหรับอบต.ขนาดนี้ในหลายปี

### ⚠️ ความเสี่ยงที่ต้องปิดก่อน go-live: free tier pause

Supabase free tier **pause project เมื่อไม่มี activity 7 วัน** → รูปแตกทั้งระบบโดยไม่มีใครแตะโค้ด
(โปรเจกต์พี่น้อง `jsk-app` เจอปัญหานี้จริงบน prod — บันทึกไว้ใน handoff ของเขา)

โปรเจกต์นี้มี `/api/cron/ping` อยู่แล้ว → ตั้ง cron-job.org ยิงทุก ~15 นาที ก็กันได้
ยังต้องยืนยันว่า ping ธรรมดานับเป็น activity พอจะกัน pause หรือไม่

## ทางเลือกอื่น

| ทาง | จุดเด่น | ข้อแลก |
|---|---|---|
| **Supabase Storage** | ไม่ต้องสร้าง account/billing ใหม่ · `.env.example` วางไว้แล้ว | 1 GB · pause 7 วัน |
| **Cloudflare R2** | egress ฟรีไม่จำกัด · ส่วนใหญ่ให้พื้นที่มากกว่า | ต้องสร้าง account + ผูกบัตร |
| **BLOB ใน Postgres** (แบบ jsk-app) | ไม่มี storage แยก | DB โต · backup บวม · serverless ดึงผ่าน pooler ช้า |

**ไม่แนะนำ BLOB สำหรับโปรเจกต์นี้** — Vercel serverless + pool จำกัด + DB ตัวเดียวใช้ทั้ง webhook/admin/cron จะแย่งแบนด์วิดท์กับ query ธุรกิจ

## ที่ยังไม่ได้ทำ

- [ ] เพิ่ม `S3_*` เข้า `scripts/verify-env.ts` (optional group แบบ LIFF — ตั้งครึ่งเดียวต้องฟ้อง)
- [ ] เพิ่ม `S3_*` ตัวอย่างลง `.env.local.example`
- [ ] เพิ่ม S3 probe เข้า `/api/line/admin/health`
- [ ] แก้ `storage.ts` ให้คืน key + presigned GET (งาน `fix/media-presigned-read`)
- [ ] แก้ key derivation ใน `media/[id]/route.ts` ให้รองรับ endpoint ที่มี path prefix
