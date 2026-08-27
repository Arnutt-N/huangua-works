import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { categories } from '@/lib/db/schema';
import { createCase } from '@/lib/cases/intake';
import type { LineOutgoingMessage } from '../types';
import { faqMenuFlex } from '../messages/flex';

export interface CaseFlowState {
  step: 'category' | 'title' | 'description' | 'location' | 'confirm';
  categoryId?: string;
  categoryName?: string;
  title?: string;
  description?: string;
  location?: string;
  missCount?: number;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'ถนน-ทางเท้า': ['ถนน', 'ทางเท้า', 'ถนนพัง', 'ถนนเป็นหลุม', 'ทางเดิน'],
  'ไฟฟ้า-แสงสว่าง': ['ไฟฟ้า', 'ไฟ', 'แสงสว่าง', 'ไฟดับ', 'ไฟถนน', 'เสาไฟ'],
  'น้ำประปา': ['น้ำประปา', 'น้ำ', 'ประปา', 'น้ำไม่ไหล', 'ท่อน้ำ'],
  'ท่อระบายน้ำ': ['ท่อ', 'ระบายน้ำ', 'น้ำท่วม', 'ท่อตัน', 'น้ำขัง'],
  'สวนสาธารณะ': ['สวน', 'สวนสาธารณะ', 'ต้นไม้', 'สนาม'],
  'ขยะ-สิ่งปฏิกูล': ['ขยะ', 'สิ่งปฏิกูล', 'เก็บขยะ', 'ถังขยะ'],
  'สิ่งแวดล้อม': ['สิ่งแวดล้อม', 'มลพิษ', 'ฝุ่น', 'กลิ่น', 'ควัน'],
  'สุขภาพ-อนามัย': ['สุขภาพ', 'อนามัย', 'โรค', 'ยุง', 'ไข้'],
  'สัตว์จรจัด': ['สัตว์', 'สุนัข', 'แมว', 'สัตว์จร', 'หมา'],
  'ป้ายโฆษณา': ['ป้าย', 'โฆษณา', 'ป้ายผิด'],
};

export async function startCaseFlow(): Promise<{ state: CaseFlowState; reply: LineOutgoingMessage }> {
  const db = await getDb();
  const cats = await db.select().from(categories).where(eq(categories.isActive, true));

  const catList = cats.map((c) => ({ label: c.name, value: c.id }));

  return {
    state: { step: 'category' },
    reply: faqMenuFlex(catList),
  };
}

