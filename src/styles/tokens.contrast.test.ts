import { describe, it, expect } from 'vitest';
import { countFailures } from '../../scripts/check-contrast';

/**
 * Gate ตรวจ contrast ของ design token — ห่อ scripts/check-contrast.ts ไว้ใน vitest
 *
 * § ทำไมต้องเป็น test file ไม่ใช่ `pretest` script
 * `.github/workflows/ci.yml` เรียก `pnpm vitest run` ตรง ๆ ไม่ผ่าน `pnpm test`
 * ดังนั้น npm lifecycle hook อย่าง pretest จะไม่ถูก trigger เลย และเมื่อ GitHub
 * Actions ถูกปิดอยู่ (เหตุผลค่าใช้จ่าย) การรันในเครื่องคือด่านเดียวที่มี — gate
 * ที่ต้องรอให้คนจำได้ว่าต้องสั่ง `pnpm check-contrast` จึงไม่ใช่ gate จริง
 *
 * การมีอยู่ในรูป test ทำให้มันรันทุกครั้งที่ใครก็ตามรันเทส ไม่ว่าจะเรียกด้วยคำสั่งไหน
 */
describe('design tokens — WCAG contrast', () => {
  it('ทุกคู่สีใน tokens.css ผ่านเกณฑ์ทั้งธีม light และ dark', () => {
    // quiet = true — ไม่ให้ log ของ script ท่วม output ของ vitest
    expect(countFailures(true)).toBe(0);
  });
});
