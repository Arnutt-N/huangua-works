/**
 * เช็คหมดอายุของ session token จาก `expiresAt` claim (unix seconds)
 *
 * Dependency-free โดยเจตนา (ไม่แตะ DB/driver ใด ๆ) เพื่อให้ import ได้ทั้งจาก
 * Node runtime (src/auth.ts) และ edge runtime (src/auth.config.ts / middleware)
 * ที่ต่อ Postgres ไม่ได้ — กัน logic หมดอายุกระจายซ้ำสองที่ (เคยคัดลอก manual
 * check ไว้ทั้ง auth.ts และ auth.config.ts)
 */
export function isTokenExpired(expiresAt: number | undefined): boolean {
  return expiresAt !== undefined && expiresAt < Math.floor(Date.now() / 1000);
}
