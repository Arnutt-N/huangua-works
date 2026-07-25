import { afterEach, describe, expect, test } from 'vitest';
import { createHmac } from 'crypto';
import { verifyLineSignature } from './signature';

const TEST_SECRET = 'test-line-channel-secret-32chars-min';

function sign(body: string, secret: string = TEST_SECRET): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('base64');
}

describe('verifyLineSignature', () => {
  afterEach(() => {
    delete process.env.LINE_CHANNEL_SECRET;
  });

  test('accepts a valid HMAC-SHA256 signature', () => {
    process.env.LINE_CHANNEL_SECRET = TEST_SECRET;
    const body = JSON.stringify({ events: [] });
    expect(verifyLineSignature(body, sign(body))).toBe(true);
  });

  test('rejects a tampered body (signature no longer matches)', () => {
    process.env.LINE_CHANNEL_SECRET = TEST_SECRET;
    const body = JSON.stringify({ events: [] });
    const tampered = JSON.stringify({ events: [{ type: 'message' }] });
    expect(verifyLineSignature(tampered, sign(body))).toBe(false);
  });

  test('rejects a signature computed with a different secret', () => {
    process.env.LINE_CHANNEL_SECRET = TEST_SECRET;
    const body = JSON.stringify({ events: [] });
    expect(verifyLineSignature(body, sign(body, 'wrong-secret'))).toBe(false);
  });

  test('rejects when signature header is missing (null)', () => {
    process.env.LINE_CHANNEL_SECRET = TEST_SECRET;
    expect(verifyLineSignature('{"events":[]}', null)).toBe(false);
  });

  test('rejects when signature header is empty string', () => {
    process.env.LINE_CHANNEL_SECRET = TEST_SECRET;
    expect(verifyLineSignature('{"events":[]}', '')).toBe(false);
  });

  test('rejects when LINE_CHANNEL_SECRET is not set', () => {
    const body = JSON.stringify({ events: [] });
    expect(verifyLineSignature(body, sign(body))).toBe(false);
  });

  test('rejects when LINE_CHANNEL_SECRET is empty string', () => {
    process.env.LINE_CHANNEL_SECRET = '';
    const body = JSON.stringify({ events: [] });
    expect(verifyLineSignature(body, sign(body))).toBe(false);
  });

  test('rejects signatures of different length (length mismatch guard)', () => {
    process.env.LINE_CHANNEL_SECRET = TEST_SECRET;
    const body = JSON.stringify({ events: [] });
    // A truncated/garbage signature with different byte length
    expect(verifyLineSignature(body, 'short')).toBe(false);
  });

  test('handles UTF-8 body (Thai text) correctly', () => {
    process.env.LINE_CHANNEL_SECRET = TEST_SECRET;
    const body = JSON.stringify({ events: [{ message: { text: 'แจ้งถนนพัง' } }] });
    expect(verifyLineSignature(body, sign(body))).toBe(true);
  });

  test('does not throw on malformed base64 signature', () => {
    process.env.LINE_CHANNEL_SECRET = TEST_SECRET;
    const body = JSON.stringify({ events: [] });
    // Malformed signature should return false, not throw
    expect(() => verifyLineSignature(body, '!!!not-base64!!!')).not.toThrow();
  });
});