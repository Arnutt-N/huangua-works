import { describe, expect, test } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  test('joins multiple class names with a space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  test('filters out false, null, and undefined', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  test('returns an empty string when given no truthy classes', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  test('returns an empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  test('handles a single class name', () => {
    expect(cn('only')).toBe('only');
  });

  test('supports common conditional-class usage', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });
});
