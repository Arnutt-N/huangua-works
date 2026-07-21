#!/usr/bin/env bash
#
# backup.sh — สำรองข้อมูล PostgreSQL สำหรับ อบต.หัวงัว citizen-help
# PDPA critical — ข้อมูลประชาชนต้องมีสำเนาสำรองเผื่อกรณี DB พัง/ถูกลบ
#
# วิธีใช้:
#   1. ตั้งค่า env vars ใน .env.local หรือ export ก่อนรัน:
#      - DATABASE_URL — Postgres connection string
#      - BACKUP_DIR — โฟลเดอร์เก็บ backup (default: ./backups)
#      - BACKUP_RETENTION_DAYS — จำนวนวันเก็บ (default: 7)
#   2. รัน: ./scripts/backup.sh
#
# สำหรับ Vercel ต้องรันจาก external cron (เช่น cron-job.org) เพราะ serverless ไม่มี persistent FS
# แนะนำ: รัน cron รายวัน 02:00 UTC+7 (หลัง cron stats-refresh 03:00 — เลื่อนเป็น 02:30 แทน)
#
# Exit codes:
#   0 = สำเร็จ
#   1 = env var ไม่ครบ
#   2 = pg_dump ล้มเหลว
#   3 = upload ล้มเหลว (ถ้าตั้ง BACKUP_UPLOAD_URL)

set -euo pipefail

# ─── env ───
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
DATE=$(date +"%Y-%m-%d")
FILE="$BACKUP_DIR/huangua-$TIMESTAMP.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup → $FILE"

# ─── dump + gzip ───
# --no-owner --no-privileges เพื่อให้ restore ข้าม environment ได้
# --clean --if-exists สำหรับ restore ที่ drop existing objects ก่อนสร้างใหม่
if ! pg_dump "$DATABASE_URL" \
    --no-owner --no-privileges \
    --clean --if-exists \
    --no-tablespaces \
    | gzip -9 > "$FILE"; then
  echo "[$(date)] ERROR: pg_dump failed" >&2
  exit 2
fi

SIZE=$(du -h "$FILE" | cut -f1)
echo "[$(date)] Backup created: $FILE ($SIZE)"

# ─── checksum ───
sha256sum "$FILE" > "$FILE.sha256"
echo "[$(date)] Checksum: $(cat "$FILE.sha256")"

# ─── upload (optional) ───
if [ -n "${BACKUP_UPLOAD_URL:-}" ]; then
  echo "[$(date)] Uploading to $BACKUP_UPLOAD_URL..."
  if ! curl -sSf -X POST \
      -H "Authorization: Bearer ${BACKUP_UPLOAD_TOKEN:-}" \
      -F "file=@$FILE" \
      -F "checksum=@$FILE.sha256" \
      "$BACKUP_UPLOAD_URL"; then
    echo "[$(date)] ERROR: upload failed" >&2
    exit 3
  fi
  echo "[$(date)] Upload OK"
fi

# ─── rotate (ลบไฟล์เก่ากว่า RETENTION_DAYS) ───
echo "[$(date)] Rotating backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "huangua-*.sql.gz*" -type f -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] Rotation done"

# ─── summary ───
REMAINING=$(find "$BACKUP_DIR" -name "huangua-*.sql.gz" -type f | wc -l | tr -d ' ')
echo "[$(date)] Backup complete — $REMAINING files retained in $BACKUP_DIR"
exit 0
