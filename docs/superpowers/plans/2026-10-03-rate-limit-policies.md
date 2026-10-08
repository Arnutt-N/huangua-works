# Rate Limit Policies (นโยบาย rate limit อยู่ใน module) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ย้ายนโยบาย rate limit ทั้ง 10 ตัว (จำนวน, window, ปิด/เปิดเมื่อ Redis ล่ม, รูปแบบ key) และการอ่าน IP ของ client มาไว้ใน module เดียว ให้ caller เลือกนโยบายตาม "ชื่อ" และมี unit test ยืนยันว่าทุก auth path เป็น fail-closed

**Architecture:** สร้าง `src/lib/rate-limit/` 3 ไฟล์ — `policies.ts` (pure, ไม่ import อะไร: ตารางนโยบาย + `rateLimitKey`), `client-ip.ts` (pure: `clientIpFromHeaders`), `enforce.ts` (`enforceRateLimit(name, subject)` ซึ่งเรียก `checkRateLimit` เดิม) `checkRateLimit` ใน `src/lib/upstash.ts` ไม่แตะเลย (internals zadd→zrank มี `§` กำกับ) caller 8 ไฟล์ย้ายมาเรียก `enforceRateLimit` และ `getClientIp` ใน `require-staff.ts` กลายเป็น wrapper ของ `clientIpFromHeaders` รูปแบบ key คงเดิมทุก byte (`rate:<scope>:<subject>`) จึงไม่มี key ใน Redis production ถูก reset ตอน deploy และ e2e ย้ายไปสร้าง key ผ่าน `rateLimitKey` แทนสตริงตรง

**Tech Stack:** Next.js 16, TypeScript 5 (`satisfies`), `@upstash/redis` (REST) ผ่าน up-redis (:8081 ตาม `.env.local`), Vitest 3, Playwright

**Spec:** `project-log-md/architecture-review/2026-10-03/architecture-review-20261003-205746.html` — การ์ด `id="c7"` ("นโยบาย rate limit อยู่ใน module ไม่ใช่ในความจำของ caller")

## Global Constraints

- ใช้ `npx` แทน `pnpm` ทุกคำสั่ง (`pnpm` ค้างใน environment นี้)
- ทำงานบน branch `refactor/rate-limit-policies`; GitHub Actions ปิดโดยตั้งใจ — gate จริงคือ `npx tsc --noEmit`, `npx eslint .`, `npx vitest run` + Vercel Preview
- **ห้ามแก้ `src/lib/upstash.ts`** (signature `checkRateLimit(key, limit, windowSeconds, opts: { failOpen?: boolean } = {})` และลำดับ zremrangebyscore → zadd → expire → zrank ต้องคงเดิม) และ **ห้ามแก้** `src/lib/upstash.test.ts`, `src/lib/upstash.integration.test.ts` — ต้องผ่านเหมือนเดิม
- รูปแบบ key ต้องเหมือนเดิมทุก byte: `rate:admin-login:ip:<ip>`, `rate:admin-login:email:<normalizedEmail>`, `rate:pw-reset:ip:<ip>`, `rate:pw-reset:email:<email>`, `rate:pw-reset:complete:<ip>`, `rate:change-password:<userId>`, `rate:liff-session:<ip>`, `rate:consent-withdraw:<ip>`, `rate:submit:<ip>`, `rate:track:<ip>`
- ค่า limit/window/policy ต้องเท่าเดิม: admin-login ip 5/900 ปิด, admin-login email 5/900 ปิด, pw-reset ip 5/900 ปิด, pw-reset email **3**/900 ปิด, pw-reset complete 5/900 ปิด, change-password 5/900 ปิด, liff-session 5/300 ปิด, consent-withdraw 5/600 ปิด, submit 3/300 **เปิด**, track 10/300 **เปิด**
- ข้อความ 429 / error ที่ผู้ใช้เห็นต้องคงเดิมทุกตัวอักษร (เปลี่ยนแค่บรรทัดที่เรียก rate limit)
- `src/lib/rate-limit/policies.ts` และ `client-ip.ts` ห้าม import อะไรเลย — e2e (Playwright process) import ตรงจาก `../src/lib/rate-limit/policies`
- comment ภาษาไทย; `§` สำหรับการตัดสินใจที่ไม่ชัดเจน; **ห้ามลบ `§` comment เดิมของ caller** (ถ้าข้อความอ้าง `failOpen: false` ให้คงไว้และเติมบรรทัดอ้างชื่อ policy)
- **ชนกับ plan อื่น:** `src/app/api/consent/withdraw/route.ts` และ `src/app/api/cases/submit/route.ts` ถูกแก้โดย plan `citizen-case-access` และ (withdraw) plan `audited-writes` ด้วย — hunk ของ plan นี้คือส่วนหัวของ handler (อ่าน IP + rate limit) และบรรทัด import เท่านั้น ถ้า plan เหล่านั้น merge ก่อน ให้ `git rebase origin/main` แล้วอ่านไฟล์ใหม่ก่อนทำ Task 4 และคงการเปลี่ยนแปลงของ plan นั้นไว้ทั้งหมด
- commit แบบ conventional commits (`refactor(rate-limit): …`, `test(rate-limit): …`) — push/PR เฉพาะเมื่อผู้ใช้อนุญาต

---

## สถานะปัจจุบัน (8 caller, 10 นโยบาย)

