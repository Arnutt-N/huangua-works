import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { categories, cases } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
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
      const matched = matchCategory(text);
      if (!matched) {
        const missCount = (state.missCount ?? 0) + 1;
        if (missCount >= 3) {
          return {
            state: null,
            replies: [{ type: 'text', text: 'ขออภัยครับ ไม่สามารถระบุหมวดหมู่ได้ กรุณาพิมพ์ "แจ้งเรื่อง" เพื่อเริ่มใหม่ หรือพิมพ์ "ติดต่อเจ้าหน้าที่" เพื่อพูดคุยกับเจ้าหน้าที่' }],
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
        replies: [{ type: 'text', text: 'กรุณาระบุสถานที่เกิดเหตุ เช่น "หน้าวัดหัวงัว หมู่ 3" หรือส่ง location จาก LINE ได้ครับ' }],
      };
    }

    case 'location': {
      return {
        state: { ...state, step: 'confirm', location: text },
        replies: [{
          type: 'text',
          text: `📋 สรุปเรื่องร้องเรียน:\n\nหมวดหมู่: ${state.categoryName}\nหัวข้อ: ${state.title}\nรายละเอียด: ${state.description}\nสถานที่: ${text}\n\nพิมพ์ "ยืนยัน" เพื่อส่งเรื่อง หรือพิมพ์ "ยกเลิก" เพื่อเริ่มใหม่`,
        }],
      };
    }

    case 'confirm': {
      if (text.includes('ยกเลิก') || text.toLowerCase() === 'cancel') {
        return { state: null, replies: [{ type: 'text', text: 'ยกเลิกแล้วครับ พิมพ์ "แจ้งเรื่อง" เพื่อเริ่มใหม่ได้ตลอด' }] };
      }
      if (text.includes('ยืนยัน') || text.toLowerCase() === 'confirm' || text === 'ใช่' || text === 'ok') {
        const trackingCode = await createCase(state, lineUserId);
        return {
          state: null,
          replies: [{ type: 'text', text: `✅ ส่งเรื่องเรียบร้อยแล้ว!\n\nรหัสติดตาม: ${trackingCode}\n\nพิมพ์ "ติดตาม ${trackingCode}" เพื่อตรวจสอบสถานะได้ตลอด 24 ชม.` }],
        };
      }
      return { state, replies: [{ type: 'text', text: 'กรุณาพิมพ์ "ยืนยัน" เพื่อส่งเรื่อง หรือ "ยกเลิก" เพื่อเริ่มใหม่' }] };
    }
  }
}

function matchCategory(input: string): { id: string; name: string } | null {
  const normalized = input.toLowerCase();
  for (const [name, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        return { id: name, name };
      }
    }
  }
  return null;
}

async function createCase(state: CaseFlowState, _lineUserId: string): Promise<string> {
  const db = await getDb();

  const [cat] = await db
    .select()
    .from(categories)
    .where(eq(categories.name, state.categoryName!))
    .limit(1);

  const trackingCode = `HN${String(Math.floor(100000000 + Math.random() * 900000000))}`;

  await db.insert(cases).values({
    id: generateId(),
    title: state.title!,
    description: state.description!,
    location: state.location!,
    categoryId: cat?.id ?? 'unknown',
    submittedBy: 'line-bot',
    trackingCode,
    status: 'received',
    metadata: { source: 'line', categoryName: state.categoryName },
  });

  return trackingCode;
}
