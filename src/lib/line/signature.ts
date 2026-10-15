import { createHmac, timingSafeEqual } from 'crypto';

export function verifyLineSignature(body: string, signature: string | null): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret || !signature) return false;

  const hash = createHmac('sha256', channelSecret).update(body, 'utf8').digest();
  // § เทียบ bytes ตรง (base64 decode ก่อน): เดิมเทียบ base64 string ผ่าน utf8 bytes —
  // ใช้ได้แต่ไม่ canonical (base64 ตัวเดียวกันเขียนได้หลายแบบ) + early-return ตอนยาวต่าง
  let received: Buffer;
  try {
    received = Buffer.from(signature, 'base64');
  } catch {
    return false;
  }
  if (hash.length !== received.length) return false;
  return timingSafeEqual(hash, received);
}
