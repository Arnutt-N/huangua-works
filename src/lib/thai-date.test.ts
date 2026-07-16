import { describe, expect, test } from 'vitest';
import {
  formatThaiDate,
  getFiscalYear,
  getFiscalYearBE,
  toBuddhistYear,
  toGregorianYear,
  toThaiDateString,
} from './thai-date';

describe('toBuddhistYear', () => {
  test('adds 543 to the Gregorian year', () => {
    expect(toBuddhistYear(new Date(2026, 0, 1))).toBe(2569);
  });
});

describe('toGregorianYear', () => {
  test('subtracts 543 from the Buddhist year', () => {
    expect(toGregorianYear(2569)).toBe(2026);
  });

  test('round-trips with toBuddhistYear', () => {
    const date = new Date(2026, 5, 15);
    expect(toGregorianYear(toBuddhistYear(date))).toBe(date.getFullYear());
  });
});

describe('getFiscalYear', () => {
  test('Jan-Sep maps to the same calendar year', () => {
    expect(getFiscalYear(new Date(2026, 0, 1))).toBe(2026); // Jan
    expect(getFiscalYear(new Date(2026, 8, 30))).toBe(2026); // Sep 30
  });

  test('Oct-Dec maps to the next calendar year', () => {
    expect(getFiscalYear(new Date(2026, 9, 1))).toBe(2027); // Oct 1 (fiscal year start)
    expect(getFiscalYear(new Date(2026, 11, 31))).toBe(2027); // Dec 31
  });
});

describe('toThaiDateString', () => {
  test('formats as YYYY-MM-DD with Buddhist year, zero-padded', () => {
    expect(toThaiDateString(new Date(2026, 0, 5))).toBe('2569-01-05');
  });

  test('pads double-digit month and day without change', () => {
    expect(toThaiDateString(new Date(2026, 10, 25))).toBe('2569-11-25');
  });
});

describe('formatThaiDate', () => {
  test('formats as DD/MM/BBBB', () => {
    expect(formatThaiDate(new Date(2026, 0, 5))).toBe('05/01/2569');
  });
});

describe('getFiscalYearBE', () => {
  test('returns the fiscal year in Buddhist era for a Jan-Sep date', () => {
    // fiscal year for a June 2026 date is calendar 2026 -> BE 2569
    expect(getFiscalYearBE(new Date(2026, 5, 15))).toBe(2569);
  });

  test('returns the fiscal year in Buddhist era for an Oct-Dec date', () => {
    // fiscal year for a November 2026 date is calendar 2027 -> BE 2570
    expect(getFiscalYearBE(new Date(2026, 10, 1))).toBe(2570);
  });
});
