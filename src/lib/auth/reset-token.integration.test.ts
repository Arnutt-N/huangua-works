import { describe, expect, test, afterAll, beforeAll } from 'vitest';
import { eq } from 'drizzle-orm';

/**
 * Integration test — ต้องมี local Postgres รันอยู่
 * กันถดถอยข้อ 2: reset token ใช้ซ้ำแข่งกัน (double-spend)
 * burnResetToken ต้องให้รายเดียวสำเร็จ อีกรายได้ false
 */
import { closeDb, getDb } from '@/lib/db';
import { passwordResetTokens, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import {
  burnResetToken,
  consumeResetToken,
  createResetToken,
  validateResetToken,
} from './reset-token';

const RUN = Date.now();
let userId: string;

beforeAll(async () => {
  const db = await getDb();
  userId = generateId();
  await db.insert(users).values({
    id: userId,
    email: `it-reset-token-${RUN}@placeholder.local`,
    role: 'officer',
    isActive: true,
    fullName: 'ทดสอบ token',
  });
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await closeDb();
});

describe('reset-token · single-use', () => {
  test('validate → burn ครั้งแรกสำเร็จ ครั้งที่สองได้ false', async () => {
    const plaintext = await createResetToken(userId);
    const row = await validateResetToken(plaintext);
    expect(row).not.toBeNull();

    const db = await getDb();
    expect(await burnResetToken(row!.id, db)).toBe(true);
    await expect(validateResetToken(plaintext)).resolves.toBeNull();
    expect(await burnResetToken(row!.id, db)).toBe(false);
  });

  test('createResetToken ใหม่ยกเลิกอันเก่า (ลิงก์ล่าสุดเท่านั้น)', async () => {
    const oldToken = await createResetToken(userId);
    expect(await validateResetToken(oldToken)).not.toBeNull();

    const newToken = await createResetToken(userId);
    expect(await validateResetToken(oldToken)).toBeNull();
    expect(await validateResetToken(newToken)).not.toBeNull();

    // ล้าง — เผาอันใหม่ทิ้งกันตกค้างข้าม test
    const db = await getDb();
    const row = await validateResetToken(newToken);
    await consumeResetToken(row!.id, db);
  });

  test('token ปลอม validate ไม่ผ่าน', async () => {
    expect(await validateResetToken('0'.repeat(64))).toBeNull();
    expect(await validateResetToken('')).toBeNull();
  });
});
