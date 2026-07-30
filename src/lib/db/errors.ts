/** Postgres unique_violation (23505) — ใช้แยก 409 ออกจาก error อื่นตอน insert ชน unique index */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  );
}
