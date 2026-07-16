import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // integration test (*.integration.test.ts) ต้องมี local Postgres + Redis
    // รันอยู่จริง (`docker compose up -d postgres redis up-redis`) — โหลด
    // DATABASE_URL/Redis vars จาก .env.local ผ่านไฟล์นี้ ไม่กระทบ unit test ปกติ
    setupFiles: ['./vitest.setup.ts'],
    env: {
      // ค่าคงที่สำหรับ unit test เท่านั้น — cid-hmac.ts อ่าน env ตอน module load
      // ต้องตั้งไว้ก่อน import ถึงจะมีผล (ไม่ใช่ secret จริง ไม่ใช้ที่ไหนนอก test)
      // ถูก override ด้วยค่าจริงจาก .env.local สำหรับ integration test (ทั้งคู่ผ่าน minLen check เดิม)
      CID_HMAC_KEY: 'test-only-cid-hmac-key-not-a-real-secret-x32chars',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/components/**'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
