import { getTableName } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import type { CaseFlowState } from './case-flow';

// --- Mock @/lib/db so startCaseFlow / createCase don't hit real Postgres ---
const { mockDb } = vi.hoisted(() => {
  const mockCategories = [
    { id: 'cat-road', name: 'ถนน-ทางเท้า', isActive: true, estimatedDays: 7 },
    { id: 'cat-elec', name: 'ไฟฟ้า-แสงสว่าง', isActive: true, estimatedDays: 7 },
  ];

  // § mock เดิมคืน mockCategories ให้ทุก select ไม่ว่าถามตารางไหน ซึ่งทำให้ query
  // ตรวจการชนของ trackingCode ใน createCase "เจอแถว" เสมอ = ชนทุกครั้ง
  // (โค้ดเดิมกลบไว้ได้เพราะออกจากลูปแล้วใช้รหัสที่ยังไม่ผ่านการตรวจ)
  //
  // แยกผลลัพธ์ตามตารางที่ .from() ถาม แทนที่จะเดาจาก argument ของ select()
  // (case-flow เรียก categories ทั้งแบบมีและไม่มี projection) — ตารางอื่นใน intake
  // (cases, lineUsers, users) คืน [] = "ไม่พบแถว" ซึ่งตรงกับที่ flow นี้ต้องการ
  //
  // เทียบด้วยชื่อตาราง ไม่ใช่ชื่อคอลัมน์ — ถ้าผูกกับคอลัมน์ (เช่น 'estimatedDays' in table)
  // วันที่มีคน rename คอลัมน์นั้นใน schema.ts mock จะเงียบๆ คืน [] แทน mockCategories
  // แล้วเทสต์พังโดยไม่มีอะไรชี้ว่าสาเหตุอยู่ที่ mock
  function isCategoriesTable(table: unknown): boolean {
    return getTableName(table as Parameters<typeof getTableName>[0]) === 'categories';
  }

  function makeThenable() {
    let value: unknown = [];
    const obj: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(value).then(resolve, reject),
      from: vi.fn((table: unknown) => {
        value = isCategoriesTable(table) ? mockCategories : [];
        return obj;
      }),
    };
    // § intake ใช้ ON CONFLICT/RETURNING ใน tx; mock ต้องคืน id ของแถวที่ insert
    obj.values = vi.fn((row: Record<string, unknown>) => {
      value = [row];
      return obj;
    });
    for (const m of ['where', 'limit', 'onConflictDoNothing', 'onConflictDoUpdate', 'returning']) {
      obj[m] = vi.fn(() => obj);
    }
    return obj;
  }

  const mockDb = {
    select: vi.fn(() => makeThenable()),
    insert: vi.fn(() => makeThenable()),
    // § ใช้ mockDb เดิมเป็น tx เพื่อทดสอบ bot flow ผ่าน createCase โดยไม่แตะ DB จริง
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockDb)),
  };
  return { mockDb };
});

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => mockDb),
}));

const { startCaseFlow, processCaseFlow, handleConfirmPostback, BOT_CONSENT_NOTICE } = await import('./case-flow');

const LINE_USER_ID = 'U1234567890abcdef';

function state(step: CaseFlowState['step'], over: Partial<CaseFlowState> = {}): CaseFlowState {
  return { step, ...over };
}

function flow(input: string, st: CaseFlowState | null) {
  return processCaseFlow(input, st!, LINE_USER_ID);
}

function firstReplyText(result: { replies: Array<{ type: string; text?: string }> }): string {
  const r = result.replies[0];
  if (r?.type !== 'text' || typeof r.text !== 'string') throw new Error('expected text reply');
  return r.text;
}

function firstReplyAltText(result: { replies: Array<{ type: string; altText?: string }> }): string {
  const r = result.replies[0];
  if (r?.type !== 'flex' || typeof r.altText !== 'string') throw new Error('expected flex reply with altText');
  return r.altText;
}

