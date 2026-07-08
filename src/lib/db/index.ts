import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * DB — PostgreSQL connection singleton (postgres-js, pure JS, no native build)
 *
 * Migrated from better-sqlite3 (sync) → postgres-js (async).
 * - lazy-init: สร้าง pool เมื่อเรียกครั้งแรกเท่านั้น (avoid build-time connect)
 * - pool size 10 (mitigate postgres-js pure-JS overhead vs native)
 * - foreign_keys pragma ถูกลบ (SQLite-only — PG enforce FK ที่ column definition)
 * - WAL pragma ถูกลบ (PG ใช้ MVCC ไม่ใช้ WAL mode toggle)
 */

let dbInstance: PostgresJsDatabase<typeof schema> | null = null;
let pgClient: postgres.Sql | null = null;

export async function getDb(): Promise<PostgresJsDatabase<typeof schema>> {
  if (dbInstance) return dbInstance;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set (expected postgresql://...)');
  }

  // prepare=true รวม parse cache; max=10 จำกัด pool; ssl ตาม connection string
  pgClient = postgres(url, { max: 10, prepare: true });
  dbInstance = drizzle(pgClient, { schema });

  return dbInstance;
}

/**
 * ปิด connection pool (ใช้ใน script/telemetry เท่านั้น — Next.js route ไม่ควรเรียก)
 */
export async function closeDb(): Promise<void> {
  if (pgClient) {
    await pgClient.end();
    pgClient = null;
    dbInstance = null;
  }
}

export { schema };
export type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';