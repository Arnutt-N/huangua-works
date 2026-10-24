import base from './vitest.config';
import { defineConfig } from 'vitest/config';
import type { UserConfig } from 'vitest/config';

/**
 * Config สำหรับ integration test (`*.integration.test.ts`) ที่ต้องใช้ DB จริง
 * — รันด้วย `npx vitest run --config vitest.integration.config.ts`
 *   (หรือ `npm run test:integration`) — ต้องมี Docker stack ขึ้นก่อน:
 *   `docker compose up -d postgres redis up-redis`
 *
 * § ห้ามใช้ mergeConfig: merge รวม array แบบต่อกัน ทำให้ exclude ของ base
 * (`**\/*.integration.test.ts`) ค้างอยู่ → ไม่มีไฟล์ integration ถูกเลือกเลย
 * (เคยรันแล้วได้ unit suite ซ้ำ 134 ไฟล์) จึง override include/exclude ตรง ๆ
 */
const baseConfig = base as UserConfig;

export default defineConfig({
  ...baseConfig,
  test: {
    ...baseConfig.test,
    include: ['src/**/*.integration.test.ts'],
    exclude: ['**/node_modules/**'],
  },
});