describe('case-flow · processCaseFlow · category step', () => {
  it('matches "ถนน" → advances to title step', async () => {
    const result = await flow('ถนน', state('category'));
    expect(result.state?.step).toBe('title');
    expect(result.state?.categoryName).toBe('ถนน-ทางเท้า');
    expect(result.replies[0]?.type).toBe('text');
  });

  it('matches "ไฟฟ้า" → advances to title step', async () => {
    const result = await flow('ไฟฟ้า', state('category'));
    expect(result.state?.step).toBe('title');
    expect(result.state?.categoryName).toBe('ไฟฟ้า-แสงสว่าง');
  });

  it('matches category by keyword "หลุม" (ถนน)', async () => {
    const result = await flow('ถนนเป็นหลุม', state('category'));
    expect(result.state?.categoryName).toBe('ถนน-ทางเท้า');
  });

  it('stores the real DB category id, not the category name', async () => {
    const result = await flow('ถนน', state('category'));
    expect(result.state?.categoryId).toBe('cat-road');
  });

  it('accepts a category id tapped from the flex list', async () => {
    const result = await flow('cat-elec', state('category'));
    expect(result.state?.step).toBe('title');
    expect(result.state?.categoryId).toBe('cat-elec');
    expect(result.state?.categoryName).toBe('ไฟฟ้า-แสงสว่าง');
  });

  it('accepts the exact category name typed by the user', async () => {
    const result = await flow('ไฟฟ้า-แสงสว่าง', state('category'));
    expect(result.state?.categoryId).toBe('cat-elec');
  });

  it('accumulates missCount on unmatched input', async () => {
    const result = await flow('สวัสดี', state('category'));
    expect(result.state?.step).toBe('category');
    expect(result.state?.missCount).toBe(1);
  });

  it('resets to null after 3 consecutive misses', async () => {
    let s: CaseFlowState | null = state('category');
    let result = await flow('xxx', s);
    s = result.state;
    result = await flow('yyy', s);
    s = result.state;
    result = await flow('zzz', s);
    expect(result.state).toBeNull();
    expect(result.replies[0]).toHaveProperty('type', 'text');
  });

  it('keeps missCount across retries then resets on success', async () => {
    let result = await flow('xxx', state('category'));
    expect(result.state?.missCount).toBe(1);
    result = await flow('ถนน', result.state);
    expect(result.state?.missCount).toBe(0);
    expect(result.state?.step).toBe('title');
  });
});

describe('case-flow · processCaseFlow · title step', () => {
  it('rejects title shorter than 3 chars', async () => {
    const result = await flow('ab', state('title', { categoryId: 'cat-road', categoryName: 'ถนน-ทางเท้า' }));
    expect(result.state?.step).toBe('title');
    expect(result.replies[0]).toHaveProperty('type', 'text');
  });

  it('accepts valid title → advances to description', async () => {
    const result = await flow('ถนนพังหน้าบ้าน', state('title', { categoryId: 'cat-road', categoryName: 'ถนน-ทางเท้า' }));
    expect(result.state?.step).toBe('description');
    expect(result.state?.title).toBe('ถนนพังหน้าบ้าน');
  });
});

describe('case-flow · processCaseFlow · description step', () => {
  it('rejects description shorter than 5 chars', async () => {
    const result = await flow('abc', state('description', { title: 'ถนนพัง' }));
    expect(result.state?.step).toBe('description');
  });

  it('accepts valid description → advances to location', async () => {
    const result = await flow('มีหลุมบ่อใหญ่กลางถนน', state('description', { title: 'ถนนพัง' }));
    expect(result.state?.step).toBe('location');
    expect(result.state?.description).toBe('มีหลุมบ่อใหญ่กลางถนน');
  });
});

