/** Postgres unique_violation (23505) — ใช้แยก 409 ออกจาก error อื่นตอน insert ชน unique index */
export function isUniqueViolation(error: unknown): boolean {
  return pgCode(error) === '23505';
}

/**
 * § Drizzle ห่อ pg error ไว้ใน DrizzleQueryError.cause — เช็ค .code ชั้นนอกอย่างเดียว
 * ไม่มีวันเจอ (พิสูจน์ด้วยการรันจริง: ctor DrizzleQueryError, code อยู่ cause)
 * จึงแกะ cause ด้วย (ชั้นเดียวพอตาม shape ปัจจุบัน)
 */
export function pgCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const direct = (error as { code?: unknown }).code;
  if (typeof direct === 'string') return direct;
  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause === 'object' && cause !== null) {
    const nested = (cause as { code?: unknown }).code;
    if (typeof nested === 'string') return nested;
  }
  return undefined;
}
