import { describe, expect, it } from 'vitest';
import { clientIpFromHeaders } from './client-ip';

describe('clientIpFromHeaders', () => {
  it('ใช้ IP แรกของ x-forwarded-for และตัดช่องว่าง', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': ' 203.0.113.1 , 10.0.0.1' }))).toBe('203.0.113.1');
  });

  it('ไม่มี x-forwarded-for → ใช้ x-real-ip', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
  });

  it('x-forwarded-for ว่าง → ใช้ x-real-ip', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '', 'x-real-ip': '198.51.100.3' }))).toBe('198.51.100.3');
  });

  it('ไม่มีทั้งคู่ → unknown', () => {
    expect(clientIpFromHeaders(new Headers())).toBe('unknown');
  });

  it('IPv6 loopback ของ next dev ผ่านได้ตรง ๆ (e2e ใช้ ::1)', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '::1' }))).toBe('::1');
  });
});
