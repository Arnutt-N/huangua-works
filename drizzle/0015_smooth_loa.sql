CREATE TYPE "public"."budget_status" AS ENUM('unspecified', 'has_budget', 'awaiting_budget');--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "budget_status" "budget_status" DEFAULT 'unspecified' NOT NULL;--> statement-breakpoint
ALTER TABLE "cases" ADD COLUMN "legacy_responsible_raw" text;--> statement-breakpoint
ALTER TABLE "legacy_responsible_map" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
-- § seed ค่าดิบผู้รับผิดชอบ 10 ค่าจากทะเบียน Excel (decided_by system = ยังไม่มีคนตัดสิน)
-- department/assigned เป็น NULL = ยังไม่ตัดสิน dry-run จึงค้าง blocked จนกว่า staff จะกำหนด
INSERT INTO "legacy_responsible_map" ("raw", "department_id", "assigned_to", "decided_by") VALUES
  ('งานไฟฟ้า', NULL, NULL, 'system'),
  ('กองช่าง', NULL, NULL, 'system'),
  ('งานป้องกันฯ', NULL, NULL, 'system'),
  ('นายช่างโยธา', NULL, NULL, 'system'),
  ('งานประปา', NULL, NULL, 'system'),
  ('ผู้ช่วยช่างสำรวจ', NULL, NULL, 'system'),
  ('งานกองช่างภาคสนาม', NULL, NULL, 'system'),
  ('งานโยธา', NULL, NULL, 'system'),
  ('สำนักปลัด-กองช่าง', NULL, NULL, 'system'),
  ('วิศวกร', NULL, NULL, 'system');