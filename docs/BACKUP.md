# คู่มือสำรองข้อมูล (Database Backup)

> **PDPA critical** — ระบบเก็บข้อมูลประชาชน (ชื่อ/เบอร์/ที่อยู่/เลขบัตรฯ) ต้องมีสำรองเผื่อ DB พัง/ถูกลบ/โดน ransomware

## สิ่งที่ต้องสำรอง

| อะไร | วิธี | ความถี่ |
|------|-----|--------|
| PostgreSQL database | `scripts/backup.sh` (pg_dump + gzip) | รายวัน |
| Environment variables (.env.production) | manual export + เก็บใน password manager | ทุกครั้งที่เปลี่ยน |
| Vercel project config | export ผ่าน Vercel CLI | เดือนละครั้ง |

## วิธีรัน backup

### 1. ตั้งค่า env vars

```bash
# ใน .env.local หรือ export ก่อนรัน
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
export BACKUP_DIR="./backups"           # default
export BACKUP_RETENTION_DAYS=7          # default
# optional: upload ไป external storage
export BACKUP_UPLOAD_URL="https://..."
export BACKUP_UPLOAD_TOKEN="..."
```

### 2. รัน manual

```bash
chmod +x scripts/backup.sh
./scripts/backup.sh
```

### 3. ตั้ง cron (แนะนำ cron-job.org เพราะ Vercel serverless ไม่มี persistent FS)

**Cron schedule:** `30 19 * * *` (02:30 UTC+7 ทุกวัน — หลัง cron stats-refresh)

cron-job.org payload:
- URL: `https://your-app.vercel.app/api/cron/backup` (ต้องสร้าง endpoint นี้เพิ่ม หรือรันจาก external host)
- Method: POST
- Headers: `Authorization: Bearer {CRON_SECRET}`

> ⚠️ **สำคัญ:** ถ้ารันจาก Vercel Serverless ต้องใช้ external storage (S3/R2/Backblaze) เพราะ filesystem เป็น ephemeral — ไฟล์ที่เขียนจะหายเมื่อ function ปิด

## วิธี restore

```bash
# 1. สร้าง DB ใหม่ (หรือใช้ที่มีอยู่)
createdb huangua_restore

# 2. แตกไฟล์ + restore
gunzip -c backups/huangua-YYYYMMDD-HHMMSS.sql.gz | psql "$DATABASE_URL"

# 3. ตรวจสอบ
psql "$DATABASE_URL" -c "SELECT count(*) FROM cases;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM users;"
```

## ตรวจสอบ backup

แต่ละไฟล์มี `.sha256` checksum คู่กัน — ใช้ตรวจ integrity:

```bash
sha256sum -c backups/huangua-YYYYMMDD-HHMMSS.sql.gz.sha256
```

## Retention policy

- default: **7 วัน** (เก็บ 7 ไฟล์ล่าสุด)
- ปรับได้ใน `BACKUP_RETENTION_DAYS`
- แนะนำ: สำเนา 1 ไฟล์/เดือน ไป cold storage (เช่น R2 standard) เก็บ 1 ปี เพื่อ audit trail

## PDPA compliance

- backup มีข้อมูล PII → ต้องเก็บในที่เข้ารหัส (encrypted at rest)
- การเข้าถึง backup ต้องบันทึก audit log
- การ restore ต้องได้รับอนุมัติจาก DPO
- ลบ backup เมื่อหมดความจำเป็น (ตาม retention policy)

## สิ่งที่ **ไม่** อยู่ใน backup นี้

- ไฟล์แนบ (attachments) — ถ้ามีจริงในอนาคต ต้อง backup แยก (S3/R2 versioning)
- Vercel deployment logs — export แยก
- รหัสผ่านของ users — เก็บเป็น bcrypt hash ใน DB แล้ว (backup มี hash ไม่ใช่ plain text)