| caller | บรรทัด | key | limit/window | failOpen | อ่าน IP จาก |
|---|---|---|---|---|---|
| `src/app/admin/actions.ts` (`login`) | `:42-47` | `rate:admin-login:ip:${ip}` | 5/900 | false | `getClientIp()` |
| 〃 | 〃 | `rate:admin-login:email:${normalizedEmail}` | 5/900 | false | — |
| `src/app/admin/actions/reset.ts` (`requestPasswordReset`) | `:69-72` | `rate:pw-reset:ip:${ip}` | 5/900 | false | `getClientIp()` |
| 〃 | 〃 | `rate:pw-reset:email:${email}` | 3/900 | false | — |
| `src/app/admin/actions/reset.ts` (`completePasswordReset`) | `:155-157` | `rate:pw-reset:complete:${ip}` | 5/900 | false | `getClientIp()` |
| `src/app/admin/actions/profile.ts` (`changeOwnPassword`) | `:91-93` | `rate:change-password:${actor.id}` | 5/900 | false | — |
| `src/app/api/liff/session/route.ts` (`POST`) | `:107-113` | `rate:liff-session:${ip}` | 5/300 | false | inline |
| `src/app/api/consent/withdraw/route.ts` (`POST`) | `:34-42` | `rate:consent-withdraw:${ip}` | 5/600 | false | inline |
| `src/app/api/cases/submit/route.ts` (`POST`) | `:15-19` | `rate:submit:${ip}` | 3/300 | (default true) | inline |
| `src/app/api/cases/[id]/route.ts` (`GET`) | `:32-35` | `rate:track:${ip}` | 10/300 | (default true) | inline |

e2e ล้าง key ด้วยสตริงตรง: `e2e/admin-auth.spec.ts:23`, `e2e/admin-chat.spec.ts:8`, `e2e/intake-liff.spec.ts:31,41,87,108,118`, `e2e/intake.spec.ts:16`, `e2e/track-liff.spec.ts:22`

---

## File Structure

| ไฟล์ | การเปลี่ยนแปลง | ความรับผิดชอบ |
|---|---|---|
| `src/lib/rate-limit/policies.ts` | Create | ตารางนโยบาย + `rateLimitKey` (pure) |
| `src/lib/rate-limit/policies.test.ts` | Create | auth ⇒ fail-closed, ค่า limit/window, รูปแบบ key |
| `src/lib/rate-limit/client-ip.ts` | Create | `clientIpFromHeaders` (pure) |
| `src/lib/rate-limit/client-ip.test.ts` | Create | ลำดับ x-forwarded-for → x-real-ip → 'unknown' |
| `src/lib/rate-limit/enforce.ts` | Create | `enforceRateLimit(name, subject)` → `checkRateLimit` |
| `src/lib/rate-limit/enforce.test.ts` | Create | Redis ล่ม: auth ปิด / public เปิด; ส่ง key ถูก |
| `src/lib/auth/require-staff.ts` | Modify `:12-19` | `getClientIp` ใช้ `clientIpFromHeaders` |
| `src/app/admin/actions.ts` | Modify `:11`, `:42-47` | ใช้ policy |
| `src/app/admin/actions/reset.ts` | Modify `:10`, `:69-72`, `:155-157` | ใช้ policy |
| `src/app/admin/actions/profile.ts` | Modify `:11`, `:91-93` | ใช้ policy |
| `src/app/api/liff/session/route.ts` | Modify `:7`, `:107-113` | ใช้ policy + IP |
| `src/app/api/consent/withdraw/route.ts` | Modify `:20`, `:34-42` | ใช้ policy + IP |
| `src/app/api/cases/submit/route.ts` | Modify `:9`, `:15-19` | ใช้ policy + IP |
| `src/app/api/cases/[id]/route.ts` | Modify `:21`, `:32-35` | ใช้ policy + IP |
| `e2e/helpers/reset-rate-limits.ts` | Modify | เพิ่ม `E2E_CLIENT_IP` |
| `e2e/admin-auth.spec.ts`, `e2e/admin-chat.spec.ts`, `e2e/intake-liff.spec.ts`, `e2e/intake.spec.ts`, `e2e/track-liff.spec.ts` | Modify (บรรทัด resetRateLimits + import) | สร้าง key ผ่าน `rateLimitKey` |

---

### Task 0: เตรียม branch และ baseline

**Files:** ไม่มี

**Interfaces:**
- Consumes: ไม่มี
- Produces: branch `refactor/rate-limit-policies`

- [ ] **Step 1: แตก branch**

ถ้า checkout ปฏิเสธเพราะไฟล์ untracked/modified ที่ไม่เกี่ยวข้อง (`.gitignore`, `AGENTS.md`, `next-env.d.ts`, `.claude/…`) ให้ `git stash push -u -m "pre-rate-limit-policies"` ก่อน แล้ว `git stash pop` หลังจบงาน

```bash
git checkout main && git pull && git checkout -b refactor/rate-limit-policies
```

Expected: `Switched to a new branch 'refactor/rate-limit-policies'`

- [ ] **Step 2: baseline**

```bash
docker compose up -d postgres redis up-redis
npx vitest run src/lib/upstash.test.ts src/lib/upstash.integration.test.ts src/app/api/cases/submit/route.integration.test.ts "src/app/api/cases/[id]/route.integration.test.ts"
```

Expected: PASS ทั้งหมด — ถ้าไม่ผ่าน หยุดและแก้ environment ก่อน

---

### Task 1: ตารางนโยบาย + รูปแบบ key (pure)

**Files:**
- Create: `src/lib/rate-limit/policies.ts`
- Test: `src/lib/rate-limit/policies.test.ts`

**Interfaces:**
- Consumes: ไม่มี
- Produces:
  ```ts
  export type RateLimitKind = 'auth' | 'public';
  export interface RateLimitPolicy {
    readonly prefix: string;
    readonly limit: number;
    readonly windowSeconds: number;
    readonly kind: RateLimitKind;
    readonly failClosed: boolean;
  }
  export const RATE_LIMIT_POLICIES: { readonly adminLoginIp: …; adminLoginEmail; pwResetIp; pwResetEmail; pwResetComplete; changePassword; liffSession; consentWithdraw; submit; track }
  export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;
  export function rateLimitKey(name: RateLimitPolicyName, subject: string): string;
  ```

- [ ] **Step 1: เขียน test**

