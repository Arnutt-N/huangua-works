import { createHmac, timingSafeEqual } from 'crypto';

export function verifyLineSignature(body: string, signature: string | null): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret || !signature) return false;

  const hash = createHmac('sha256', channelSecret).update(body, 'utf8').digest('base64');

  const expected = Buffer.from(hash);
  const received = Buffer.from(signature);
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}
