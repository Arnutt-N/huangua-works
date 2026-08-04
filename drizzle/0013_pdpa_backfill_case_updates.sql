-- PDPA backfill — ปิดการเผยแพร่ข้อมูลเก่าที่รั่วผ่าน GET /api/cases/[id]
--
-- § ทำไมต้องมี migration ไม่ใช่แค่แก้โค้ด
-- การแก้ใน src/lib/cases/operations.ts มีผลกับแถวที่เขียน "นับจากนี้ไป" เท่านั้น
-- แถวเดิมที่ถูกเขียนไว้ตอน is_public เป็น true อยู่แล้วยังถูกส่งออกทาง endpoint
-- สาธารณะเหมือนเดิมทุกประการ (route กรองแค่ WHERE is_public = true ไม่ดู
-- update_type หรือวันที่) — ถ้าไม่มีไฟล์นี้ ช่องรั่วยังเปิดอยู่สำหรับข้อมูลเก่า

-- 1a) assignment — old_value/new_value เป็น UUID ของ users
--     ไม่มีทางเป็นข้อความที่ตั้งใจเผยแพร่ ปิดได้ทันทีโดยไม่ต้องตัดสินใจเชิงนโยบาย
UPDATE "case_updates"
SET "is_public" = false
WHERE "is_public" = true
  AND "update_type" = 'assignment';
--> statement-breakpoint

-- 1b) เปลี่ยนหน่วยงาน — เก็บ departments.id เป็น UUID เช่นกัน
--
--     § ต้องกรองด้วย comment ไม่ใช่ update_type อย่างเดียว
--     การเปลี่ยน "ความเร่งด่วน" ใช้ update_type 'metadata_change' ตัวเดียวกัน แต่เก็บค่า
--     เป็น 'normal'/'urgent' ที่อ่านออกและผู้แจ้งควรได้รู้ว่าเรื่องตัวเองถูกจัดเป็นด่วนไหม
--     ถ้ากวาดปิดทั้ง type จะปิดข้อมูลที่ควรเปิดไปด้วยโดยไม่ตั้งใจ
UPDATE "case_updates"
SET "is_public" = false
WHERE "is_public" = true
  AND "update_type" = 'metadata_change'
  AND "comment" = 'เปลี่ยนหน่วยงานที่รับผิดชอบ';
--> statement-breakpoint

-- 2) หมายเหตุความคืบหน้า — เป็นข้อความอิสระที่เจ้าหน้าที่พิมพ์เอง
--
--    § เลือกปิดทั้งหมดแทนการคัดแยก เพราะแยกด้วยเครื่องไม่ได้ว่าแถวไหนตั้งใจเผยแพร่
--    จริงกับแถวไหนพลาดจาก default เดิมที่เป็น opt-out และแถวเหล่านี้อาจมีเบอร์โทร
--    หรือชื่อบุคคลที่สามอยู่ตามที่เจ้าหน้าที่พิมพ์
--
--    หลัก fail-closed เดียวกับที่ใช้กับข้อมูลใหม่: ปิดไว้ก่อน แล้วให้เจ้าหน้าที่
--    ทบทวนย้อนหลังเพื่อเปิดเฉพาะที่ต้องการ — การปิดเกินแก้ได้ด้วยการเปิดคืน
--    แต่การเปิดค้างไว้แก้ไม่ได้เมื่อมีคนอ่านไปแล้ว
--
--    ไม่แตะ status_change เพราะเป็นข้อมูลสถานะที่ผู้แจ้งควรได้รู้ และไม่มีข้อความอิสระ
UPDATE "case_updates"
SET "is_public" = false
WHERE "is_public" = true
  AND "update_type" = 'comment';
--> statement-breakpoint

-- 3) เปลี่ยน default ของคอลัมน์ให้ตรงกับนโยบาย — DB เป็น safety net อีกชั้น
--    ถ้าวันหน้ามี code path ใหม่ insert โดยไม่ระบุ is_public จะได้ private ไม่ใช่ public
ALTER TABLE "case_updates" ALTER COLUMN "is_public" SET DEFAULT false;