สร้าง `src/lib/rate-limit/policies.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RATE_LIMIT_POLICIES, rateLimitKey, type RateLimitPolicyName } from './policies';

const NAMES = Object.keys(RATE_LIMIT_POLICIES) as RateLimitPolicyName[];

describe('RATE_LIMIT_POLICIES · auth path ต้อง fail-closed', () => {
  it('ทุก policy ชนิด auth ปฏิเสธเมื่อ Redis ล่ม', () => {
    // § กติกานี้เคยอยู่แค่ใน § comment ของแต่ละ caller และค่า default ของ
    // checkRateLimit คือ fail-open — ลืมใส่ { failOpen: false } ที่ path ไหน
    // brute-force protection ของ path นั้นหายเงียบ ๆ ทันทีที่ Redis ล่ม
    const authPolicies = NAMES.filter((n) => RATE_LIMIT_POLICIES[n].kind === 'auth');
    for (const name of authPolicies) {
      expect({ name, failClosed: RATE_LIMIT_POLICIES[name].failClosed }).toEqual({ name, failClosed: true });
    }
  });

  it('ชุด auth path ตรงตามที่ตั้งใจ — เพิ่ม/ลบ/เปลี่ยน kind ต้องแก้ test นี้อย่างรู้ตัว', () => {
    const authPolicies = NAMES.filter((n) => RATE_LIMIT_POLICIES[n].kind === 'auth').sort();
    expect(authPolicies).toEqual(
      [
        'adminLoginEmail',
        'adminLoginIp',
        'changePassword',
        'consentWithdraw',
        'liffSession',
        'pwResetComplete',
        'pwResetEmail',
        'pwResetIp',
      ].sort(),
    );
  });

  it('public path เปิดเมื่อ Redis ล่ม — บริการประชาชนต้องไม่ล่มตาม Redis', () => {
    expect(RATE_LIMIT_POLICIES.submit).toMatchObject({ kind: 'public', failClosed: false });
    expect(RATE_LIMIT_POLICIES.track).toMatchObject({ kind: 'public', failClosed: false });
  });
});

describe('RATE_LIMIT_POLICIES · ค่าเท่าเดิมก่อน refactor', () => {
  it.each<[RateLimitPolicyName, number, number]>([
    ['adminLoginIp', 5, 900],
    ['adminLoginEmail', 5, 900],
    ['pwResetIp', 5, 900],
    ['pwResetEmail', 3, 900],
    ['pwResetComplete', 5, 900],
    ['changePassword', 5, 900],
    ['liffSession', 5, 300],
    ['consentWithdraw', 5, 600],
    ['submit', 3, 300],
    ['track', 10, 300],
  ])('%s = %i ครั้ง / %i วินาที', (name, limit, windowSeconds) => {
    expect(RATE_LIMIT_POLICIES[name]).toMatchObject({ limit, windowSeconds });
  });
});

describe('rateLimitKey · รูปแบบ key เหมือนเดิมทุก byte', () => {
  // § key ใน Redis production ที่กำลังนับอยู่ตอน deploy ต้องนับต่อได้ และ e2e ล้าง key ตามชื่อ
  it.each<[RateLimitPolicyName, string, string]>([
    ['adminLoginIp', '::1', 'rate:admin-login:ip:::1'],
    ['adminLoginEmail', 'admin@huangua.go.th', 'rate:admin-login:email:admin@huangua.go.th'],
    ['pwResetIp', '203.0.113.5', 'rate:pw-reset:ip:203.0.113.5'],
    ['pwResetEmail', 'staff@huangua.go.th', 'rate:pw-reset:email:staff@huangua.go.th'],
    ['pwResetComplete', '203.0.113.5', 'rate:pw-reset:complete:203.0.113.5'],
    ['changePassword', 'user-123', 'rate:change-password:user-123'],
    ['liffSession', '::1', 'rate:liff-session:::1'],
    ['consentWithdraw', '203.0.113.5', 'rate:consent-withdraw:203.0.113.5'],
    ['submit', '::1', 'rate:submit:::1'],
    ['track', '203.0.113.5', 'rate:track:203.0.113.5'],
  ])('%s + %s → %s', (name, subject, expected) => {
    expect(rateLimitKey(name, subject)).toBe(expected);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run src/lib/rate-limit/policies.test.ts`
Expected: FAIL — `Failed to resolve import "./policies"`

- [ ] **Step 3: เขียน policies.ts**

สร้าง `src/lib/rate-limit/policies.ts`:

```ts
/**
 * นโยบาย rate limit ทั้งระบบ — ที่เดียวที่ตัดสินว่า path ไหนจำกัดกี่ครั้ง ต่อกี่วินาที
 * และ "ปิดหรือเปิด" เมื่อ Redis ล่ม caller เลือกนโยบายตามชื่อผ่าน enforceRateLimit()
 *
 * § ไฟล์นี้ห้าม import อะไรเลย (pure) — e2e/*.spec.ts import ตรงจาก Playwright process
 * เพื่อสร้าง key ที่จะล้าง ถ้าดึง @upstash/redis หรือ next/* เข้ามาจะโหลดไม่ได้ในนั้น
 *
 * § รูปแบบ key `rate:<scope>:<subject>` ต้องคงเดิมทุก byte — key ที่กำลังนับอยู่ใน Redis
 * production ตอน deploy จะนับต่อได้ (ไม่มีช่วงที่ limit ถูก reset ให้ attacker)
 *
 * kind = 'auth' คือ path ที่ยืนยันตัวตนหรือเป็น oracle ให้เดาความลับได้ (รหัสผ่าน, token,
 * CID, LINE ID token) — ต้อง failClosed เสมอ (Redis ล่ม = ปฏิเสธ) ไม่งั้น brute-force
 * protection หายเงียบ ๆ ตอน Redis ล่ม (บังคับด้วย policies.test.ts)
 * kind = 'public' คือบริการประชาชนที่ต้องไม่ล่มตาม Redis — failClosed: false
 */

export type RateLimitKind = 'auth' | 'public';

export interface RateLimitPolicy {
  readonly prefix: string;
  readonly limit: number;
  readonly windowSeconds: number;
  readonly kind: RateLimitKind;
  /** true = Redis ล่มแล้วปฏิเสธ (fail-secure) · false = ปล่อยผ่าน (fail-open) */
  readonly failClosed: boolean;
}

export const RATE_LIMIT_POLICIES = {
  // § จำกัดทั้งต่อ IP และต่อ email แยกกัน — IP ปลอมผ่าน X-Forwarded-For ได้ง่าย
  // แต่ per-email ผูกกับบัญชีเป้าหมาย ไม่ใช่ header ที่ client กำหนดเอง
  adminLoginIp: { prefix: 'rate:admin-login:ip', limit: 5, windowSeconds: 900, kind: 'auth', failClosed: true },
  adminLoginEmail: { prefix: 'rate:admin-login:email', limit: 5, windowSeconds: 900, kind: 'auth', failClosed: true },
  // กัน email bombing + brute-force ลอง email (per-email เข้มกว่า: 3 ครั้ง)
  pwResetIp: { prefix: 'rate:pw-reset:ip', limit: 5, windowSeconds: 900, kind: 'auth', failClosed: true },
  pwResetEmail: { prefix: 'rate:pw-reset:email', limit: 3, windowSeconds: 900, kind: 'auth', failClosed: true },
  pwResetComplete: { prefix: 'rate:pw-reset:complete', limit: 5, windowSeconds: 900, kind: 'auth', failClosed: true },
  // ฟอร์มยืนยันรหัสผ่านเดิม = oracle เดารหัสได้ถ้า session ถูกขโมย — subject คือ userId
  changePassword: { prefix: 'rate:change-password', limit: 5, windowSeconds: 900, kind: 'auth', failClosed: true },
  liffSession: { prefix: 'rate:liff-session', limit: 5, windowSeconds: 300, kind: 'auth', failClosed: true },
  // ยืนยันตัวตนด้วย trackingCode + CID และทำงานทำลายข้อมูล (ถอนความยินยอม)
  consentWithdraw: { prefix: 'rate:consent-withdraw', limit: 5, windowSeconds: 600, kind: 'auth', failClosed: true },
  submit: { prefix: 'rate:submit', limit: 3, windowSeconds: 300, kind: 'public', failClosed: false },
  // กัน brute force tracking code — public แต่ข้อมูลที่คืนถอด PII แล้ว
  track: { prefix: 'rate:track', limit: 10, windowSeconds: 300, kind: 'public', failClosed: false },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyName = keyof typeof RATE_LIMIT_POLICIES;

export function rateLimitKey(name: RateLimitPolicyName, subject: string): string {
  return `${RATE_LIMIT_POLICIES[name].prefix}:${subject}`;
}
```

