import { config } from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

// E2E test เข้าถึง Postgres/Redis ของจริง (ผ่าน src/lib/db, src/lib/upstash โดยตรง
// ในไฟล์ spec) ต้องโหลด DATABASE_URL/Redis vars จาก .env.local ก่อน
config({ path: '.env.local' });

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // ทดสอบตัดกันเรื่อง rate-limit/dedup ถ้ารันขนาน (ใช้ DB/Redis จริงตัวเดียวกัน)
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 120_000, // cold Turbopack compilation ใช้ 30-60s ต่อหน้า
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    permissions: ['clipboard-read', 'clipboard-write'],
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx next dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      S3_ENDPOINT: 'http://localhost:9000',
      S3_REGION: 'us-east-1',
      S3_ACCESS_KEY_ID: 'dummy-access-key',
      S3_SECRET_ACCESS_KEY: 'dummy-secret-key-32-chars-minimum',
      S3_BUCKET: 'huangua-media',
    },
  },
});
