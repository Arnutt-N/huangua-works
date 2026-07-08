import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

/**
 * DB — SQLite connection singleton
 * ใช้ better-sqlite3 (synchronous, fast, single-process)
 */

let dbInstance: BetterSQLite3Database<typeof schema> | null = null;

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (!dbInstance) {
    const dbPath = process.env.DATABASE_URL || './data/huangua.db';
    const sqlite = new Database(dbPath);

    // Enable WAL mode (Write-Ahead Logging) for better concurrency
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    dbInstance = drizzle(sqlite, { schema });
  }

  return dbInstance;
}

export { schema };
export type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
