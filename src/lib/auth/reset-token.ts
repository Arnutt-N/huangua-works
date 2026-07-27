import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { firstOrUndefined } from '@/lib/db/query-helpers';
import { passwordResetTokens } from '@/lib/db/schema';
import { generateId } from '@/lib/id';

/**
 * Password reset token helpers
 *
 * Design: plaintext token (256-bit, from crypto.randomBytes) goes in the email
 * link; only its SHA-256 hash is persisted. A DB leak alone cannot reset a
 * password — the attacker would also need the email. Token is single-use and
 * expires after 1 hour.
 */

const TOKEN_BYTES = 32; // 256-bit entropy
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Generate a cryptographically random plaintext token (64 hex chars). */
export function generateResetToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

/** SHA-256 hash of a plaintext token (what gets stored in the DB). */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Create a reset token for a user. Invalidates all prior unused tokens for
 * that user first (only the latest link works), then inserts a fresh one.
 * Returns the plaintext token to embed in the email link.
 */
export async function createResetToken(userId: string): Promise<string> {
  const db = await getDb();
  const plaintext = generateResetToken();
  const tokenHash = hashResetToken(plaintext);
  const now = new Date();

  // ยกเลิก token เก่าที่ยังไม่ได้ใช้ทั้งหมด — ลิงก์ล่าสุดเท่านั้นที่ใช้ได้
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

  await db.insert(passwordResetTokens).values({
    id: generateId(),
    userId,
    tokenHash,
    expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS),
  });

  return plaintext;
}

/**
 * Validate a plaintext token: exists, unused, and unexpired.
 * Returns the token row (with userId) if valid, otherwise null.
 * Does NOT mark the token used — call consumeResetToken after the password
 * is actually updated (so a failed password update doesn't burn the token).
 */
export async function validateResetToken(token: string) {
  if (!token) return null;
  const db = await getDb();
  const tokenHash = hashResetToken(token);

  const row = await firstOrUndefined(
    db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, tokenHash)).limit(1),
  );
  if (!row) return null;

  // constant-time compare กัน timing oracle (แม้ token 256-bit จะเดาไม่ได้อยู่แล้ว)
  const expected = Buffer.from(row.tokenHash, 'utf8');
  const actual = Buffer.from(tokenHash, 'utf8');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  if (row.usedAt !== null) return null;
  if (row.expiresAt.getTime() <= Date.now()) return null;

  return row;
}

/** Mark a token as used (call after successful password update). */
export async function consumeResetToken(id: string): Promise<void> {
  const db = await getDb();
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.id, id));
}