export async function processCaseFlow(
  input: string,
  state: CaseFlowState,
  lineUserId: string,
): Promise<{ state: CaseFlowState | null; replies: LineOutgoingMessage[] }> {
  const text = input.trim();

  switch (state.step) {
    case 'category': {
      const matched = await resolveCategory(text);
      if (!matched) {
        const missCount = (state.missCount ?? 0) + 1;
        if (missCount >= 3) {
          return {
            state: null,
            replies: [{ type: 'text', text: 'ขออภัยครับ ไม่สามารถระบุหมวดหมู่ได้ กรุณาพิมพ์ "แจ้งเรื่องใหม่" เพื่อเริ่มใหม่ หรือพิมพ์ "ติดต่อเจ้าหน้าที่" เพื่อพูดคุยกับเจ้าหน้าที่' }],
          };
        }
        return {
          state: { ...state, missCount },
          replies: [{ type: 'text', text: 'กรุณาเลือกหมวดหมู่จากรายการด้านบน หรือพิมพ์ชื่อหมวดหมู่ เช่น ถนน, ไฟฟ้า, น้ำประปา, ขยะ' }],
        };
      }
      return {
        state: { step: 'title', categoryId: matched.id, categoryName: matched.name, missCount: 0 },
        replies: [{ type: 'text', text: `หมวดหมู่: ${matched.name}\n\nกรุณาพิมพ์หัวข้อเรื่อง (สรุปสั้นๆ) เช่น "ถนนเป็นหลุมหน้าวัด"` }],
      };
    }

    case 'title': {
      if (text.length < 3) {
        return { state, replies: [{ type: 'text', text: 'หัวข้อสั้นเกินไป กรุณาพิมพ์อย่างน้อย 3 ตัวอักษร' }] };
      }
      return {
        state: { ...state, step: 'description', title: text },
        replies: [{ type: 'text', text: 'กรุณาอธิบายรายละเอียดเพิ่มเติม เช่น ปัญหาเป็นอย่างไร เกิดขึ้นเมื่อไหร่' }],
      };
    }

    case 'description': {
      if (text.length < 5) {
        return { state, replies: [{ type: 'text', text: 'รายละเอียดสั้นเกินไป กรุณาอธิบายเพิ่มเติมอีกนิดครับ' }] };
      }
      return {
        state: { ...state, step: 'location', description: text },
        replies: [{ type: 'text', text: 'กรุณาระบุสถานที่ของเรื่องที่แจ้ง เช่น "หน้าวัดหัวงัว หมู่ 3" หรือส่ง location จาก LINE ได้ครับ' }],
      };
    }

    case 'location': {
      return {
        state: { ...state, step: 'confirm', location: text },
        replies: [{
          type: 'text',
          text: `📋 สรุปเรื่องที่แจ้ง:\n\nหมวดหมู่: ${state.categoryName}\nหัวข้อ: ${state.title}\nรายละเอียด: ${state.description}\nสถานที่: ${text}\n\nพิมพ์ "ยืนยัน" เพื่อส่งเรื่อง หรือพิมพ์ "ยกเลิก" เพื่อเริ่มใหม่`,
        }],
      };
    }

    case 'confirm': {
      if (text.includes('ยกเลิก') || text.toLowerCase() === 'cancel') {
        return { state: null, replies: [{ type: 'text', text: 'ยกเลิกแล้วครับ พิมพ์ "แจ้งเรื่องใหม่" เพื่อเริ่มใหม่ได้ตลอด' }] };
      }
      if (text.includes('ยืนยัน') || text.toLowerCase() === 'confirm' || text === 'ใช่' || text === 'ok') {
        const submission = await submitLineCase(state, lineUserId);
        if (submission.ok) {
          return {
            state: null,
            replies: [{ type: 'text', text: `✅ ส่งเรื่องเรียบร้อยแล้ว!\n\nเลขติดตาม: ${submission.trackingCode}\n\nพิมพ์ "ติดตาม ${submission.trackingCode}" เพื่อตรวจสอบสถานะได้ตลอด 24 ชม.` }],
          };
        }
        // § dedup duplicate — channel 'line' พิสูจน์เจ้าของได้ createCase จึงคืน
        // trackingCode ของเรื่องเดิมให้ผู้ใช้กลับไปติดตามเองได้ (review PR #74)
        if (submission.duplicateTrackingCode) {
          return {
            state: null,
            replies: [{ type: 'text', text: `คุณเคยแจ้งเรื่องนี้ไปแล้วภายใน 7 วัน\n\nเลขติดตามของเรื่องเดิม: ${submission.duplicateTrackingCode}\n\nพิมพ์ "ติดตาม ${submission.duplicateTrackingCode}" เพื่อตรวจสอบสถานะ` }],
          };
        }
        throw new Error(`LINE case creation failed: ${submission.message}`);
      }
      return { state, replies: [{ type: 'text', text: 'กรุณาพิมพ์ "ยืนยัน" เพื่อส่งเรื่อง หรือ "ยกเลิก" เพื่อเริ่มใหม่' }] };
    }
  }
}

/**
 * แปลง input ของผู้ใช้ → หมวดหมู่จริงใน DB
 *
 * เรียงตามความแม่น: กดจากรายการ (ได้ id) → พิมพ์ชื่อตรง → keyword
 * คืน row จริงเสมอ เพื่อให้ state.categoryId ใช้สร้างเรื่องได้ตรงๆ
 */
async function resolveCategory(input: string): Promise<{ id: string; name: string } | null> {
  const db = await getDb();
  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.isActive, true));

  const tapped = cats.find((c) => c.id === input);
  if (tapped) return tapped;

  const normalized = input.toLowerCase();

  const byName = cats.find((c) => c.name.toLowerCase() === normalized);
  if (byName) return byName;

  for (const [name, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (!keywords.some((kw) => normalized.includes(kw))) continue;
    const byKeyword = cats.find((c) => c.name === name);
    if (byKeyword) return byKeyword;
  }

  return null;
}

/**
 * ส่งเรื่องจาก flow — แยก duplicate ออกจาก error อื่น เพราะ channel 'line'
 * พิสูจน์เจ้าของได้ (webhook uid / HMAC cookie) createCase จึงคืนเลขติดตาม
 * เดิมให้แสดงกลับได้ปลอดภัย
 */
type LineSubmission =
  | { ok: true; trackingCode: string }
  | { ok: false; duplicateTrackingCode?: string; message: string };

async function submitLineCase(state: CaseFlowState, lineUserId: string): Promise<LineSubmission> {
  if (!state.categoryId) {
    throw new Error('LINE case creation failed: missing categoryId');
  }

  const result = await createCase({
    channel: 'line',
    title: state.title!,
    description: state.description!,
    location: state.location,
    categoryId: state.categoryId,
    lineUserId,
  });

  if (result.ok) {
    return { ok: true, trackingCode: result.trackingCode };
  }

  if (result.errorCode === 'duplicate') {
    return { ok: false, duplicateTrackingCode: result.existingTrackingCode, message: result.error };
  }

  return { ok: false, message: result.error };
}
