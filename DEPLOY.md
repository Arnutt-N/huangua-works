# คู่มือ Deploy สำหรับผู้ดูแลระบบ (Non-IT)

> **ระบบรับเรื่องร้องเรียน อบต.หัวงัว**
> คู่มือนี้เขียนให้ผู้ดูแลระบบสามารถทำตามได้ทีละขั้น ใช้เวลาประมาณ 1-2 ชั่วโมง
>
> เมื่อทำเสร็จ เว็บไซต์จะออนไลน์ให้ประชาชนใช้งานได้ผ่านลิงก์ เช่น `https://huangua-citizen-help.vercel.app`

---

## สิ่งที่คุณจะได้เรียนรู้ (ภาพรวม)

เว็บไซต์ของเราใช้บริการออนไลน์ทั้งหมด **5 ตัว**:

| ลำดับ | บริการ | หน้าที่ | ค่าใช้จ่าย |
|---|---|---|---|
| 1 | **GitHub** | เก็บไฟล์โค้ดของเว็บไซต์ | ฟรี |
| 2 | **Supabase** | เก็บข้อมูล (ฐานข้อมูล PostgreSQL และ Storage สำหรับไฟล์ภาพ) | ฟรี |
| 3 | **Upstash** (Redis) | ช่วยป้องกันสแปม (Rate Limiting) และ Live Cache | ฟรี |
| 4 | **cron-job.org** | ตัวตั้งเวลาทำงานอัตโนมัติ (Cron 7 รายการ) | ฟรี |
| 5 | **Vercel** | นำเว็บไซต์ขึ้นออนไลน์สู่สาธารณะ | ฟรี |

> [หมายเหตุ] **ทำไมใช้ cron-job.org แทน Vercel Cron?** Vercel แบบฟรี (Hobby) จำกัดให้รัน Cron ได้เพียง **วันละ 1 ครั้ง** แต่ระบบรับเรื่องร้องเรียนจำเป็นต้องประมวลผลอัตโนมัติหลายส่วนตลอดวัน (ปิดเคสเก่า, ลบ hash ป้องกันสแปม, ลบ audit log ตามอายุ, สรุปสถิติ, ส่งบรอดแคสต์ LINE, สลับ Rich Menu, และ Health check) จึงใช้ cron-job.org ฟรีแทน

> [คำแนะนำ] ทำตามลำดับ 1 -> 2 -> 3 -> 4 -> 5 อย่าข้ามขั้น เพราะแต่ละขั้นจะสร้างรหัสผ่านหรือลิงก์ที่ต้องนำไปใช้ในขั้นถัดไป

---

## ก่อนเริ่ม: เตรียมข้อมูล

ให้เตรียมสิ่งเหล่านี้ให้พร้อม:

- [ ] **อีเมล** (แนะนำอีเมลหน่วยงาน เช่น `@huangua.go.th`) - ใช้สมัครบริการทั้งหมด
- [ ] **เบอร์โทรศัพท์** (บางบริการจำเป็นต้องยืนยันตัวตน)
- [ ] **เว็บเบราว์เซอร์** เช่น Google Chrome หรือ Microsoft Edge (เวอร์ชันล่าสุด)
- [ ] **ไฟล์โค้ด** - อยู่ในโฟลเดอร์โปรเจกต์นี้

> [คำเตือนสำคัญ] จดบันทึกรหัสผ่าน ลิงก์ และคีย์ทุกตัวที่ได้รับ ลงในโปรแกรมจดบันทึกเฉพาะ (เช่น Notepad) แยกไว้ต่างหาก

---

## ขั้นที่ 1: สมัคร GitHub และเตรียมที่เก็บโค้ด

GitHub คือที่เก็บไฟล์โค้ดบนคลาวด์สำหรับนำไปเชื่อมโยงกับ Vercel

### 1.1 สมัคร GitHub
1. เปิดเว็บ **https://github.com/signup**
2. ใส่ **อีเมล** -> **รหัสผ่าน** -> **ชื่อผู้ใช้** (username)
3. กดยืนยันตัวตนและยืนยันอีเมลตามลิงก์ที่ได้รับ

### 1.2 สร้าง Repository (ที่เก็บโค้ด)
1. หลังล็อกอิน คลิกเครื่องหมาย **+** มุมขวาบน -> เลือก **New repository**
2. ตั้งชื่อ เช่น `huangua-citizen-help`
3. เลือก **Private** (ส่วนตัว เพื่อความปลอดภัย)
4. คลิก **Create repository**

