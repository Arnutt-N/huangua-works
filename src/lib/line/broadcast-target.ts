import { z } from 'zod';

// § เป้าหมาย broadcast เป็น discriminated union ใน JSON — ids คือ PK ภายในของ line_users
// (line_users.id) ไม่ใช่ LINE user id ดิบ แปลงเป็น raw id เฉพาะตอนส่งใน broadcast-service
// เพื่อไม่ให้ raw id รั่วไปเก็บใน chat_broadcasts.target (กันชน T5 pseudonymization)
export type BroadcastTarget =
  | { kind: 'all' }
  | { kind: 'line_user_ids'; ids: string[] };

export const broadcastTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({
    kind: z.literal('line_user_ids'),
    ids: z.array(z.string().min(1)).min(1).max(5000),
  }),
]);

/** § อ่าน target จาก DB/legacy เฉพาะรูปที่รู้จัก — ค่าเพี้ยนต้อง invalidate ไม่ใช่ขยายเป็นส่งทุกคน */
export function parseBroadcastTarget(raw: unknown): BroadcastTarget | null {
  if (raw === 'all') return { kind: 'all' };
  const parsed = broadcastTargetSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