- [ ] **Step 4: รัน test**

Run: `npx vitest run src/lib/rate-limit/policies.test.ts`
Expected: PASS 23 tests (3 + 10 + 10)

- [ ] **Step 5: Commit**

```bash
git add src/lib/rate-limit/policies.ts src/lib/rate-limit/policies.test.ts
git commit -m "feat(rate-limit): ตารางนโยบาย rate limit + rateLimitKey พร้อม test ว่า auth path fail-closed"
```

---

### Task 2: `clientIpFromHeaders` + `enforceRateLimit`

**Files:**
- Create: `src/lib/rate-limit/client-ip.ts`, `src/lib/rate-limit/client-ip.test.ts`
- Create: `src/lib/rate-limit/enforce.ts`, `src/lib/rate-limit/enforce.test.ts`
- Modify: `src/lib/auth/require-staff.ts:12-19`

**Interfaces:**
- Consumes: `RATE_LIMIT_POLICIES`, `rateLimitKey`, `RateLimitPolicyName` จาก Task 1; `checkRateLimit(key: string, limit: number, windowSeconds: number, opts?: { failOpen?: boolean }): Promise<{ allowed: boolean; remaining: number; reset: number }>` จาก `src/lib/upstash.ts`
- Produces:
  ```ts
  // client-ip.ts
  export interface HeaderReader { get(name: string): string | null }
  export function clientIpFromHeaders(headers: HeaderReader): string
  // enforce.ts
  export type RateLimitResult = { allowed: boolean; remaining: number; reset: number };
  export async function enforceRateLimit(name: RateLimitPolicyName, subject: string): Promise<RateLimitResult>
  // require-staff.ts (signature เดิม)
  export async function getClientIp(): Promise<string>
  ```

- [ ] **Step 1: เขียน test ของ client-ip**

สร้าง `src/lib/rate-limit/client-ip.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clientIpFromHeaders } from './client-ip';

describe('clientIpFromHeaders', () => {
  it('ใช้ IP แรกของ x-forwarded-for และตัดช่องว่าง', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': ' 203.0.113.1 , 10.0.0.1' }))).toBe('203.0.113.1');
  });

  it('ไม่มี x-forwarded-for → ใช้ x-real-ip', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
  });

  it('x-forwarded-for ว่าง → ใช้ x-real-ip', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '', 'x-real-ip': '198.51.100.3' }))).toBe('198.51.100.3');
  });

  it('ไม่มีทั้งคู่ → unknown', () => {
    expect(clientIpFromHeaders(new Headers())).toBe('unknown');
  });

  it('IPv6 loopback ของ next dev ผ่านได้ตรง ๆ (e2e ใช้ ::1)', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-forwarded-for': '::1' }))).toBe('::1');
  });
});
```

- [ ] **Step 2: เขียน test ของ enforce**

