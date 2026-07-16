import { describe, expect, test } from 'vitest';
import { formatCid, isValidCid, sanitizeCid, validateCidChecksum } from './cid-checksum';

const VALID_CID = '1101200563040';
const VALID_CID_FORMATTED = '1-1012-00563-04-0';

describe('validateCidChecksum', () => {
  test('returns true for a CID with correct MOD 11 checksum', () => {
    expect(validateCidChecksum(VALID_CID)).toBe(true);
  });

  test('accepts formatted input with dashes', () => {
    expect(validateCidChecksum(VALID_CID_FORMATTED)).toBe(true);
  });

  test('returns false when the checksum digit is wrong', () => {
    expect(validateCidChecksum('1101200563041')).toBe(false);
  });

  test('returns false for fewer than 13 digits', () => {
    expect(validateCidChecksum('110120056304')).toBe(false);
  });

  test('returns false for more than 13 digits', () => {
    expect(validateCidChecksum('11012005630400')).toBe(false);
  });

  test('returns false for an empty string', () => {
    expect(validateCidChecksum('')).toBe(false);
  });
});

describe('formatCid', () => {
  test('formats 13 digits as X-XXXX-XXXXX-XX-C', () => {
    expect(formatCid(VALID_CID)).toBe(VALID_CID_FORMATTED);
  });

  test('strips existing separators before formatting', () => {
    expect(formatCid('1 1012 00563 04 0')).toBe(VALID_CID_FORMATTED);
  });

  test('returns input unchanged when not 13 digits', () => {
    expect(formatCid('12345')).toBe('12345');
  });
});

describe('sanitizeCid', () => {
  test('keeps only digits', () => {
    expect(sanitizeCid(VALID_CID_FORMATTED)).toBe(VALID_CID);
  });

  test('truncates to 13 digits', () => {
    expect(sanitizeCid('11012005630401234')).toBe(VALID_CID);
  });

  test('returns empty string when input has no digits', () => {
    expect(sanitizeCid('abc-def')).toBe('');
  });
});

describe('isValidCid', () => {
  test('returns true for a valid CID string', () => {
    expect(isValidCid(VALID_CID)).toBe(true);
  });

  test('returns false for undefined (e.g. missing field in a JSON body)', () => {
    expect(isValidCid(undefined)).toBe(false);
  });

  test('returns false for null', () => {
    expect(isValidCid(null)).toBe(false);
  });

  test('returns false for a number', () => {
    expect(isValidCid(1101200563040)).toBe(false);
  });

  test('returns false for a checksum-invalid string', () => {
    expect(isValidCid('1101200563041')).toBe(false);
  });

  test('returns false for a too-short string', () => {
    expect(isValidCid('123')).toBe(false);
  });
});
