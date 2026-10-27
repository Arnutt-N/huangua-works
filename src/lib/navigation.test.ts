// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { safeInternalPath } from './navigation';

describe('safeInternalPath', () => {
  it('คืน path เดิมถ้าเป็น internal', () => {
    expect(safeInternalPath('/admin/reports?page=2&status=open', '/admin')).toBe(
      '/admin/reports?page=2&status=open',
    );
  });
  it('reject //evil.com', () => {
    expect(safeInternalPath('//evil.com', '/admin')).toBe('/admin');
  });
  it('reject absolute URL', () => {
    expect(safeInternalPath('https://evil.com', '/admin')).toBe('/admin');
  });
  it('reject backslash', () => {
    expect(safeInternalPath('\\evil.com', '/admin')).toBe('/admin');
    expect(safeInternalPath('/admin\\x', '/admin')).toBe('/admin');
  });
  it('ว่าง/undefined → fallback', () => {
    expect(safeInternalPath('', '/admin')).toBe('/admin');
    expect(safeInternalPath(undefined, '/admin')).toBe('/admin');
  });
  it('reject path traversal', () => {
    expect(safeInternalPath('/admin/../secret', '/admin')).toBe('/admin');
  });
});