สร้าง `src/lib/rate-limit/enforce.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RATE_LIMIT_POLICIES, type RateLimitPolicyName } from './policies';

/**
 * enforceRateLimit — พิสูจน์ "ระดับพฤติกรรม" ว่า auth path ปิดจริงเมื่อ Redis ล่ม
 * (policies.test.ts พิสูจน์แค่ตาราง ไฟล์นี้พิสูจน์ว่าตารางถูกส่งต่อให้ checkRateLimit ถูก)
 * mock ที่ระดับ @upstash/redis เพื่อให้ checkRateLimit ตัวจริงทำงาน
 */
const redisState = vi.hoisted(() => ({ down: false, keys: [] as string[] }));

vi.mock('@upstash/redis', () => {
  const guard = async () => {
    if (redisState.down) throw new Error('ECONNREFUSED');
  };
  return {
    Redis: class {
      zremrangebyscore = async (key: string) => {
        await guard();
        redisState.keys.push(key);
      };
      zadd = async () => guard();
      expire = async () => guard();
      zrank = async () => {
        await guard();
        return 0;
      };
      zrange = async () => {
        await guard();
        return [];
      };
    },
  };
});

const { enforceRateLimit } = await import('./enforce');
const NAMES = Object.keys(RATE_LIMIT_POLICIES) as RateLimitPolicyName[];

beforeEach(() => {
  redisState.down = false;
  redisState.keys = [];
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('enforceRateLimit · Redis ล่ม', () => {
  it.each(NAMES.filter((n) => RATE_LIMIT_POLICIES[n].kind === 'auth'))('%s (auth) ปฏิเสธ', async (name) => {
    redisState.down = true;
    const result = await enforceRateLimit(name, 'subject');
    expect(result.allowed).toBe(false);
  });

  it.each(NAMES.filter((n) => RATE_LIMIT_POLICIES[n].kind === 'public'))('%s (public) ปล่อยผ่าน', async (name) => {
    redisState.down = true;
    const result = await enforceRateLimit(name, 'subject');
    expect(result.allowed).toBe(true);
  });
});

describe('enforceRateLimit · Redis ปกติ', () => {
  it('ส่ง key ตาม rateLimitKey และ limit ตามตาราง', async () => {
    const result = await enforceRateLimit('submit', '203.0.113.9');

    expect(redisState.keys).toEqual(['rate:submit:203.0.113.9']);
    expect(result).toEqual({ allowed: true, remaining: RATE_LIMIT_POLICIES.submit.limit - 1, reset: 300 });
  });
});
```

- [ ] **Step 3: รันให้เห็นว่าล้ม**

Run: `npx vitest run src/lib/rate-limit/client-ip.test.ts src/lib/rate-limit/enforce.test.ts`
Expected: FAIL — `Failed to resolve import "./client-ip"` และ `"./enforce"`

- [ ] **Step 4: เขียน client-ip.ts และ enforce.ts**

สร้าง `src/lib/rate-limit/client-ip.ts`:

```ts
/**
 * อ่าน IP ของ client จาก request headers — ที่เดียวของระบบ
 * ลำดับ: IP แรกของ X-Forwarded-For → X-Real-IP → 'unknown'
 *
 * § pure (รับ object ที่มี get) — ใช้ได้ทั้ง NextRequest.headers ใน route handler
 * และ headers() ของ next/headers ใน server action (ผ่าน getClientIp ใน require-staff.ts)
 * เดิม 4 route เขียนสูตรนี้ซ้ำเอง
 *
 * หมายเหตุ: X-Forwarded-For ปลอมได้ถ้าไม่มี reverse proxy ที่เชื่อถือได้คั่น — นโยบายที่
 * สำคัญจึงจำกัดด้วย subject อื่นคู่กัน (เช่น admin-login ต่อ email) ดู policies.ts
 */
export interface HeaderReader {
  get(name: string): string | null;
}

export function clientIpFromHeaders(headers: HeaderReader): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || 'unknown';
}
```

สร้าง `src/lib/rate-limit/enforce.ts`:

```ts
import { checkRateLimit } from '@/lib/upstash';
import { RATE_LIMIT_POLICIES, rateLimitKey, type RateLimitPolicyName } from './policies';

export type RateLimitResult = { allowed: boolean; remaining: number; reset: number };

/**
 * ตรวจ rate limit ตามนโยบายที่ตั้งชื่อไว้ใน RATE_LIMIT_POLICIES
 *
 * § caller ไม่เลือก limit / window / failOpen เองอีกต่อไป — เดิม 8 caller ประกอบค่าเอง
 * และค่า default ของ checkRateLimit คือ fail-open ถ้าลืม { failOpen: false } ที่ auth path
 * ไหน path นั้นไม่มีกัน brute-force ทันทีที่ Redis ล่ม (ไม่มี test ไหนจับได้)
 * checkRateLimit (zadd → zrank) เป็น implementation ข้างใน ไม่ถูกแก้
 */
export async function enforceRateLimit(name: RateLimitPolicyName, subject: string): Promise<RateLimitResult> {
  const policy = RATE_LIMIT_POLICIES[name];
  return checkRateLimit(rateLimitKey(name, subject), policy.limit, policy.windowSeconds, {
    failOpen: !policy.failClosed,
  });
}
```

- [ ] **Step 5: ให้ `getClientIp` ใช้ฟังก์ชันกลาง**

`src/lib/auth/require-staff.ts` ใต้ `import type { UserRole } from '@/lib/auth/roles';` (`:10`) เพิ่ม:
```ts
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
```

แทน `:12-19` ด้วย:
```ts
/**
 * ดึง IP address จาก request headers ของ server action / server component
 * (สูตรจริงอยู่ที่ clientIpFromHeaders — route handler เรียกตัวนั้นกับ req.headers ตรง ๆ)
 */
export async function getClientIp(): Promise<string> {
  return clientIpFromHeaders(await headers());
}
```

- [ ] **Step 6: รัน test**

Run: `npx vitest run src/lib/rate-limit src/lib/upstash.test.ts`
Expected: PASS — client-ip 5, enforce 11 (8 auth + 2 public + 1), policies 23, upstash.test.ts ทุก test เดิม

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 7: Commit**

```bash
git add src/lib/rate-limit/client-ip.ts src/lib/rate-limit/client-ip.test.ts src/lib/rate-limit/enforce.ts src/lib/rate-limit/enforce.test.ts src/lib/auth/require-staff.ts
git commit -m "feat(rate-limit): enforceRateLimit ตามชื่อนโยบาย + clientIpFromHeaders จุดเดียว"
```

---

### Task 3: ย้าย caller ฝั่ง admin (login, reset, change-password)

**Files:**
- Modify: `src/app/admin/actions.ts:11`, `:42-47`
- Modify: `src/app/admin/actions/reset.ts:10`, `:69-72`, `:155-157`
- Modify: `src/app/admin/actions/profile.ts:11`, `:91-93`

**Interfaces:**
- Consumes: `enforceRateLimit(name: RateLimitPolicyName, subject: string): Promise<RateLimitResult>` จาก Task 2; `getClientIp()` (signature เดิม)
- Produces: server actions signature เดิม; key/limit/policy เดิม (พิสูจน์โดย Task 1–2)

- [ ] **Step 1: login**

`src/app/admin/actions.ts:11` เปลี่ยน
```ts
import { checkRateLimit } from '@/lib/upstash';
```
เป็น
```ts
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
```

