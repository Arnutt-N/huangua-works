import base from './vitest.config';
import { defineConfig } from 'vitest/config';
import type { UserConfig } from 'vitest/config';

/**
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
