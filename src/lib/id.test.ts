import { describe, expect, test } from 'vitest';
import { generateId } from './id';

const UUID_V7_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('generateId', () => {
  test('returns a valid UUID v7 string', () => {
    expect(generateId()).toMatch(UUID_V7_PATTERN);
  });

  test('returns a unique value on every call', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});
