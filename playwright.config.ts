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
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
