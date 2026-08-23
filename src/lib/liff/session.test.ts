import { describe, it, expect } from 'vitest';
import {
  LIFF_SESSION_TTL_SECONDS,
  createLiffSessionValue,
  readLiffSessionValue,
} from './session';

// CID_HMAC_KEY มาจาก vitest.config env (test-only key) — NODE_ENV='test' จึงไม่โดน
// production guard ใน derivedKey()

describe('createLiffSessionValue + readLiffSessionValue', () => {
  const NOW = 1_700_000_000;

  it('roundtrip ได้ lineUserId เดิมพร้อม expiresAt ตาม TTL', () => {
    const value = createLiffSessionValue('Uabc123', NOW);
    const session = readLiffSessionValue(value, NOW);
    expect(session).not.toBeNull();
    expect(session!.lineUserId).toBe('Uabc123');
    expect(session!.expiresAt).toBe(NOW + LIFF_SESSION_TTL_SECONDS);
  });

  it('หมดอายุแล้ว (now >= exp) คืน null แม้ signature ถูกต้อง', () => {
    const value = createLiffSessionValue('Uabc123', NOW);
    expect(readLiffSessionValue(value, NOW + LIFF_SESSION_TTL_SECONDS)).toBeNull();
  });

  it('แก้ lineUserId ในค่า cookie (tamper) แล้วถูกปฏิเสธ', () => {
    const value = createLiffSessionValue('Uabc123', NOW);
    const dot = value.lastIndexOf('.');
    const tampered = `Uevil999${value.slice(value.indexOf('|'), dot)}${value.slice(dot)}`;
    expect(readLiffSessionValue(tampered, NOW)).toBeNull();
  });

  it('แก้ signature แล้วถูกปฏิเสธ', () => {
    const value = createLiffSessionValue('Uabc123', NOW);
    const dot = value.lastIndexOf('.');
    const tampered = `${value.slice(0, dot)}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
    expect(readLiffSessionValue(tampered, NOW)).toBeNull();
  });

  it('ค่ารูปแบบผิดคืน null ทั้งหมด', () => {
    expect(readLiffSessionValue(undefined, NOW)).toBeNull();
    expect(readLiffSessionValue('', NOW)).toBeNull();
    expect(readLiffSessionValue('no-dot-no-bar', NOW)).toBeNull();
    expect(readLiffSessionValue('Uabc123|9999999999.notsig??', NOW)).toBeNull();
    expect(readLiffSessionValue('Uabc123.notanumber.x', NOW)).toBeNull();
  });
});
