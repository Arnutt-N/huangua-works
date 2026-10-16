import bcrypt from 'bcryptjs';
import { CredentialsSignin } from 'next-auth';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * authorizeCredentials — ด่านออก JWT ของ staff login
 * ล็อก 2 อย่าง: (1) รหัสผิด/ไม่มี user = null เหมือนกันทุกกรณี (ไม่เป็น oracle)
 * (2) citizen/บัญชีระงับที่รหัสถูก ไม่ได้ user กลับไป แต่ได้ IneligibleAccountSignin พร้อมเหตุผล
 */

const { mockState } = vi.hoisted(() => ({
  mockState: { rows: [] as Array<Record<string, unknown>> },
}));

// § next-auth import ใน vitest ไม่ได้ (resolve next/server ผ่าน pnpm layout ไม่เจอ) — stub เฉพาะ
// CredentialsSignin; ทุกโมดูลใน test ได้ class ตัวเดียวกัน instanceof จึงยังพิสูจน์ได้
vi.mock('next-auth', () => ({
  CredentialsSignin: class CredentialsSignin extends Error {
    code = 'credentials';
  },
}));

vi.mock('@/lib/db', () => ({
  getDb: vi.fn(async () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => mockState.rows }),
      }),
    }),
  })),
}));

const { authorizeCredentials } = await import('./authorize-credentials');
const { IneligibleAccountSignin } = await import('./login-errors');

const PASSWORD = 'correct-pw';
const HASH = bcrypt.hashSync(PASSWORD, 4);

function userRow(over: Record<string, unknown> = {}) {
  return {
    id: 'u1',
    email: 'staff@example.test',
    role: 'officer',
    isActive: true,
    passwordHash: HASH,
    passwordVersion: 3,
    ...over,
  };
}

beforeEach(() => {
  mockState.rows = [];
});

describe('authorizeCredentials', () => {
  it('staff active + รหัสถูก → คืนข้อมูลที่ฝังลง JWT (ไม่มี passwordHash)', async () => {
    mockState.rows = [userRow()];

    const user = await authorizeCredentials({ email: ' Staff@Example.test ', password: PASSWORD });

    expect(user).toEqual({
      id: 'u1',
      email: 'staff@example.test',
      role: 'officer',
      passwordVersion: 3,
      remember: false,
    });
  });

  it("remember 'on' → remember true", async () => {
    mockState.rows = [userRow()];
    const user = await authorizeCredentials({ email: 'staff@example.test', password: PASSWORD, remember: 'on' });
    expect(user?.remember).toBe(true);
  });

  it('รหัสผิด → null', async () => {
    mockState.rows = [userRow()];
    expect(await authorizeCredentials({ email: 'staff@example.test', password: 'wrong' })).toBeNull();
  });

  it('ไม่มี user → null', async () => {
    expect(await authorizeCredentials({ email: 'nobody@example.test', password: PASSWORD })).toBeNull();
  });

  it.each([
    [{ email: '', password: PASSWORD }],
    [{ email: 'staff@example.test', password: '' }],
    [undefined],
  ])('input ว่าง/ไม่ครบ → null', async (credentials) => {
    expect(await authorizeCredentials(credentials)).toBeNull();
  });

  it('บัญชีระงับ + รหัสถูก → IneligibleAccountSignin(inactive) ไม่ออก JWT', async () => {
    mockState.rows = [userRow({ isActive: false })];

    const error = await authorizeCredentials({ email: 'staff@example.test', password: PASSWORD }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(IneligibleAccountSignin);
    expect(error).toBeInstanceOf(CredentialsSignin);
    expect(error).toMatchObject({ reason: 'inactive', code: 'inactive', userId: 'u1' });
  });

  it('citizen + รหัสถูก → IneligibleAccountSignin(citizen_role)', async () => {
    mockState.rows = [userRow({ role: 'citizen' })];

    await expect(
      authorizeCredentials({ email: 'staff@example.test', password: PASSWORD }),
    ).rejects.toMatchObject({ reason: 'citizen_role' });
  });

  it.each([{ isActive: false }, { role: 'citizen' }])(
    'บัญชีไม่มีสิทธิ์แต่รหัสผิด → null (ไม่เผยเหตุผลก่อนพิสูจน์รหัส) %o',
    async (over) => {
      mockState.rows = [userRow(over)];
      expect(await authorizeCredentials({ email: 'staff@example.test', password: 'wrong' })).toBeNull();
    },
  );
});
