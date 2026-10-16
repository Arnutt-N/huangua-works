import { createHmac, timingSafeEqual } from 'crypto';

export function verifyLineSignature(body: string, signature: string | null): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret || !signature) return false;

  // § เทียบ base64 ตรงตัว เพราะ decode ยอมรับรูปไม่ canonical โดยไม่ throw
  // ตรวจความยาวก่อน timingSafeEqual ซึ่งบังคับให้เท่ากัน (HMAC-SHA256 base64 ยาว 44 ตัวเสมอ)
  const expected = Buffer.from(createHmac('sha256', channelSecret).update(body, 'utf8').digest('base64'));
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
