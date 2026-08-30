import { describe, expect, test } from 'vitest';
import { linePlaceholderEmail, lineUserIdFromPlaceholderEmail } from './placeholder-email';

describe('linePlaceholderEmail', () => {
  test('สร้าง email ตรงรูปแบบ contract line-<localPart>@placeholder.local', () => {
    expect(linePlaceholderEmail('Uabc123')).toBe('line-Uabc123@placeholder.local');
  });
});

describe('lineUserIdFromPlaceholderEmail', () => {
  test('parse กลับได้ lineUserId เดิม (round-trip)', () => {
    expect(lineUserIdFromPlaceholderEmail(linePlaceholderEmail('Uabc123'))).toBe('Uabc123');
  });

  test('ปฏิเสธ email placeholder สายอื่น (cid-)', () => {
    expect(lineUserIdFromPlaceholderEmail('cid-abc123def456@placeholder.local')).toBeNull();
  });

  test('ปฏิเสธ email ทั่วไปที่ไม่ใช่ placeholder', () => {
    expect(lineUserIdFromPlaceholderEmail('someone@example.com')).toBeNull();
  });

  test('local part ว่าง คืนสตริงว่างไม่ใช่ null — caller ต้องเช็ค falsy ต่อ', () => {
    expect(lineUserIdFromPlaceholderEmail('line-@placeholder.local')).toBe('');
  });
});
