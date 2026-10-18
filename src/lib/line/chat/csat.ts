import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { chatConversations, chatCsatResponses } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import type { LineOutgoingMessage } from '../types';
import { recordBotReplies } from '../conversation/message-service';
import type { LineTransport } from '../conversation/transport';

export type CsatRecordResult =
  | { kind: 'recorded'; score: number }
  | { kind: 'duplicate'; score: number }
  | { kind: 'invalid' };

/** Flex สำรวจความพึงพอใจ 1-5 — ปุ่ม postback กลับมาเป็น csat|<score> เท่านั้น ไม่มี id ให้ปลอม */
export function buildCsatSurvey(): LineOutgoingMessage {
  return {
    type: 'flex',
    altText: 'ประเมินความพึงพอใจ',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'ประเมินความพึงพอใจ', weight: 'bold', size: 'md' },
          { type: 'text', text: 'การช่วยเหลือครั้งนี้เป็นอย่างไรบ้าง', size: 'sm', wrap: true },
        ],
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [5, 4, 3, 2, 1].map((score) => ({
          type: 'button',
          style: score >= 4 ? 'primary' : 'secondary',
          height: 'sm',
          action: {
            type: 'postback',
            label: String(score),
            data: `csat|${score}`,
            displayText: `ให้ ${score} คะแนน`,
          },
        })),
      },
    },
  } as LineOutgoingMessage;
}

/**
 * ส่ง Flex สำรวจหลังปิดห้อง — best-effort หลัง commit เสมอ
 * ผู้เรียกต้องเรียกหลัง changeMode สำเร็จเท่านั้น ห้ามทำให้ close ล้ม
 */
export async function sendCsatSurvey(
  conversationId: string,
  lineUserId: string,
  transport: LineTransport,
): Promise<void> {
  const survey = buildCsatSurvey();
  try {
    await transport.push(lineUserId, [survey]);
  } catch {
    return;
  }
  await recordBotReplies(conversationId, [survey]);
}

/**
 * ส่งสำรวจให้ห้องเดียวจบ (lookup id + ส่ง) — route เรียกบรรทัดเดียว ไม่ต้อง import หลายสัญลักษณ์
 */
export async function sendCsatSurveyForConversation(
  conversationId: string,
  transport: LineTransport,
): Promise<void> {
  const lineUserId = await lineUserIdOfConversation(conversationId);
  if (!lineUserId) return;
  await sendCsatSurvey(conversationId, lineUserId, transport);
}

/** ขอบคะแนน CSAT (ตรงกับ CHECK score 1-5 ใน migration 0024) — parse กับ record ใช้ค่านี้ตัวเดียว */
const CSAT_SCORE_MIN = 1;
const CSAT_SCORE_MAX = 5;

/** แยก postback csat ออกจาก postback อื่น — ผิดรูปคืน null แล้วผู้เรียก log จบ
 * wire ใหม่มีแค่ score; wire เก่า `csat|<id>|<score>` รับช่วงเปลี่ยนผ่าน (id ถูกเมิน ห้องใช้ของ session) */
export function parseCsatPostback(data: string): { score: number } | null {
  const match = /^csat\|(?:[^|]+\|)?([1-5])$/.exec(data);
  if (!match) return null;
  return { score: Number(match[1]) };
}

const THANK_YOU: Record<number, string> = {
  1: 'ขอบคุณสำหรับคะแนน เราจะนำไปปรับปรุงการให้บริการครับ',
  2: 'ขอบคุณสำหรับคะแนน เราจะนำไปปรับปรุงการให้บริการครับ',
  3: 'ขอบคุณสำหรับคะแนนครับ',
  4: 'ขอบคุณสำหรับคะแนนครับ ดีใจที่ช่วยเหลือได้ครับ',
  5: 'ขอบคุณสำหรับคะแนนเต็มครับ ดีใจที่ช่วยเหลือได้ครับ',
};

/**
 * บันทึกคะแนน CSAT — unique ต่อ (ห้อง, รอบปิด) ห้อง reuse ได้หลายรอบ แต่ละรอบโหวตใหม่ได้
 * resolvedAt อ่านจากห้องตอนแตะ (null สำหรับแถวเก่าก่อนมีคอลัมน์ — null ไม่ชนกันเอง)
 * คืนผล {kind, score} ให้ผู้เรียกตัดสินใจต่อ (ข้อความขอบคุณแยกอยู่ csatThankYou) ไม่ throw
 */
export async function recordCsatResponse(
  conversationId: string,
  score: number,
  resolvedAt: Date | null,
): Promise<CsatRecordResult> {
  // § กัน caller ในอนาคต (ไม่ใช่แค่ postback) ฝังคะแนนนอกช่วง — DB มี CHECK เป็นตาข่ายชั้นสอง
  if (!Number.isInteger(score) || score < CSAT_SCORE_MIN || score > CSAT_SCORE_MAX) return { kind: 'invalid' };
  // § resolvedAt null ไม่มีวันชน unique (NULL ไม่เท่ากันเอง) — รับมาจะไหลไม่จำกัดแถว ปัดทิ้งตรงนี้
  if (resolvedAt === null) return { kind: 'invalid' };
  const db = await getDb();
  // § เขียนครั้งเดียวด้วย upsert — pre-select กัน race ไม่ได้อยู่ดี ปล่อยให้ constraint ตัดสิน
  const [inserted] = await db
    .insert(chatCsatResponses)
    .values({ id: generateId(), conversationId, resolvedAt, score })
    .onConflictDoNothing({ target: [chatCsatResponses.conversationId, chatCsatResponses.resolvedAt] })
    .returning({ score: chatCsatResponses.score });
  if (inserted) return { kind: 'recorded', score: inserted.score };
  // § fallback อ่านแถวรอบเดียวกันเท่านั้น — อ่านข้ามรอบจะเอาคะแนนรอบใหม่มาตอบรอบเก่า
  const [existing] = await db
    .select({ score: chatCsatResponses.score })
    .from(chatCsatResponses)
    .where(and(eq(chatCsatResponses.conversationId, conversationId), eq(chatCsatResponses.resolvedAt, resolvedAt)))
    .limit(1);
  if (existing) return { kind: 'duplicate', score: existing.score };
  return { kind: 'invalid' };
}

export function csatThankYou(score: number): string {
  return THANK_YOU[score] ?? 'ขอบคุณสำหรับคะแนนครับ';
}

/**
 * ดึง raw LINE id ของห้องจาก DB — push ต้องใช้ id จริง ไม่ใช่ placeholder
 * (ปลายทาง push คือ LINE user ของห้องนี้ ไม่เกี่ยวกับ user ที่กดปุ่ม)
 */
export async function lineUserIdOfConversation(conversationId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ lineUserId: chatConversations.lineUserId })
    .from(chatConversations)
    .where(and(eq(chatConversations.id, conversationId)))
    .limit(1);
  return row?.lineUserId ?? null;
}
