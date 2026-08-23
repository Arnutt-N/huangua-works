import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * LIFF session cookie — ค่า cookie คือ `lineUserId|exp` + signature
 *
 * § ไม่ใช้ CID_HMAC_KEY ดิบ (key separation) — derive คีย์เฉพาะทางด้วย context
 * 'liff-session' เพื่อไม่ให้ signature ของระบบนี้แทรกแซงกับ dedup/CID hash ได้
 * และไม่ต้องเพิ่ม env var ใหม่ให้ verify-env ดูแลอีกตัว
 *
 * โมดูลนี้ pure (ค่าเข้า-ออกเป็น string) — การอ่าน/ตั้ง cookie เป็นหน้าที่ของ
 * route handler เพื่อให้ sign/verify ทดสอบได้โดยไม่ต้อง mock Next.js
 */

export const LIFF_SESSION_COOKIE = 'liff_session';
export const LIFF_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 วัน

const MIN_KEY_LENGTH = 32;

function derivedKey(): Buffer {
  // § key ว่าง/สั้นใน production ต้อง throw ไม่ใช่เดินต่อ — session ที่ sign ด้วยคีย์
  // อ่อนคือ session ที่ใครก็ปลอมได้ (เหตุผลเดียวกับ cid-hmac.ts)
  const base = process.env.CID_HMAC_KEY || '';
  if (process.env.NODE_ENV === 'production' && base.length < MIN_KEY_LENGTH) {
    throw new Error(
      `[liff-session] CID_HMAC_KEY missing or shorter than ${MIN_KEY_LENGTH} chars — refusing to sign session`,
    );
  }
  return createHmac('sha256', base).update('liff-session').digest();
}

function sign(payload: string): string {
  return createHmac('sha256', derivedKey()).update(payload).digest('base64url');
}

export function createLiffSessionValue(
  lineUserId: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const exp = nowSeconds + LIFF_SESSION_TTL_SECONDS;
  const payload = `${lineUserId}|${exp}`;
  return `${payload}.${sign(payload)}`;
}

export interface LiffSession {
  lineUserId: string;
  expiresAt: number;
}

export function readLiffSessionValue(
  value: string | undefined | null,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): LiffSession | null {
  if (!value) return null;

  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);

  const bar = payload.lastIndexOf('|');
  if (bar <= 0) return null;
  const lineUserId = payload.slice(0, bar);
  const exp = Number(payload.slice(bar + 1));
  if (!lineUserId || !Number.isFinite(exp)) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  if (exp <= nowSeconds) return null;
  return { lineUserId, expiresAt: exp };
}