แทน `:42-47`:
```ts
  const [ipRateLimit, emailRateLimit] = await Promise.all([
    checkRateLimit(`rate:admin-login:ip:${ip}`, 5, 900, { failOpen: false }),
    checkRateLimit(`rate:admin-login:email:${normalizedEmail}`, 5, 900, {
      failOpen: false,
    }),
  ]);
```
ด้วย:
```ts
  const [ipRateLimit, emailRateLimit] = await Promise.all([
    enforceRateLimit('adminLoginIp', ip),
    enforceRateLimit('adminLoginEmail', normalizedEmail),
  ]);
```
(คง `§` comment `:38-40` ไว้ตามเดิม)

- [ ] **Step 2: password reset**

`src/app/admin/actions/reset.ts:10` เปลี่ยน `import { checkRateLimit } from '@/lib/upstash';` เป็น `import { enforceRateLimit } from '@/lib/rate-limit/enforce';`

แทน `:69-72`:
```ts
  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit(`rate:pw-reset:ip:${ip}`, 5, 900, { failOpen: false }),
    checkRateLimit(`rate:pw-reset:email:${email}`, 3, 900, { failOpen: false }),
  ]);
```
ด้วย:
```ts
  const [ipLimit, emailLimit] = await Promise.all([
    enforceRateLimit('pwResetIp', ip),
    enforceRateLimit('pwResetEmail', email),
  ]);
```

แทน `:155-157`:
```ts
  const limit = await checkRateLimit(`rate:pw-reset:complete:${ip}`, 5, 900, {
    failOpen: false,
  });
```
ด้วย:
```ts
  const limit = await enforceRateLimit('pwResetComplete', ip);
```

- [ ] **Step 3: change password**

`src/app/admin/actions/profile.ts:11` เปลี่ยน `import { checkRateLimit } from '@/lib/upstash';` เป็น `import { enforceRateLimit } from '@/lib/rate-limit/enforce';`

แทน `:91-93`:
```ts
  const limit = await checkRateLimit(`rate:change-password:${actor.id}`, 5, 900, {
    failOpen: false,
  });
```
ด้วย:
```ts
  const limit = await enforceRateLimit('changePassword', actor.id);
```
(คง `§` comment `:89-90` ไว้; ข้อความ "ใช้ failOpen:false เหมือน path login" ยังจริงเพราะ policy เป็น auth)

- [ ] **Step 4: ตรวจ**

Run: `npx tsc --noEmit && npx eslint src/app/admin/actions.ts src/app/admin/actions/reset.ts src/app/admin/actions/profile.ts`
Expected: ไม่มี error (ถ้า eslint เตือน unused import แปลว่าลืมลบ `checkRateLimit`)

Run: `npx vitest run src/lib/rate-limit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/actions.ts src/app/admin/actions/reset.ts src/app/admin/actions/profile.ts
git commit -m "refactor(rate-limit): login / password reset / change password ใช้นโยบายตามชื่อ"
```

---

### Task 4: ย้าย caller ฝั่ง API route (liff-session, consent-withdraw, submit, track)

**Files:**
- Modify: `src/app/api/liff/session/route.ts:7`, `:107-113`
- Modify: `src/app/api/consent/withdraw/route.ts:20`, `:34-42`
- Modify: `src/app/api/cases/submit/route.ts:9`, `:15-19`
- Modify: `src/app/api/cases/[id]/route.ts:21`, `:32-35`

**Interfaces:**
- Consumes: `enforceRateLimit`, `clientIpFromHeaders(headers: HeaderReader): string` จาก Task 2
- Produces: handler signature เดิม; ตัวแปร `ip` ยังมีค่าเดิม (ใช้ต่อใน `logAudit`/`createCase` ภายหลังในแต่ละไฟล์)

- [ ] **Step 1: liff session**

`src/app/api/liff/session/route.ts:7` เปลี่ยน
```ts
import { checkRateLimit } from '@/lib/upstash';
```
เป็น
```ts
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
```

แทน `:107-113`:
```ts
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';

  // § failOpen: false — path นี้คือการยืนยันตัวตน Redis ล่มต้องปิด กัน brute ไม่จำกัด
  const rateLimit = await checkRateLimit(`rate:liff-session:${ip}`, 5, 300, { failOpen: false });
```
ด้วย:
```ts
  const ip = clientIpFromHeaders(req.headers);

  // § failOpen: false — path นี้คือการยืนยันตัวตน Redis ล่มต้องปิด กัน brute ไม่จำกัด
  // (บังคับที่ RATE_LIMIT_POLICIES.liffSession — kind 'auth')
  const rateLimit = await enforceRateLimit('liffSession', ip);
```

- [ ] **Step 2: consent withdraw**

`src/app/api/consent/withdraw/route.ts:20` เปลี่ยน
```ts
import { checkRateLimit } from '@/lib/upstash';
```
เป็น
```ts
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
```

แทน `:34-42`:
```ts
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

  // § Rate limit — 5 requests / 10 minutes (ถี่เกินไป = น่าสงสัย)
  // failOpen: false — endpoint นี้ยืนยันตัวตนด้วย trackingCode + CID และทำงานทำลายข้อมูล
  // (ถอนความยินยอม) ถ้า Redis ล่มแล้วปล่อยผ่าน = เดา CID ได้ไม่จำกัด นับเป็น auth path
  const rateLimit = await checkRateLimit(`rate:consent-withdraw:${ip}`, 5, 600, {
    failOpen: false,
  });
```
ด้วย:
```ts
  const ip = clientIpFromHeaders(req.headers);

  // § Rate limit — 5 requests / 10 minutes (ถี่เกินไป = น่าสงสัย)
  // failOpen: false — endpoint นี้ยืนยันตัวตนด้วย trackingCode + CID และทำงานทำลายข้อมูล
  // (ถอนความยินยอม) ถ้า Redis ล่มแล้วปล่อยผ่าน = เดา CID ได้ไม่จำกัด นับเป็น auth path
  // (บังคับที่ RATE_LIMIT_POLICIES.consentWithdraw — kind 'auth')
  const rateLimit = await enforceRateLimit('consentWithdraw', ip);
```

