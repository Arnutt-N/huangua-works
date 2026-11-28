import { and, eq } from 'drizzle-orm';
import { getDb, type DbOrTx } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { chatConversations, chatCsatResponses, lineUsers } from '@/lib/db/schema';
import { resolveRawLineId } from '../identity';
import { generateId } from '@/lib/id';
import type { LineOutgoingMessage } from '../types';
import { recordBotReplies } from '../conversation/message-service';
import type { LineTransport } from '../conversation/transport';

export type CsatRecordResult =
  | { kind: 'recorded'; score: number }
  | { kind: 'duplicate'; score: number }
  | { kind: 'invalid' };

/**
 * Flex สำรวจความพึงพอใจ 1-5 — ปุ่ม postback กลับมาเป็น csat|<roundRef>|<score>
 *
 * § ผูกปุ่มกับรอบปิด (roundRef = resolvedAt ISO) เพื่อให้กดปุ่มเก่าหลังเปิด-ปิดรอบใหม่
 *   ไม่เขียนคะแนนให้รอบใหม่ (ข้อ 10) ปุ่มเดิมที่ไม่มี ref ยังรับได้แบบถอยหลัง
 */
export function buildCsatSurvey(roundRef?: string): LineOutgoingMessage {
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
            data: roundRef ? `csat|${roundRef}|${score}` : `csat|${score}`,
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
  roundRef?: string,
): Promise<void> {
  const survey = buildCsatSurvey(roundRef);
  try {
    await transport.push(lineUserId, [survey]);
  } catch {
    return;
  }
  await recordBotReplies(conversationId, [survey]);
}

/**
 * ส่งสำรวจให้ห้องเดียวจบ (lookup id + ส่ง) — route เรียกบรรทัดเดียว ไม่ต้อง import หลายสัญลักษณ์
 *
 * § ผูกปุ่มกับ resolvedAt ของห้องตอนส่ง เพื่อให้กดปุ่มเก่าไม่เขียนคะแนนให้รอบใหม่ (ข้อ 10)
 */
export async function sendCsatSurveyForConversation(
  conversationId: string,
  transport: LineTransport,
): Promise<void> {
  const lineUserId = await lineUserIdOfConversation(conversationId);
  if (!lineUserId) return;
  const db = await getDb();
  const [conv] = await db
    .select({ resolvedAt: chatConversations.resolvedAt })
    .from(chatConversations)
    .where(eq(chatConversations.id, conversationId))
    .limit(1);
  await sendCsatSurvey(conversationId, lineUserId, transport, conv?.resolvedAt ? conv.resolvedAt.toISOString() : undefined);
}

/** ขอบคะแนน CSAT (ตรงกับ CHECK score 1-5 ใน migration 0024) — parse กับ record ใช้ค่านี้ตัวเดียว */
const CSAT_SCORE_MIN = 1;
const CSAT_SCORE_MAX = 5;

/** แยก postback csat ออกจาก postback อื่น — ผิดรูปคืน null แล้วผู้เรียก log จบ
 * wire ใหม่ `csat|<roundRef>|<score>` ผูกกับรอบปิด; wire เก่า `csat|<score>` ไม่มี ref (ถอยหลังได้) */
export function parseCsatPostback(data: string): { score: number; roundRef?: string } | null {
  const withRef = /^csat\|([^|]+)\|([1-5])$/.exec(data);
  if (withRef) return { roundRef: withRef[1], score: Number(withRef[2]) };
  const bare = /^csat\|([1-5])$/.exec(data);
  if (bare) return { score: Number(bare[1]) };
  return null;
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
  db: DbOrTx,
  conversationId: string,
  score: number,
  resolvedAt: Date | null,
): Promise<CsatRecordResult> {
  // § กัน caller ในอนาคต (ไม่ใช่แค่ postback) ฝังคะแนนนอกช่วง — DB มี CHECK เป็นตาข่ายชั้นสอง
  if (!Number.isInteger(score) || score < CSAT_SCORE_MIN || score > CSAT_SCORE_MAX) return { kind: 'invalid' };
  // § resolvedAt null ไม่มีวันชน unique (NULL ไม่เท่ากันเอง) — รับมาจะไหลไม่จำกัดแถว ปัดทิ้งตรงนี้
  if (resolvedAt === null) return { kind: 'invalid' };
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
  const [conv] = await db
    .select({ lineUserIdHash: chatConversations.lineUserIdHash })
    .from(chatConversations)
    .where(and(eq(chatConversations.id, conversationId)))
    .limit(1);
  if (!conv?.lineUserIdHash) return null;
  const user = await firstOrUndefined(
    db
      .select({ id: lineUsers.id })
      .from(lineUsers)
      .where(eq(lineUsers.lineUserIdHash, conv.lineUserIdHash))
      .limit(1),
  );
  if (!user) return null;
  return resolveRawLineId(db, user.id);
}