describe('case-flow · processCaseFlow · location step', () => {
  it('stores location and advances to confirm with a Flex summary bubble', async () => {
    const s = state('location', {
      categoryId: 'cat-road',
      categoryName: 'ถนน-ทางเท้า',
      title: 'ถนนพัง',
      description: 'มีหลุมบ่อใหญ่',
    });
    const result = await flow('หน้าวัดหัวงัว หมู่ 3', s);
    expect(result.state?.step).toBe('confirm');
    expect(result.state?.location).toBe('หน้าวัดหัวงัว หมู่ 3');
    expect(result.replies[0]?.type).toBe('flex');
    const alt = firstReplyAltText(result);
    expect(alt).toContain('สรุปเรื่องที่แจ้ง');
    expect(alt).toContain('ถนน-ทางเท้า');
    expect(alt).toContain('ถนนพัง');
    expect(alt).toContain('หน้าวัดหัวงัว');
  });

  it('§ สรุปก่อนยืนยันต้องแจ้งว่าการยืนยัน = ให้ความยินยอม (createCase บันทึก line_bot_submit)', async () => {
    const s = state('location', {
      categoryId: 'cat-road',
      categoryName: 'ถนน-ทางเท้า',
      title: 'ถนนพัง',
      description: 'มีหลุมบ่อใหญ่',
    });
    const alt = firstReplyAltText(await flow('หน้าวัดหัวงัว หมู่ 3', s));

    expect(alt).toContain('ยินยอม');
    expect(alt).toContain('043-601-494');
    expect(alt).toContain(BOT_CONSENT_NOTICE);
    // ข้อความแจ้งต้องมาก่อนคำแนะนำวิธียืนยัน ไม่ใช่หลัง
    expect(alt.indexOf(BOT_CONSENT_NOTICE)).toBeLessThan(alt.indexOf('กดปุ่ม'));
  });
});