- [ ] **Step 3: submit**

`src/app/api/cases/submit/route.ts:9` เปลี่ยน
```ts
import { checkRateLimit } from '@/lib/upstash';
```
เป็น
```ts
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
```

แทน `:15-19`:
```ts
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

  // § Rate limit — 3 requests / 5 minutes
  const rateLimitKey = `rate:submit:${ip}`;
  const rateLimit = await checkRateLimit(rateLimitKey, 3, 300);
```
ด้วย:
```ts
  const ip = clientIpFromHeaders(req.headers);

  // § Rate limit — 3 requests / 5 minutes (RATE_LIMIT_POLICIES.submit — public, fail-open)
  const rateLimit = await enforceRateLimit('submit', ip);
```

- [ ] **Step 4: track**

`src/app/api/cases/[id]/route.ts:21` เปลี่ยน
```ts
import { checkRateLimit } from '@/lib/upstash';
```
เป็น
```ts
import { enforceRateLimit } from '@/lib/rate-limit/enforce';
import { clientIpFromHeaders } from '@/lib/rate-limit/client-ip';
```

แทน `:32-35`:
```ts
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';

  // § Rate limit — 10 requests / 5 minutes per IP (fail-open เหมือน submit)
  const rateLimit = await checkRateLimit(`rate:track:${ip}`, 10, 300);
```
ด้วย:
```ts
  const ip = clientIpFromHeaders(req.headers);

  // § Rate limit — 10 requests / 5 minutes per IP (fail-open เหมือน submit)
  // (RATE_LIMIT_POLICIES.track)
  const rateLimit = await enforceRateLimit('track', ip);
```

- [ ] **Step 5: ตรวจว่าไม่มี caller ประกอบนโยบายเองเหลือ**

```bash
grep -rn "checkRateLimit\|failOpen\|x-forwarded-for" src --include=*.ts | grep -v "\.test\.ts"
```

Expected: เหลือเฉพาะ
- `src/lib/upstash.ts` (นิยาม `checkRateLimit` + doc comment + `failOpen` ภายใน)
- `src/lib/rate-limit/enforce.ts` (import + เรียก `checkRateLimit`, `failOpen: !policy.failClosed`)
- `src/lib/rate-limit/client-ip.ts` (`x-forwarded-for`)
- `src/app/api/liff/session/route.ts`, `src/app/api/consent/withdraw/route.ts`, `src/app/admin/actions/profile.ts` — เฉพาะบรรทัด `§` comment ที่มีคำว่า `failOpen` (ไม่ใช่โค้ด)

- [ ] **Step 6: รัน test ที่แตะ route เหล่านี้**

Run: `npx tsc --noEmit && npx eslint src/app/api && npx vitest run src/lib/rate-limit src/lib/upstash.test.ts src/lib/upstash.integration.test.ts src/app/api/cases/submit/route.integration.test.ts "src/app/api/cases/[id]/route.integration.test.ts"`
Expected: ไม่มี error; PASS ทั้งหมด (submit integration test ยังโดน rate limit 3/300 ตามเดิม — ใช้ `testIp()` ต่างกันต่อ test อยู่แล้ว)

- [ ] **Step 7: Commit**

```bash
git add src/app/api/liff/session/route.ts src/app/api/consent/withdraw/route.ts src/app/api/cases/submit/route.ts "src/app/api/cases/[id]/route.ts"
git commit -m "refactor(rate-limit): route สาธารณะ/LIFF ใช้นโยบายตามชื่อ + clientIpFromHeaders"
```

---

### Task 5: e2e สร้าง key ผ่าน `rateLimitKey`

**Files:**
- Modify: `e2e/helpers/reset-rate-limits.ts`
- Modify: `e2e/admin-auth.spec.ts:23` (+ import), `e2e/admin-chat.spec.ts:8` (+ import), `e2e/intake-liff.spec.ts:31,41,87,108,118` (+ import), `e2e/intake.spec.ts:16` (+ import), `e2e/track-liff.spec.ts:22` (+ import)

**Interfaces:**
- Consumes: `rateLimitKey(name, subject)` จาก `src/lib/rate-limit/policies.ts` (pure)
- Produces: `export const E2E_CLIENT_IP = '::1'` ใน `e2e/helpers/reset-rate-limits.ts`; `resetRateLimits(...keys: string[])` signature เดิม

- [ ] **Step 1: เพิ่มค่าคงที่ใน helper**

ใน `e2e/helpers/reset-rate-limits.ts` ใต้ `import { Redis } from '@upstash/redis';` เพิ่ม:
```ts

/**
 * IP ที่ next dev เห็นเมื่อ Playwright ยิงจากเครื่องเดียวกัน (IPv6 loopback)
 * ใช้คู่กับ rateLimitKey() จาก src/lib/rate-limit/policies.ts — spec ไม่ต้องรู้รูปแบบ key เอง
 */
export const E2E_CLIENT_IP = '::1';
```

- [ ] **Step 2: แทนสตริง key ในทุก spec**

ในแต่ละไฟล์ต่อไปนี้ แก้บรรทัด import ของ helper และเพิ่ม import ของ `rateLimitKey`:
```ts
import { E2E_CLIENT_IP, resetRateLimits } from './helpers/reset-rate-limits';
import { rateLimitKey } from '../src/lib/rate-limit/policies';
```

แล้วแทนการเรียก:

