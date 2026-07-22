import { describe, expect, test } from 'vitest';
import { geodataIdSchema, villageSchema, submitCaseSchema } from './validation';

describe('geodataIdSchema', () => {
  test('accepts positive integer', () => {
    expect(geodataIdSchema.parse(1)).toBe(1);
    expect(geodataIdSchema.parse(7436)).toBe(7436);
  });

  test('rejects zero', () => {
    expect(() => geodataIdSchema.parse(0)).toThrow();
  });

  test('rejects negative', () => {
    expect(() => geodataIdSchema.parse(-1)).toThrow();
  });

  test('rejects float', () => {
    expect(() => geodataIdSchema.parse(1.5)).toThrow();
  });

  test('rejects string', () => {
    expect(() => geodataIdSchema.parse('1')).toThrow();
  });
});

describe('villageSchema', () => {
  test('accepts normal village name', () => {
    expect(villageSchema.parse('บ้านหัวงัว หมู่ 5')).toBe('บ้านหัวงัว หมู่ 5');
  });

  test('trims whitespace', () => {
    expect(villageSchema.parse('  บ้านน้อย  ')).toBe('บ้านน้อย');
  });

  test('accepts empty string', () => {
    expect(villageSchema.parse('')).toBe('');
  });

  test('accepts undefined (optional)', () => {
    expect(villageSchema.parse(undefined)).toBeUndefined();
  });

  test('rejects over 100 chars', () => {
    expect(() => villageSchema.parse('ก'.repeat(101))).toThrow();
  });
});

describe('submitCaseSchema — geography fields', () => {
  const basePayload = {
    cid: '1234567890123',
    fullName: 'สมชาย ใจดี',
    categoryId: '019f8a99-05f3-71de-9d52-810e08e678f5',
    title: 'ถนนหน้าบ้านเป็นหลุมเป็นบ่อ',
    description: 'ถนนหน้าบ้านเลขที่ 88 เป็นหลุมลึก รถเสียหาย',
    consent: true as const,
  };

  test('accepts full geography fields', () => {
    const result = submitCaseSchema.safeParse({
      ...basePayload,
      provinceId: 46,
      districtId: 4607,
      subDistrictId: 460701,
      village: 'บ้านหัวงัว หมู่ 5',
      location: 'หน้าวัดหัวงัว',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provinceId).toBe(46);
      expect(result.data.districtId).toBe(4607);
      expect(result.data.subDistrictId).toBe(460701);
      expect(result.data.village).toBe('บ้านหัวงัว หมู่ 5');
    }
  });

  test('accepts without geography fields (all optional)', () => {
    const result = submitCaseSchema.safeParse(basePayload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.provinceId).toBeUndefined();
      expect(result.data.districtId).toBeUndefined();
      expect(result.data.subDistrictId).toBeUndefined();
      expect(result.data.village).toBeUndefined();
      expect(result.data.location).toBeUndefined();
    }
  });

  test('location is now optional', () => {
    const result = submitCaseSchema.safeParse({
      ...basePayload,
      provinceId: 46,
      districtId: 4607,
      subDistrictId: 460701,
    });
    expect(result.success).toBe(true);
  });

  test('rejects invalid provinceId (string)', () => {
    const result = submitCaseSchema.safeParse({
      ...basePayload,
      provinceId: 'abc',
    });
    expect(result.success).toBe(false);
  });

  test('rejects invalid provinceId (negative)', () => {
    const result = submitCaseSchema.safeParse({
      ...basePayload,
      provinceId: -1,
    });
    expect(result.success).toBe(false);
  });
});
