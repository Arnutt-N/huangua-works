/**
 * § RETIRED หลัง migration 0031 (T5 contract step 9) — plaintext column ถูกลบแล้ว
 * script เดิม join ผ่าน chat_conversations.line_user_id ที่ไม่มีอยู่ รันต่อไม่ได้
 */
throw new Error(
  '[backfill-conversation-identity] RETIRED หลัง migration 0031 — plaintext column ถูกลบแล้ว (T5 contract step 9)'
);
