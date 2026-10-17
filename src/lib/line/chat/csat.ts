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

/** Flex สำรวจความพึงพอใจ 1-5 — ปุ่ม postback กลับมาเป็น csat|<conversationId>|<score> */
export function buildCsatSurvey(conversationId: string): LineOutgoingMessage {
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
            data: `csat|${conversationId}|${score}`,
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
  const survey = buildCsatSurvey(conversationId);
  try {
    await transport.push(lineUserId, [survey]);
  } catch {
    return;
  }
  await recordBotReplies(conversationId, [survey]);
}

/** แยก postback csat ออกจาก postback อื่น — ผิดรูปคืน null แล้วผู้เรียก log จบ */
export function parseCsatPostback(data: string): { conversationId: string; score: number } | null {
  const parts = data.split('|');
  if (parts.length !== 3 || parts[0] !== 'csat') return null;
  const score = Number(parts[2]);
  if (!Number.isInteger(score) || score < 1 || score > 5) return null;
  if (!parts[1]) return null;
  return { conversationId: parts[1] as string, score };
}

const THANK_YOU: Record<number, string> = {
  1: 'ขอบคุณสำหรับคะแนน เราจะนำไปปรับปรุงการให้บริการครับ',
  2: 'ขอบคุณสำหรับคะแนน เราจะนำไปปรับปรุงการให้บริการครับ',
  3: 'ขอบคุณสำหรับคะแนนครับ',
  4: 'ขอบคุณสำหรับคะแนนครับ ดีใจที่ช่วยเหลือได้ครับ',
  5: 'ขอบคุณสำหรับคะแนนเต็มครับ ดีใจที่ช่วยเหลือได้ครับ',
};

/**
 * บันทึกคะแนน CSAT — unique ต่อห้อง กดซ้ำคืนผลเดิมไม่เพิ่มแถว
 * คืนผล {kind, score} ให้ผู้เรียกตัดสินใจต่อ (ข้อความขอบคุณแยกอยู่ csatThankYou) ไม่ throw
 */
export async function recordCsatResponse(
  conversationId: string,
  score: number,
): Promise<CsatRecordResult> {
  const db = await getDb();
  const [existing] = await db
    .select({ score: chatCsatResponses.score })
    .from(chatCsatResponses)
    .where(eq(chatCsatResponses.conversationId, conversationId))
    .limit(1);
  if (existing) return { kind: 'duplicate', score: existing.score };

  try {
    await db.insert(chatCsatResponses).values({
      id: generateId(),
      conversationId,
      score,
    });
  } catch {
    // ชน unique จาก race — อ่านผลของผู้ชนะแทน ไม่นับซ้ำ
    const [winner] = await db
      .select({ score: chatCsatResponses.score })
      .from(chatCsatResponses)
      .where(eq(chatCsatResponses.conversationId, conversationId))
      .limit(1);
    if (winner) return { kind: 'duplicate', score: winner.score };
    return { kind: 'invalid' };
  }
  return { kind: 'recorded', score };
}

export function csatThankYou(score: number): string {
  return THANK_YOU[score] ?? 'ขอบคุณสำหรับคะแนนครับ';
}

/** ดึง line user id ของห้อง — postback ไม่มี source ที่เชื่อได้ ให้อ่านจาก DB แทน */
export async function lineUserIdOfConversation(conversationId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ lineUserId: chatConversations.lineUserId })
    .from(chatConversations)
    .where(and(eq(chatConversations.id, conversationId)))
    .limit(1);
  return row?.lineUserId ?? null;
}
