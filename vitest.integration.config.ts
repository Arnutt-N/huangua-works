import base from './vitest.config';
import { defineConfig, mergeConfig } from 'vitest/config';

/**
 * Config สำหรับ integration test (`*.integration.test.ts`) ที่ต้องใช้ DB จริง
 * — รันด้วย `npx vitest run --config vitest.integration.config.ts`
 *   (หรือ `npm run test:integration`) — ต้องมี Docker stack ขึ้นก่อน:
 *   `docker compose up -d postgres redis up-redis`
 */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['src/**/*.integration.test.ts'],
      exclude: ['**/node_modules/**'],
    },
  }),
);
