import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      // ค่าคงที่สำหรับ test เท่านั้น — cid-hmac.ts อ่าน env ตอน module load
      // ต้องตั้งไว้ก่อน import ถึงจะมีผล (ไม่ใช่ secret จริง ไม่ใช้ที่ไหนนอก test)
      CID_HMAC_KEY: 'test-only-cid-hmac-key-not-a-real-secret-x32chars',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/app/**', 'src/components/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
