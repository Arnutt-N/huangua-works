/**
 * § RETIRED หลัง migration 0031 (T5 contract step 9) — plaintext column ถูกลบแล้ว
 * script เดิม join ผ่าน line_users.line_user_id ที่ไม่มีอยู่ รันต่อไม่ได้
 * ถ้าต้อง backfill อีกให้เขียน script ใหม่ที่จับคู่ผ่าน hash เท่านั้น ห้ามกู้ plaintext กลับมา
 */
throw new Error(
  '[backfill-line-links] RETIRED หลัง migration 0031 — plaintext column ถูกลบแล้ว (T5 contract step 9)'
);