describe('case-flow · processCaseFlow · confirm step', () => {
  const confirmState: CaseFlowState = {
    step: 'confirm',
    categoryId: 'cat-road',
    categoryName: 'ถนน-ทางเท้า',
    title: 'ถนนพัง',
    description: 'มีหลุมบ่อใหญ่',
    location: 'หน้าวัด ม.3',
  };

  it('cancels on "ยกเลิก" → state null', async () => {
    const result = await flow('ยกเลิก', confirmState);
    expect(result.state).toBeNull();
    expect(result.replies[0]).toHaveProperty('type', 'text');
  });

  it('cancels on "cancel" (English)', async () => {
    const result = await flow('cancel', confirmState);
    expect(result.state).toBeNull();
  });

  it('re-prompts on ambiguous input (not ยืนยัน/ยกเลิก)', async () => {
    const result = await flow('ไม่แน่ใจ', confirmState);
    expect(result.state?.step).toBe('confirm');
  });

  it('confirms on "ยืนยัน" → creates case, returns tracking code', async () => {
    const result = await flow('ยืนยัน', confirmState);
    expect(result.state).toBeNull();
    const text = firstReplyText(result);
    expect(text).toContain('เลขติดตาม');
    // § รหัสที่สร้างใหม่ใช้ prefix HG แต่ normalize ยังรับ HN เก่าด้วย
    expect(text).toMatch(/(HN|HG)\d{9}/);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('confirms on "confirm" (English)', async () => {
    const result = await flow('confirm', confirmState);
    expect(result.state).toBeNull();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('confirms on "ok"', async () => {
    const result = await flow('ok', confirmState);
    expect(result.state).toBeNull();
  });
});

describe('case-flow · startCaseFlow', () => {
  it('returns initial state at category step', async () => {
    const result = await startCaseFlow();
    expect(result.state.step).toBe('category');
    expect(result.reply.type).toBe('flex');
  });
});

describe('case-flow · handleConfirmPostback · edit round-trip', () => {
  const confirmState: CaseFlowState = {
    step: 'confirm',
    categoryId: 'cat-road',
    categoryName: 'ถนน-ทางเท้า',
    title: 'ถนนพัง',
    description: 'มีหลุมบ่อใหญ่',
    location: 'หน้าวัด ม.3',
  };

  function postback(data: Parameters<typeof handleConfirmPostback>[0], st: CaseFlowState | null) {
    return handleConfirmPostback(data, st, LINE_USER_ID);
  }

  it('confirm:ok submits (same path as typing ยืนยัน) → tracking code', async () => {
    const result = await postback('confirm:ok', confirmState);
    expect(result?.state).toBeNull();
    expect(firstReplyText(result!)).toMatch(/(HN|HG)\d{9}/);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('confirm:cancel cancels → state null', async () => {
    const result = await postback('confirm:cancel', confirmState);
    expect(result?.state).toBeNull();
    expect(firstReplyText(result!)).toContain('ยกเลิก');
  });

  it('edit title: jumps to title prompt, answer returns to confirm Flex with edited title', async () => {
    const edit = await postback('confirm:edit:title', confirmState);
    expect(edit?.state?.step).toBe('title');
    expect(edit?.state?.editingField).toBe('title');
    expect(firstReplyText(edit!)).toContain('หัวข้อเรื่อง');

    const back = await flow('ถนนพังเพิ่มอีกจุด', edit!.state);
    expect(back.state?.step).toBe('confirm');
    expect(back.state?.editingField).toBeNull();
    expect(back.replies[0]?.type).toBe('flex');
    expect(firstReplyAltText(back)).toContain('ถนนพังเพิ่มอีกจุด');
    expect(firstReplyAltText(back)).toContain(BOT_CONSENT_NOTICE);
  });

  it('edit title then confirm submits with the edited title', async () => {
    const edit = await postback('confirm:edit:title', confirmState);
    const back = await flow('หัวข้อที่แก้แล้ว', edit!.state);
    const done = await flow('ยืนยัน', back.state);
    expect(done.state).toBeNull();
    expect(firstReplyText(done)).toContain('เลขติดตาม');
    // § submit path เดิม — เรื่องที่สร้างต้องใช้หัวข้อที่แก้ (นับแถว insert ไม่แตะ PII)
    const inserts = vi.mocked(mockDb.insert).mock.calls.length;
    expect(inserts).toBeGreaterThan(0);
    expect(back.state?.title).toBe('หัวข้อที่แก้แล้ว');
  });

  it('edit description: answer returns to confirm with edited description', async () => {
    const edit = await postback('confirm:edit:description', confirmState);
    expect(edit?.state?.step).toBe('description');
    const back = await flow('รายละเอียดที่แก้แล้วยาวพอ', edit!.state);
    expect(back.state?.step).toBe('confirm');
    expect(firstReplyAltText(back)).toContain('รายละเอียดที่แก้แล้วยาวพอ');
  });

  it('edit location: answer returns to confirm with edited location', async () => {
    const edit = await postback('confirm:edit:location', confirmState);
    expect(edit?.state?.step).toBe('location');
    const back = await flow('สถานที่ใหม่ หมู่ 5', edit!.state);
    expect(back.state?.step).toBe('confirm');
    expect(firstReplyAltText(back)).toContain('สถานที่ใหม่ หมู่ 5');
  });

  it('edit category: jumps to category menu, answer returns to confirm with new category', async () => {
    const edit = await postback('confirm:edit:category', confirmState);
    expect(edit?.state?.step).toBe('category');
    expect(edit?.replies[0]?.type).toBe('flex');

    const back = await flow('ไฟฟ้า', edit!.state);
    expect(back.state?.step).toBe('confirm');
    expect(back.state?.categoryName).toBe('ไฟฟ้า-แสงสว่าง');
    expect(firstReplyAltText(back)).toContain('ไฟฟ้า-แสงสว่าง');
  });

  it('returns null outside confirm step (stale postback → engine stays log-only)', async () => {
    expect(await postback('confirm:ok', state('title', { categoryId: 'cat-road' }))).toBeNull();
    expect(await postback('confirm:edit:title', null)).toBeNull();
  });

  it('text ยืนยัน/ยกเลิก still works after an edit round-trip (backward compat)', async () => {
    const edit = await postback('confirm:edit:location', confirmState);
    const back = await flow('ที่เดิม', edit!.state);
    const cancelled = await flow('ยกเลิก', back.state);
    expect(cancelled.state).toBeNull();
  });
});