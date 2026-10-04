import { getTableName } from 'drizzle-orm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * createCase — ตรวจสองพฤติกรรมที่แก้ใน PR ความปลอดภัย
 *
 * 1. ลูปกันชนของ trackingCode ต้องตรวจ "ทุก" รหัสที่สุ่มได้ก่อนใช้
 *    เดิมสุ่มใหม่ตอนชนแล้วออกจากลูปโดยไม่ได้ตรวจตัวสุดท้าย = รหัสที่ไม่เคยผ่าน
 *    การตรวจหลุดไปถึง insert แล้วพังที่ unique index
 * 2. (ย้ายแล้ว) ตัวตนผู้แจ้งทางเว็บผูกกับ CID เท่านั้น — ทดสอบที่ interface ของ module
 *    กับ Postgres จริงใน src/lib/cases/citizen-access/identity.integration.test.ts
 */

const { mockState, mockDb } = vi.hoisted(() => {
  const mockState = {
    /** จำนวนครั้งที่ query ตาราง cases จะตอบว่า "ชน" ก่อนจะเริ่มตอบว่าว่าง */
    collisionsRemaining: 0,
    conflictWinner: null as { id: string; email: string } | null,
    /** แถวที่ query ตาราง users จะคืน (จำลอง user ที่มีอยู่แล้ว) */
    existingUsers: [] as Array<{ id: string; email: string }>,
    /** email ที่ resolveCitizen ใช้ค้น users จริงๆ */
    userLookupEmails: [] as string[],
    insertedUsers: [] as Array<Record<string, unknown>>,
    insertedCases: [] as Array<Record<string, unknown>>,
  };

  const mockCategory = {
    id: 'cat-road',
    name: 'ถนน-ทางเท้า',
    isActive: true,
    estimatedDays: 7,
    defaultDepartmentId: null,
  };

  /** เดิน SQL condition ของ drizzle เก็บค่า string ที่ถูก bind เป็น parameter */
  function collectBoundValues(node: unknown, seen = new WeakSet<object>()): string[] {
    if (typeof node === 'string') return [node];
    if (!node || typeof node !== 'object') return [];
    if (seen.has(node)) return [];
    seen.add(node);

    const out: string[] = [];
    if (Array.isArray(node)) {
      for (const item of node) out.push(...collectBoundValues(item, seen));
      return out;
    }
    // เก็บเฉพาะกิ่งที่พาไปหา Param ของ drizzle — ไม่เดินเข้า .table ที่วนกลับ
    for (const key of ['queryChunks', 'value', 'values'] as const) {
      const child = (node as Record<string, unknown>)[key];
      if (child !== undefined) out.push(...collectBoundValues(child, seen));
    }
    return out;
  }

  function rowsFor(tableName: string): unknown[] {
    if (tableName === 'categories') return [mockCategory];
    if (tableName === 'cases') {
      // ตอบว่าชนตามจำนวนที่ตั้งไว้ แล้วหลังจากนั้นตอบว่าว่าง
      if (mockState.collisionsRemaining > 0) {
        mockState.collisionsRemaining -= 1;
        return [{ id: 'existing-case' }];
      }
      return [];
    }
    if (tableName === 'users') return mockState.existingUsers;
    return [];
  }

  function makeSelect() {
    let rows: unknown[] = [];
    const obj: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(rows).then(resolve, reject),
      from: vi.fn((table: unknown) => {
        rows = rowsFor(getTableName(table as Parameters<typeof getTableName>[0]));
        return obj;
      }),
      where: vi.fn((condition: unknown) => {
        // § ดึงค่าที่ถูก bind เข้า WHERE ออกมา เพื่อพิสูจน์ว่า users ถูกค้นด้วย cid-hash
        // ไม่ใช่ email ที่ผู้ใช้กรอก — JSON.stringify ใช้ไม่ได้ เพราะ object ของ drizzle
        // มี circular ref (PgColumn.table → PgTable → column เดิม) จึงต้องเดินเอง
        for (const value of collectBoundValues(condition)) {
          if (value.includes('@')) mockState.userLookupEmails.push(value);
        }
        return obj;
      }),
      limit: vi.fn(() => obj),
      orderBy: vi.fn(() => obj),
    };
    return obj;
  }

  function makeInsert(table: unknown) {
    const tableName = getTableName(table as Parameters<typeof getTableName>[0]);
    const obj: Record<string, unknown> = {
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(undefined).then(resolve),
      onConflictDoNothing: vi.fn(() => {
        if (mockState.conflictWinner) mockState.existingUsers = [mockState.conflictWinner];
        return obj;
      }),
      // § resolveCitizen ผูก line_users ด้วย ON CONFLICT DO UPDATE — mock คืน chain เดิม
      onConflictDoUpdate: vi.fn(() => obj),
      returning: vi.fn(() => Promise.resolve(mockState.conflictWinner ? [] : [{ id: mockState.insertedUsers.at(-1)?.id }])),
      values: vi.fn((row: Record<string, unknown>) => {
        if (tableName === 'users' && !mockState.conflictWinner) mockState.insertedUsers.push(row);
        if (tableName === 'cases') mockState.insertedCases.push(row);
        return obj;
      }),
    };
    return obj;
  }

  const mockDb = {
    select: vi.fn(() => makeSelect()),
    insert: vi.fn((table: unknown) => makeInsert(table)),
    // § mock ใช้ db ตัวเดียวเป็น tx เพื่อให้ unit tests ตรวจพฤติกรรม intake เดิม
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockDb)),
  };

  return { mockState, mockDb };
});

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => mockDb) }));
// dedup / consent / audit แตะ DB จริงคนละทาง — ตัดออกเพื่อโฟกัสที่ createCase
vi.mock('@/lib/dedup', () => ({
  checkDuplicate: vi.fn(async () => ({ isDuplicate: false })),
  recordDedupHash: vi.fn(async () => undefined),
}));
vi.mock('@/lib/consent', () => ({
  grantConsent: vi.fn(async () => undefined),
  CONSENT_VERSION: '1.0',
}));
vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>();
  return { ...actual, logAudit: vi.fn(async () => undefined) };
});

