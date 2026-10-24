import { describe, expect, it } from 'vitest';
import {
  canPublish,
  menuStatusPill,
  needsResync,
  primaryAction,
  toLocalDatetimeInputValue,
  type RichMenuPillFields,
} from './rich-menu-state';

function fields(over: Partial<RichMenuPillFields> = {}): RichMenuPillFields {
  return {
    lineRichMenuId: 'richmenu-abc',
    syncStatus: 'synced',
    status: 'active',
    displayMode: 'ALWAYS',
    displayStartAt: null,
    displayEndAt: null,
    lastSyncError: null,
    ...over,
  };
}

describe('canPublish / needsResync', () => {
  it('publish ได้เฉพาะเมนูที่ sync สำเร็จ', () => {
    expect(canPublish(fields())).toBe(true);
    expect(canPublish(fields({ syncStatus: 'error' }))).toBe(false);
    expect(canPublish(fields({ lineRichMenuId: null }))).toBe(false);
  });

  it('needsResync เฉพาะเมื่อมี line id และ pending', () => {
    expect(needsResync(fields({ syncStatus: 'pending' }))).toBe(true);
    expect(needsResync(fields({ syncStatus: 'pending', lineRichMenuId: null }))).toBe(false);
    expect(needsResync(fields())).toBe(false);
  });
});

describe('menuStatusPill — ลำดับ sync ก่อน display mode', () => {
  it('active + synced = ACTIVE', () => {
    expect(menuStatusPill(fields()).label).toBe('ACTIVE');
  });

  it('sync error = SYNC FAILED พร้อม title', () => {
    const pill = menuStatusPill(fields({ syncStatus: 'error', status: 'draft', lastSyncError: 'boom' }));
    expect(pill.label).toBe('SYNC FAILED');
    expect(pill.title).toBe('boom');
  });

  it('pending = รอซิงค์ แม้ status active', () => {
    expect(menuStatusPill(fields({ syncStatus: 'pending' })).label).toBe('รอซิงค์');
  });

  it('SCHEDULED ที่หมดเวลา = หมดเวลา', () => {
    const pill = menuStatusPill(
      fields({ displayMode: 'SCHEDULED', status: 'inactive', displayStartAt: '2026-01-01T00:00:00Z' }),
    );
    expect(pill.label).toBe('หมดเวลา');
  });

  it('SCHEDULED ที่ยังไม่หมด = ตามเวลา', () => {
    const pill = menuStatusPill(
      fields({
        displayMode: 'SCHEDULED',
        status: 'draft',
        displayStartAt: '2099-01-01T00:00:00Z',
        displayEndAt: '2099-01-02T00:00:00Z',
      }),
    );
    expect(pill.label).toBe('ตามเวลา');
  });

  it('MANUAL ที่ยังไม่ active = ซ่อน', () => {
    expect(menuStatusPill(fields({ displayMode: 'MANUAL', status: 'draft' })).label).toBe('ซ่อน');
  });

  it('draft ที่ยังไม่ sync = DRAFT', () => {
    expect(menuStatusPill(fields({ status: 'draft', lineRichMenuId: null })).label).toBe('DRAFT');
  });
});

describe('primaryAction', () => {
  it('ยังไม่ sync = sync', () => {
    expect(primaryAction(fields({ lineRichMenuId: null, status: 'draft' }))).toBe('sync');
  });
  it('pending = resync', () => {
    expect(primaryAction(fields({ syncStatus: 'pending' }))).toBe('resync');
  });
  it('synced แต่ยังไม่ active = publish', () => {
    expect(primaryAction(fields({ status: 'draft' }))).toBe('publish');
  });
  it('active + synced = null (Live Now)', () => {
    expect(primaryAction(fields())).toBeNull();
  });
});

describe('toLocalDatetimeInputValue', () => {
  it('คืนค่าว่างเมื่อไม่มีค่า/ผิดรูปแบบ', () => {
    expect(toLocalDatetimeInputValue(null)).toBe('');
    expect(toLocalDatetimeInputValue('not-a-date')).toBe('');
  });

  it('แปลง ISO เป็น local yyyy-MM-ddTHH:mm', () => {
    const d = new Date(2026, 9, 24, 13, 6);
    expect(toLocalDatetimeInputValue(d.toISOString())).toBe('2026-10-24T13:06');
  });
});
