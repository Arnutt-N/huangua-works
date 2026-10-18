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

/** อ่าน target จาก DB/legacy อย่าง defensive — ค่าไม่รู้จักหรือรูปเพี้ยนถือเป็นส่งทุกคน */
export function parseBroadcastTarget(raw: unknown): BroadcastTarget {
  if (raw && typeof raw === 'object') {
    const obj = raw as { kind?: unknown; ids?: unknown };
    if (obj.kind === 'line_user_ids' && Array.isArray(obj.ids)) {
      const ids = obj.ids.filter((x): x is string => typeof x === 'string' && x.length > 0);
      if (ids.length > 0) return { kind: 'line_user_ids', ids: [...new Set(ids)] };
    }
    if (obj.kind === 'all') return { kind: 'all' };
  }
  // legacy text 'all' หรือค่าอื่นที่ service เดิมไม่เคยอ่าน
  return { kind: 'all' };
}
