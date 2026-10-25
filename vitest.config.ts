import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // § default exclude ของ vitest มี node_modules — ต้องรวมไว้ด้วยหรือมันจะกวาด node_modules
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/*.integration.test.ts'],
    // integration test (*.integration.test.ts) ต้องมี local Postgres + Redis
    // รันอยู่จริง (`docker compose up -d postgres redis up-redis`) — โหลด
    // DATABASE_URL/Redis vars จาก .env.local ผ่านไฟล์นี้ ไม่กระทบ unit test ปกติ
    setupFiles: ['./vitest.setup.ts'],
    env: {
      // ค่าคงที่สำหรับ unit test เท่านั้น — cid-hmac.ts อ่าน env สดทุกครั้งที่ hash ตั้งไว้ที่นี่
      // ให้ทุก test มี key ผ่าน minLen โดยไม่ต้อง stub เอง (ไม่ใช่ secret จริง ไม่ใช้ที่ไหนนอก test)
      // ถูก override ด้วยค่าจริงจาก .env.local สำหรับ integration test (ทั้งคู่ผ่าน minLen check เดิม)
      CID_HMAC_KEY: 'test-only-cid-hmac-key-not-a-real-secret-x32chars',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/components/**'],
    },
    // § contract test เรียก Auth.js ตัวติดตั้งจริงผ่าน vite pipeline (พอร์ตจาก proof config)
    server: {
      deps: { inline: ['next-auth'] },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // § next/* ชี้ไฟล์จริงเพื่อให้ contract test เรียก Auth.js ตัวติดตั้งจริงได้
      // (พอร์ตจาก .audit/pr118-blast/proof.config.mts — ไม่กระทบเทสเดิมที่ไม่ได้ import next/*)
      'next/server': import.meta.resolve('next/server.js'),
      'next/headers': import.meta.resolve('next/headers.js'),
      'next/navigation': import.meta.resolve('next/navigation.js'),
      'next/cache': import.meta.resolve('next/cache.js'),
    },
  },
});