### 1.3 อัปโหลดไฟล์โค้ดขึ้น GitHub
ใช้โปรแกรม **GitHub Desktop** (https://desktop.github.com):
1. ติดตั้งแล้วล็อกอินด้วยบัญชี GitHub
2. คลิก **File -> Add local repository**
3. เลือกโฟลเดอร์โปรเจกต์
4. พิมพ์ข้อความในช่อง Summary เช่น `initial commit`
5. คลิก **Commit to main** แล้วคลิก **Push origin**

---

## ขั้นที่ 2: สมัคร Supabase (ฐานข้อมูล PostgreSQL และ Storage)

Supabase ทำหน้าที่เก็บข้อมูลทั้งหมด (เรื่องร้องเรียน, ผู้ใช้, ภูมิศาสตร์, ไฟล์แนบ)

### 2.1 สมัคร Supabase
1. เปิดเว็บ **https://supabase.com**
2. คลิก **Start your project** -> **Sign in with GitHub**
3. อนุญาตให้ Supabase เข้าถึงบัญชี GitHub

### 2.2 สร้าง Project ใหม่
1. คลิก **New project**
2. ตั้งชื่อ เช่น `huangua-citizen-help`
3. ตั้งรหัสผ่านฐานข้อมูล (Database Password):
   - คลิกปุ่ม **Generate a password**
   - จดบันทึกรหัสผ่านนี้เก็บไว้ (ไม่สามารถกู้คืนได้)
4. เลือก Region: **Southeast Asia (Singapore)**
5. คลิก **Create new project** และรอระบบตั้งค่าประมาณ 2 นาที

### 2.3 คัดลอก Connection String (ที่อยู่ฐานข้อมูล)
1. ไปที่เมนู **Project Settings** (ไอคอนรูปเฟืองมุมซ้ายล่าง)
2. เลือก **Database**
3. เลื่อนลงมาที่ส่วน **Connection string** -> เลือกแท็บ **URI**
4. เลือกโหมด **Transaction** (พอร์ต `6543`) - สำหรับ Vercel Serverless:
   ```
   postgresql://postgres.<project>:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
   ```
5. แทนที่ `[YOUR-PASSWORD]` ด้วยรหัสผ่านที่จดไว้ในขั้น 2.2
6. จดบันทึกค่านี้เป็น `DATABASE_URL`

> [ข้อควรทราบเรื่องพอร์ต Connection String]
> - **พอร์ต 6543 (Transaction Mode):** ใช้สำหรับ Vercel Production runtime เพื่อให้รองรับ Serverless connection pooling ได้หลายร้อยคำขอพร้อมกันโดยไม่ล้น pool
> - **พอร์ต 5432 (Session Mode):** ใช้สำหรับการรัน Migration ผ่าน Terminal ในเครื่อง (`npx drizzle-kit push`) หรือรันสคริปต์ seed

### 2.4 ตั้งค่า Supabase Storage (สำหรับภาพถ่ายประชาชนและเจ้าหน้าที่)
ระบบรองรับการแนบภาพถ่ายเรื่องร้องเรียนจากประชาชน (สูงสุด 5 รูป) และภาพผลการดำเนินงานของเจ้าหน้าที่ (Before & After):
1. ไปที่เมนู **Storage** ใน Supabase Dashboard
2. คลิก **New bucket**
3. ตั้งชื่อ Bucket ว่า: `media`
4. ตั้งค่า Bucket เป็น **Private** (ปิด Public bucket เพราะระบบใช้ Presigned URL ที่มีอายุ 15 นาที เพื่อความปลอดภัยของข้อมูลประชาชน)
5. สร้าง S3 Access Keys สำหรับโปรแกรม:
   - ไปที่ **Project Settings** -> **Storage** -> เลื่อนลงไปที่ **S3 Access Keys**
   - คลิก **New access key**
   - จดบันทึกค่า:
     - `S3_ENDPOINT`: `https://<project-ref>.supabase.co/storage/v1/s3`
     - `S3_REGION`: `ap-southeast-1`
     - `S3_BUCKET`: `media`
     - `S3_ACCESS_KEY_ID`: รหัส Access Key
     - `S3_SECRET_ACCESS_KEY`: รหัส Secret Key

---

## ขั้นที่ 3: สมัคร Upstash Redis (สำหรับป้องกันสแปมและ Live Cache)

Upstash Redis ทำหน้าที่จำกัดอัตราการส่งเรื่อง (Rate Limiting) และซิงค์ Live Chat:

### 3.1 สมัคร Upstash
1. เปิดเว็บ **https://upstash.com**
2. คลิก **Login** -> **Login with GitHub**

### 3.2 สร้าง Redis Database
1. คลิก **Create Database**
2. ตั้งชื่อ: `huangua-redis`
3. เลือก Region: **AWS ap-southeast-1 (Singapore)**
4. คลิก **Create**

### 3.3 คัดลอกข้อมูลการเชื่อมต่อ
ในหน้าแสดงข้อมูล Database ส่วน **REST API**:
1. คัดลอก **UPSTASH_REDIS_REST_URL** (รูปแบบ `https://...upstash.io`)
2. คัดลอก **UPSTASH_REDIS_REST_TOKEN** (ต้องยาว >= 16 ตัวอักษร)

---

## ขั้นที่ 4: สมัคร cron-job.org (ตัวตั้งเวลางานอัตโนมัติทั้ง 7 รายการ)

ระบบมีงานอัตโนมัติ 7 รายการที่ต้องตั้งเวลาให้ทำงานผ่าน https://cron-job.org:

### 4.1 สมัคร cron-job.org
1. เปิดเว็บ **https://cron-job.org/en/**
2. คลิก **REGISTER** -> กรอกอีเมลและรหัสผ่าน -> ยืนยันอีเมล

### 4.2 สิ่งที่ต้องเตรียม
- **URL เว็บไซต์:** `https://<ชื่อโปรเจกต์>.vercel.app` (ได้หลัง Deploy ในขั้นที่ 6)
- **CRON_SECRET:** สตริงสุ่มยาว >= 16 ตัวอักษร (สร้างในขั้นที่ 5)

### 4.3 สร้าง Cron Jobs ทั้ง 7 รายการ
ในแดชบอร์ด cron-job.org คลิก **CREATE CRONJOB** สำหรับแต่ละรายการ:

| # | ชื่อ Job | URL Path | Schedule | คำอธิบายงาน |
|---|---|---|---|---|
| 1 | `close-stale` | `/api/cron/close-stale` | `0 8 * * *` | ปิดเคสที่เสร็จสิ้น (done) เกิน 7 วัน (ทุกวัน เวลา 08:00) |
| 2 | `cleanup-hashes` | `/api/cron/cleanup-hashes` | `30 8 * * *` | ลบ hash ป้องกันสแปมที่หมดอายุ (ทุกวัน เวลา 08:30) |
| 3 | `cleanup-audit-logs` | `/api/cron/cleanup-audit-logs` | `0 2 * * *` | ลบประวัติ Audit Logs ที่เก่ากว่ากำหนด (ทุกวัน เวลา 02:00) |
| 4 | `stats-refresh` | `/api/cron/stats-refresh` | `0 9 * * *` | อัปเดตตารางสถิติสรุปรายวัน (ทุกวัน เวลา 09:00) |
| 5 | `broadcast-send` | `/api/cron/broadcast-send` | `*/30 * * * *` | ตรวจสอบและส่ง LINE Broadcast ที่ตั้งเวลาไว้ (ทุก 30 นาที) |
| 6 | `rich-menu-display` | `/api/cron/rich-menu-display` | `0 * * * *` | สลับเปิด/ปิด Rich Menu อัตโนมัติตามช่วงเวลา (ทุก 1 ชั่วโมง) |
| 7 | `ping` | `/api/cron/ping` | `*/15 * * * *` | ตรวจสอบความพร้อมทำงานของระบบ (ทุก 15 นาที) |

**การตั้งค่าในแต่ละ Job:**
1. **URL:** `https://<URL-เว็บของคุณ><URL Path>`
2. **Request Method:** ต้องเลือก **`GET`** เท่านั้น
3. **Request Headers:**
   - Name: `Authorization`
   - Value: `Bearer <CRON_SECRET-ของคุณ>` (มีคำว่า `Bearer ` นำหน้า)
4. **Schedule:** เลือกตามตารางด้านบน

---

## ขั้นที่ 5: สร้างรหัสลับความปลอดภัย 4 รายการ

สร้างสตริงสุ่มยาว ๆ แต่ละตัวไม่ซ้ำกัน (ห้ามใช้ค่าเดียวกัน):

### 5.1 AUTH_SECRET (เซ็น session และ JWT ของเจ้าหน้าที่)
- ความยาว: >= 32 ตัวอักษร
- สร้างผ่าน Terminal: `openssl rand -base64 32`

### 5.2 CID_HMAC_KEY (เข้ารหัสเลขบัตรประชาชน 13 หลัก ตาม PDPA)
- ความยาว: >= 32 ตัวอักษร
- สร้างผ่าน Terminal: `openssl rand -base64 32`

### 5.3 LINE_ID_HMAC_KEY (เข้ารหัสสร้างนามแฝง LINE ID ตาม PDPA)
- ความยาว: >= 32 ตัวอักษร (ห้ามใช้ค่าเดียวกับ CID_HMAC_KEY)
- สร้างผ่าน Terminal: `openssl rand -base64 32`

### 5.4 CRON_SECRET (ยืนยันตัวตนงานอัตโนมัติจาก cron-job.org)
- ความยาว: >= 16 ตัวอักษร
- สร้างผ่าน Terminal: `openssl rand -hex 16`

---

## ขั้นที่ 6: สมัคร Vercel และตั้งค่า Environment Variables

### 6.1 สมัคร Vercel
1. เปิดเว็บ **https://vercel.com** -> ล็อกอินด้วย GitHub
2. คลิก **Add New... -> Project** -> เลือก Import โปรเจกต์ `huangua-citizen-help`

### 6.2 กรอก Environment Variables ใน Vercel
ในหน้า Configure Project ขยายส่วน **Environment Variables** แล้วเพิ่มค่าทั้งหมด:

| Key | Value ตัวอย่าง | ที่มา |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.xxx:[PW]@...pooler.supabase.com:6543/postgres` | ขั้นที่ 2.3 (พอร์ต 6543) |
| `UPSTASH_REDIS_REST_URL` | `https://xxx.upstash.io` | ขั้นที่ 3.3 |
| `UPSTASH_REDIS_REST_TOKEN` | สตริง token จาก Upstash | ขั้นที่ 3.3 |
| `AUTH_SECRET` | สตริงสุ่ม >= 32 ตัวอักษร | ขั้นที่ 5.1 |
| `CID_HMAC_KEY` | สตริงสุ่ม >= 32 ตัวอักษร | ขั้นที่ 5.2 |
| `LINE_ID_HMAC_KEY` | สตริงสุ่ม >= 32 ตัวอักษร | ขั้นที่ 5.3 |
| `CRON_SECRET` | สตริงสุ่ม >= 16 ตัวอักษร | ขั้นที่ 5.4 |
| `AUTH_URL` | `https://<ชื่อโปรเจกต์>.vercel.app` (หรือใส่ชั่วคราวก่อน) | ขั้นที่ 6 |
| `S3_ENDPOINT` | `https://<project-ref>.supabase.co/storage/v1/s3` | ขั้นที่ 2.4 |
| `S3_REGION` | `ap-southeast-1` | ขั้นที่ 2.4 |
| `S3_BUCKET` | `media` | ขั้นที่ 2.4 |
| `S3_ACCESS_KEY_ID` | Access key จาก Supabase | ขั้นที่ 2.4 |
| `S3_SECRET_ACCESS_KEY` | Secret key จาก Supabase | ขั้นที่ 2.4 |
| `LINE_CHANNEL_SECRET` | Channel secret จาก LINE Developers | ตัวเลือกเสริม (LINE OA) |
| `LINE_CHANNEL_ACCESS_TOKEN` | Access token จาก LINE Developers | ตัวเลือกเสริม (LINE OA) |
| `NEXT_PUBLIC_LIFF_ID` | LIFF ID จาก LINE Developers | ตัวเลือกเสริม (LINE LIFF) |

### 6.3 Deploy ครั้งแรก
1. คลิกปุ่ม **Deploy**
2. รอประมาณ 2-3 นาทีจนขึ้นข้อความสำเร็จ
3. จดบันทึกโดเมนที่ได้ เช่น `https://huangua-citizen-help.vercel.app`

---

## ขั้นที่ 7: อัปเดต AUTH_URL และเตรียมฐานข้อมูล (Database Push & Seed)

### 7.1 อัปเดต AUTH_URL ให้ตรงกับโดเมนจริง
1. ใน Vercel ไปที่ **Settings -> Environment Variables**
2. แก้ไข `AUTH_URL` เป็น URL เว็บจริง เช่น `https://huangua-citizen-help.vercel.app` (ห้ามมี `/` ปิดท้าย)
3. ไปที่แท็บ **Deployments** -> คลิกปุ่มจุด 3 จุด -> **Redeploy**

### 7.2 นำโครงสร้างตารางเข้าสู่ฐานข้อมูล (Schema Push)
รันคำสั่งจาก Terminal บนเครื่องคอมพิวเตอร์ของคุณ (ตรวจสอบว่า `.env.local` ชี้ไปยัง Supabase):
```bash
npx drizzle-kit push
```

### 7.3 ใส่ข้อมูลตั้งต้นของระบบ (Seed Data)
รันคำสั่งตามลำดับดังต่อไปนี้:
```bash
# 1. ข้อมูลหน่วยงาน หมวดหมู่เรื่อง และบัญชี Superadmin ตัวแรก
npx tsx scripts/seed.ts

# 2. ข้อมูลจังหวัด อำเภอ และตำบล
npx tsx scripts/seed-geodata.ts

# 3. ข้อมูลหมู่บ้านทั่วประเทศ
npx tsx scripts/seed-villages.ts

# 4. ข้อมูล Intent สำหรับแชตบอทตอบคำถามอัตโนมัติ
npx tsx scripts/seed-faq.ts
```

---

## ขั้นที่ 8: ตรวจสอบความพร้อมก่อนเปิดใช้งานจริง (Pre-Flight Verification)

ก่อนเปิดให้ประชาชนและเจ้าหน้าที่เข้าใช้งานจริง ให้รันเครื่องมือตรวจสอบอัตโนมัติ:

### 8.1 ตรวจสอบข้อมูลตั้งต้นในฐานข้อมูล
```bash
npx tsx scripts/verify-seed-data.ts
```
ผลลัพธ์ที่ถูกต้องควรขึ้นสถานะ `[PASS]` ครบทุกส่วน (Superadmin, Departments, Categories, Geodata, Villages)

### 8.2 ตรวจสอบความพร้อมของระบบภายนอก (Pre-Flight Check)
```bash
npx tsx scripts/verify-production.ts
```
สคริปต์จะทำการทดสอบ:
- สัญญาตัวแปรสภาพแวดล้อม (Environment Contract)
- การเชื่อมต่อ PostgreSQL และวัด Latency
- การเชื่อมต่อ Upstash Redis
- การเชื่อมต่อ S3 Storage
- การเชื่อมต่อ LINE Messaging API และสถานะ LIFF
- ตรวจสอบความปลอดภัยของ Cron Endpoints ทั้ง 7 ตัว (ยิง ping สำเร็จ และ endpoints อื่นติด guard 401 ปลอดภัย)

---

## การแก้ปัญหาที่พบบ่อย (Troubleshooting)

### ปัญหา 1: Vercel Build Failed
- ตรวจสอบว่าไม่มีตัวแปรใดขึ้นต้นด้วย `CHANGE_ME_` หรือ `YOUR_`
- ตรวจสอบความยาวของ Secret: `AUTH_SECRET` (>= 32), `CID_HMAC_KEY` (>= 32), `LINE_ID_HMAC_KEY` (>= 32), `CRON_SECRET` (>= 16)
- ตรวจสอบ `AUTH_URL` ต้องขึ้นต้นด้วย `https://` และห้ามใช้ localhost

### ปัญหา 2: ล็อกอินเข้าแอดมินไม่ได้ (`/admin/login`)
- ตรวจสอบว่าได้รัน `npx tsx scripts/seed.ts` หรือยัง
- บัญชีเริ่มต้นคือ `admin@huangua.go.th` รหัสผ่าน `ChangeMe123!` (ให้เปลี่ยนรหัสผ่านทันทีหลังล็อกอินครั้งแรกที่หน้าโปรไฟล์)

### ปัญหา 3: อัปโหลดภาพถ่ายไม่ผ่าน
- ตรวจสอบว่าสร้าง Bucket ชื่อ `media` ใน Supabase Storage แล้ว
- ตรวจสอบ `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` ใน Vercel

---

## สรุปรายการคำสั่งสำหรับผู้ดูแลระบบ
```bash
# ตรวจสอบ Environment Variables
npx tsx scripts/verify-env.ts

# ตรวจสอบข้อมูล Master Data ในฐานข้อมูล
npx tsx scripts/verify-seed-data.ts

# ตรวจสอบความพร้อมก่อน Go-Live
npx tsx scripts/verify-production.ts

# รันชุดทดสอบระบบทั้งหมด
npx vitest run

# ตรวจสอบความถูกต้องของ Type
npx tsc --noEmit
```
