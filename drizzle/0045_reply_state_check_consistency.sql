-- § ข้อ 13: schema, migration, snapshot ต้องประกาศ CHECK ตัวเดียวกัน
-- 0042 เพิ่ม constraint นี้ด้วย DDL มาแล้ว (แต่ schema/snapshot ไม่ได้บันทึก)
-- ทำ idempotent: เพิ่มเฉพาะเมื่อยังไม่มี เพื่อให้ replay fresh DB ไม่ชนของ 0042
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'line_webhook_events_reply_state_check'
  ) THEN
    ALTER TABLE "line_webhook_events" ADD CONSTRAINT "line_webhook_events_reply_state_check"
      CHECK ("line_webhook_events"."reply_state" IN ('pending', 'none', 'expired'));
  END IF;
END $$;