| ไฟล์:บรรทัด | เดิม | ใหม่ |
|---|---|---|
| `e2e/admin-auth.spec.ts:23` | `resetRateLimits('rate:admin-login:ip:::1', \`rate:admin-login:email:${ADMIN_EMAIL}\`)` | `resetRateLimits(rateLimitKey('adminLoginIp', E2E_CLIENT_IP), rateLimitKey('adminLoginEmail', ADMIN_EMAIL))` |
| `e2e/admin-chat.spec.ts:8` | เหมือนบรรทัดบน | เหมือนบรรทัดบน |
| `e2e/intake-liff.spec.ts:31` | `resetRateLimits('rate:submit:::1', 'rate:liff-session:::1')` | `resetRateLimits(rateLimitKey('submit', E2E_CLIENT_IP), rateLimitKey('liffSession', E2E_CLIENT_IP))` |
| `e2e/intake-liff.spec.ts:41` | `resetRateLimits('rate:liff-session:::1')` | `resetRateLimits(rateLimitKey('liffSession', E2E_CLIENT_IP))` |
| `e2e/intake-liff.spec.ts:87`, `:108`, `:118` | `resetRateLimits('rate:submit:::1')` | `resetRateLimits(rateLimitKey('submit', E2E_CLIENT_IP))` |
| `e2e/intake.spec.ts:16` | `resetRateLimits('rate:submit:::1')` | `resetRateLimits(rateLimitKey('submit', E2E_CLIENT_IP))` |
| `e2e/track-liff.spec.ts:22` | `resetRateLimits('rate:liff-session:::1')` | `resetRateLimits(rateLimitKey('liffSession', E2E_CLIENT_IP))` |

> `ADMIN_EMAIL` ใน spec ถูกส่งตรงเหมือนเดิม — login action ใช้ `emailRaw.trim().toLowerCase()` ถ้าค่าใน spec เป็นตัวพิมพ์เล็กอยู่แล้ว key ตรงกัน (เหมือนก่อน refactor ไม่มีอะไรเปลี่ยน)

- [ ] **Step 3: ตรวจว่าไม่มีสตริง key ค้าง**

```bash
grep -rn "'rate:\|\`rate:" e2e
```

Expected: ไม่มีผลลัพธ์

- [ ] **Step 4: typecheck + รัน e2e ที่เกี่ยว**

```bash
npx tsc --noEmit
```
Expected: ไม่มี error (ถ้า tsconfig ไม่ครอบ `e2e/` ให้รัน `npx tsc --noEmit -p .` แล้วดูว่า Playwright compile spec ได้ในขั้นถัดไป)

เปิด dev server แยก terminal ก่อน (webServer ใน `playwright.config.ts` ใช้ `pnpm dev` ซึ่งค้าง — `reuseExistingServer: true` จะใช้ตัวที่เปิดไว้):
```bash
LIFF_E2E_MOCK=1 npx next dev
```
แล้ว:
```bash
LIFF_E2E_MOCK=1 npx playwright test e2e/intake.spec.ts e2e/admin-auth.spec.ts e2e/intake-liff.spec.ts e2e/track-liff.spec.ts
```
Expected: PASS ทั้งหมด (ถ้า Windows shell ไม่รองรับ `VAR=x cmd` ให้ใช้ PowerShell: `$env:LIFF_E2E_MOCK='1'; npx next dev`)

- [ ] **Step 5: Commit**

```bash
git add e2e/helpers/reset-rate-limits.ts e2e/admin-auth.spec.ts e2e/admin-chat.spec.ts e2e/intake-liff.spec.ts e2e/intake.spec.ts e2e/track-liff.spec.ts
git commit -m "test(e2e): สร้าง rate-limit key ผ่าน rateLimitKey แทนสตริงตรง"
```

---

### Task 6: Gate รวม

**Files:** ไม่มี

**Interfaces:**
- Consumes: ผลของ Task 1–5
- Produces: branch พร้อม PR

- [ ] **Step 1: gate**

```bash
npx tsc --noEmit
npx eslint .
npx vitest run
```

Expected: ไม่มี error; vitest PASS ทั้งหมด รวม `upstash.test.ts`, `upstash.integration.test.ts` (ไม่ได้แก้) และ test ใหม่ 3 ไฟล์ (39 tests)

- [ ] **Step 2: ตรวจ diff**

```bash
git diff --stat main...HEAD
git diff main...HEAD -- src/lib/upstash.ts
```

Expected: บรรทัดแรกมีเฉพาะไฟล์ใน File Structure; บรรทัดที่สองว่างเปล่า (upstash.ts ไม่ถูกแตะ)

- [ ] **Step 3: (เมื่อผู้ใช้อนุญาต) push + PR**

```bash
git push -u origin refactor/rate-limit-policies
gh pr create --title "refactor: นโยบาย rate limit อยู่ใน module (fail-closed ทดสอบได้ที่เดียว)" --body "ตามการ์ด c7 ของ architecture review 2026-10-03 — key format/limit/window เดิมทุกตัว พิสูจน์ด้วย policies.test.ts"
```

---

## Self-Review

1. **Spec coverage (การ์ด c7):** ตารางนโยบาย (จำนวน · window · ปิด/เปิด) → Task 1 ✓; รูปแบบ key → `rateLimitKey` Task 1 ✓; อ่าน IP ที่เดียว + ลบการอ่าน IP ซ้ำ 4 ที่ → Task 2/4 ✓; `checkRateLimit` เป็น implementation ข้างใน ไม่แตะ → Global Constraint + Task 6 Step 2 ✓; unit test ยืนยันทุก auth path fail-closed → `policies.test.ts` (ตาราง) + `enforce.test.ts` (พฤติกรรมตอน Redis ล่ม) ✓; e2e ไม่ต้องรู้รูปแบบ key → Task 5 ✓; upstash tests เขียว → Task 0/4/6 ✓; caller ทั้ง 8 → Task 3 (3 ไฟล์ admin) + Task 4 (4 route) + require-staff ใน Task 2 ✓
2. **Placeholder scan:** ไม่มี TBD/TODO; ทุกขั้นที่แก้โค้ดมี before/after เต็ม
3. **Type consistency:** `RateLimitPolicyName` ชื่อ key ตรงกันทุก task (`adminLoginIp`, `adminLoginEmail`, `pwResetIp`, `pwResetEmail`, `pwResetComplete`, `changePassword`, `liffSession`, `consentWithdraw`, `submit`, `track`); `enforceRateLimit(name, subject)` และ `clientIpFromHeaders(headers)` ใช้ชื่อเดียวกันทั้ง lib/test/caller ✓

**พฤติกรรมที่เปลี่ยน:** ไม่มี — key, limit, window, fail policy, ข้อความ 429 เท่าเดิมทุกตัว (`pwResetEmail` ยังเป็น 3 ครั้ง)
