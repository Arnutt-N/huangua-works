import { z } from 'zod';
import { BROADCAST_TEXT_MAX, findActionUriViolation } from '@/lib/contracts';

/**
 * schema ของ broadcast content — route กับ test ใช้ตัวเดียวกัน
 * § เคย mirror schema ไว้ใน test ทำให้แก้ route แล้ว test ยังเขียว
 */
const httpsUrl = z.string().url().refine((u) => u.startsWith('https://'), 'ต้องเป็น https URL');

export const broadcastContentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string().min(1).max(BROADCAST_TEXT_MAX) }).passthrough(),
  z.object({ type: z.literal('image'), originalContentUrl: httpsUrl, previewImageUrl: httpsUrl }).passthrough(),
  z
    .object({ type: z.literal('flex'), altText: z.string().min(1).max(400), contents: z.record(z.string(), z.unknown()) })
    .passthrough()
    .superRefine((value, ctx) => {
      // § flex ส่งถึงผู้ติดตามทุกคน — ต้องกัน action uri ที่ไม่ปลอดภัยตั้งแต่ boundary
      const bad = findActionUriViolation(value.contents);
      if (bad !== null) {
        ctx.addIssue({ code: 'custom', message: `ลิงก์ใน Flex ไม่ปลอดภัยหรือไม่รองรับ (${bad})` });
      }
    }),
]);
