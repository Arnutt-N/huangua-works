import { describe, expect, it } from 'vitest';
import {
  buildCaseMapping,
  classifyRows,
  parseBundle,
  type Resolution,
} from './legacy-import';

/** staging สมมติล้วน — ไม่ใช้ข้อมูลจริง */

const MANIFEST = JSON.stringify({
  source_sha256: 'abc123',
  master_sha256: 'def456',
  write_gate: 'blocked',
  db_ready: 0,
  output_sha256: {
    'rows.jsonl': 'h1',
    'review-queue.jsonl': 'h2',
    'summary.json': 'h3',
    'ownership.json': 'h4',
  },
});

function rowLine(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    source: { workbook_sha256: 'abc123', sheet: 'DATA', row: 4 },
    source_key: 'key-1',
    original: {
      B: { type: 'string', value: 'R1' },
      D: { type: 'string', value: 'walk-in' },
      E: { type: 'string', value: 'สมชาย ทดสอบ' },
      F: { type: 'string', value: 'บ้านทดสอบ หมู่ที่ 1' },
      H: { type: 'string', value: 'ไฟดับ' },
      I: { type: 'string', value: 'กองช่าง' },
      J: { type: 'string', value: 'ดำเนินการแล้วเสร็จ' },
      K: { type: 'string', value: '' },
    },
    received_date: '2026-01-01',
    fiscal_year_be: 2569,
    category: { review_state: 'proposed', value: 'electricity-lighting', id: 'cat-1' },
    status: { review_state: 'proposed', value: 'done' },
    responsible: { raw: { type: 'string', value: 'กองช่าง' }, review_state: 'unresolved' },
    review_codes: ['responsible_mapping_unresolved', 'submitter_identity_unresolved'],
    write_gate: 'blocked',
    ...overrides,
  });
}

function queueLine(codes: string[]): string {
  return JSON.stringify({
    source_key: 'key-1',
    source: { workbook_sha256: 'abc123', sheet: 'DATA', row: 4 },
    codes,
    write_gate: 'blocked',
  });
}

const EMPTY: Resolution = { statusByKey: {}, dateByKey: {}, categoryByKey: {} };

/** ดึงตัวเดียวพร้อมตรวจ — แทน non-null assertion ตาม idiom ของ repo */
function only<T>(arr: readonly T[]): T {
  if (arr.length !== 1) throw new Error(`expected exactly one, got ${arr.length}`);
  const item = arr[0];
  if (item === undefined) throw new Error('expected item');
  return item;
}

describe('legacy-import · parseBundle', () => {
  it('parse staging สมมติที่ถูกต้อง', () => {
    const bundle = parseBundle(MANIFEST, `${queueLine(['duplicate_receipt_preserved'])}\n`, `${rowLine()}\n`);
    expect(bundle.rows).toHaveLength(1);
    const first = only(bundle.rows);
    expect(first.sourceKey).toBe('key-1');
    expect(first.raw.detail).toBe('ไฟดับ');
  });
  it('manifest ไม่ใช่ blocked Critical → throw', () => {
    const bad = JSON.stringify({ ...JSON.parse(MANIFEST), write_gate: 'open' });
    expect(() => parseBundle(bad, '', '')).toThrow();
  });
  it('manifest ขาด hash → throw', () => {
    const bad = JSON.stringify({ ...JSON.parse(MANIFEST), output_sha256: {} });
    expect(() => parseBundle(bad, '', '')).toThrow();
  });
  it('แถวไม่มี source_key → throw', () => {
    expect(() => parseBundle(MANIFEST, '', `${rowLine({ source_key: '' })}\n`)).toThrow();
  });
});

describe('legacy-import · classifyRows', () => {
  function classified(rowOverrides: Record<string, unknown> = {}, codes?: string[], resolution: Resolution = EMPTY) {
    const bundle = parseBundle(
      MANIFEST,
      `${queueLine(codes ?? ['responsible_mapping_unresolved', 'submitter_identity_unresolved'])}\n`,
      `${rowLine(rowOverrides)}\n`,
    );
    return only(classifyRows(bundle, resolution));
  }

  it('แถวครบถ้วน importable (code เหลือแค่ verifiable รอ live DB)', () => {
    const c = classified();
    expect(c.importable).toBe(true);
    expect(c.statusFinal).toBe('done');
    expect(c.dateFinal).toBe('2026-01-01');
  });
  it('status unresolved ไม่มี override → block', () => {
    const c = classified({ status: { review_state: 'unresolved', value: null } }, ['status_unresolved']);
    expect(c.importable).toBe(false);
    expect(c.blockingCodes).toContain('status_unresolved');
  });
  it('--resolve-status ปลด status_unresolved ได้', () => {
    const c = classified({ status: { review_state: 'unresolved', value: null } }, ['status_unresolved'], {
      ...EMPTY,
      statusByKey: { 'key-1': 'awaiting_budget' },
    });
    expect(c.importable).toBe(true);
    expect(c.statusFinal).toBe('awaiting_budget');
  });
  it('--resolve-date ค่าผิดรูปไม่ปลด', () => {
    const c = classified({ received_date: null }, ['received_date_unresolved'], {
      ...EMPTY,
      dateByKey: { 'key-1': '30-กุมภา' },
    });
    expect(c.importable).toBe(false);
  });
  it('--resolve-date วันที่จริงปลดได้', () => {
    const c = classified({ received_date: null }, ['received_date_unresolved'], {
      ...EMPTY,
      dateByKey: { 'key-1': '2026-09-15' },
    });
    expect(c.importable).toBe(true);
    expect(c.dateFinal).toBe('2026-09-15');
  });
  it('code แปลกปลอม → block เสมอ', () => {
    const c = classified({}, ['mystery_code']);
    expect(c.importable).toBe(false);
    expect(c.blockingCodes).toContain('mystery_code');
  });
});

describe('legacy-import · buildCaseMapping', () => {
  const base = {
    detail: 'ไฟดับ',
    receiptNo: 'R1',
    channel: 'walk-in',
    villageRaw: 'บ้านทดสอบ หมู่ที่ 1',
    statusRaw: 'ดำเนินการแล้วเสร็จ',
    note: '',
    dateFinal: '2026-01-01',
    sourceSha256: 'abc123def456',
  };
  it('title ใช้รายละเอียด ปกติ', () => {
    const m = buildCaseMapping(base);
    expect(m.title).toBe('ไฟดับ');
    expect(m.location).toBe('บ้านทดสอบ หมู่ที่ 1');
    expect(m.description).toContain('เลขที่รับ: R1');
    expect(m.description).toContain('abc123def456'.slice(0, 12));
  });
  it('รายละเอียดว่างใช้เลขที่รับเป็น title แทน', () => {
    const m = buildCaseMapping({ ...base, detail: '  ' });
    expect(m.title).toBe('เรื่องร้องเรียนเลขที่ R1');
  });
  it('หมายเหตุย้ายไป actionDetails ไม่ซ้ำใน description', () => {
    const m = buildCaseMapping({ ...base, note: 'เทคอนกรีตแล้ว' });
    expect(m.actionDetails).toBe('เทคอนกรีตแล้ว');
    expect(m.description).not.toContain('เทคอนกรีตแล้ว');
    expect(m.description).toContain('เลขที่รับ: R1');
  });
  it('หมายเหตุว่างได้ actionDetails เป็น null', () => {
    const m = buildCaseMapping(base);
    expect(m.actionDetails).toBeNull();
  });
});