const { createCase } = await import('./intake');
const { generateCidHash } = await import('@/lib/cid-hmac');

const VALID_CID = '1101200563040';

function webInput(over: Record<string, unknown> = {}) {
  return {
    channel: 'web' as const,
    title: 'ถนนชำรุด',
    description: 'มีหลุมบ่อหน้าบ้าน',
    categoryId: 'cat-road',
    cid: VALID_CID,
    fullName: 'สมชาย ใจดี',
    ...over,
  };
}

beforeEach(() => {
  mockState.collisionsRemaining = 0;
  mockState.conflictWinner = null;
  mockState.existingUsers = [];
  mockState.userLookupEmails = [];
  mockState.insertedUsers = [];
  mockState.insertedCases = [];
});

describe('createCase · ลูปกันชนของ trackingCode', () => {
  it('ใช้รหัสแรกที่ไม่ชน', async () => {
    const result = await createCase(webInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // § รหัสที่สร้างใหม่ใช้ prefix HG แต่ normalize ยังรับ HN เก่าด้วย เลยตรวจทั้งคู่
    expect(result.trackingCode).toMatch(/^(HN|HG)\d{9}$/);
    expect(mockState.insertedCases[0]?.trackingCode).toBe(result.trackingCode);
  });

  it.each([1, 2, 3, 4])('สุ่มใหม่จนได้รหัสที่ไม่ชน เมื่อชน %i ครั้งแรก', async (collisions) => {
    mockState.collisionsRemaining = collisions;
    const result = await createCase(webInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.trackingCode).toMatch(/^(HN|HG)\d{9}$/);
  });

  it('รหัสที่ถูกใช้จริงต้องเป็นรหัสที่ผ่านการตรวจแล้วเท่านั้น', async () => {
    // § นี่คือหัวใจของบั๊กเดิม — ตอนชน 4 ครั้ง โค้ดเก่าจะสุ่มตัวที่ 5 แล้วออกจากลูป
    // โดยไม่ได้ตรวจ ทำให้รหัสที่ไม่เคยผ่านการตรวจถูกนำไป insert
    mockState.collisionsRemaining = 4;
    const result = await createCase(webInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // ถ้ายังมี collision ค้างอยู่แปลว่าออกจากลูปก่อนที่ mock จะตอบว่า "ว่าง" สักครั้ง
    expect(mockState.collisionsRemaining).toBe(0);
    expect(mockState.insertedCases).toHaveLength(1);
  });

  it('คืน error แทนการ insert เมื่อชนครบ 5 ครั้ง', async () => {
    mockState.collisionsRemaining = 5;
    const result = await createCase(webInput());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errorCode).toBe('internal');
    expect(result.error).toContain('เลขติดตาม');
    // ต้องไม่ insert เคสที่ไม่มีเลขติดตาม
    expect(mockState.insertedCases).toHaveLength(0);
  });

  it('ลองไม่เกิน 5 ครั้ง — ไม่วนไม่รู้จบเมื่อชนตลอด', async () => {
    mockState.collisionsRemaining = 100;
    const result = await createCase(webInput());

    expect(result.ok).toBe(false);
    // เริ่มที่ 100 เหลือ 95 = เรียกไป 5 ครั้งพอดี
    expect(mockState.collisionsRemaining).toBe(95);
  });
});

// § จำลอง user ที่เกิดระหว่าง SELECT กับ INSERT เพื่อพิสูจน์ว่า unique conflict ไม่ทำ tx abort
describe('createCase · ตัวตนที่ถูกสร้างพร้อมกัน', () => {
  it.each(['web', 'line'] as const)('ใช้ผู้ชนะของ unique email ฝั่ง %s และสร้างเรื่องต่อได้', async (channel) => {
    const email = channel === 'web'
      ? `cid-${generateCidHash(VALID_CID)}@placeholder.local`
      : 'line-U-conflict@placeholder.local';
    mockState.conflictWinner = { id: 'winner-user', email };
    const result = await createCase({ ...webInput(), channel, lineUserId: 'U-conflict' });
    expect(result.ok).toBe(true);
    expect(mockState.insertedUsers).toHaveLength(0);
    expect(mockState.insertedCases[0]?.submittedBy).toBe('winner-user');
    expect(mockState.userLookupEmails.filter((value) => value === email)).toHaveLength(2);
  });
});
