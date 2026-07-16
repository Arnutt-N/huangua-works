import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// § โหลด .env.local เพื่อให้ `pnpm db:generate`/`db:push` รันได้โดยไม่ต้อง export env
// เองใน shell ทุกครั้ง (เหมือนที่ vitest.config.ts / playwright.config.ts ทำอยู่แล้ว).
// override:false = ถ้ามี env จริงอยู่แล้ว (production/CI) ใช้ค่านั้น ไม่เขียนทับ.
config({ path: '.env.local', override: false });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set (expected postgresql://...). Copy .env.example to .env and configure it.'
  );
}

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});