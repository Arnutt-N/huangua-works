# PRP Plan — แก้ findings จากการรีวิว PR #117

## Metadata

| Field | Value |
|---|---|
| Source spec (binding) | `.agents/PRPs/findings/pr117-findings.md` |
| PRD | `.agents/PRPs/prds/pr117-review-fix.prd.md` |
| Branch | `fix/pr117-review-findings` (สร้างแล้ว, ฐาน = main @ b0301ff) |
| Stack | TypeScript · Next.js 16 App Router (`proxy.ts`) · Auth.js v5 beta.32 (`@auth/core` 0.41.3) · Drizzle ORM 0.45 + postgres-js · @upstash/redis 1.38.0 (REST) · vitest · Node 24 |
| Package runner | `npx` เท่านั้น (`pnpm` ค้างในเครื่องนี้) |
| Integration infra | Docker: Postgres :5433 + up-redis :8080 (ขึ้นแล้ว) |
| Baseline | `npx vitest run` = 1090/1094 ผ่าน; แดง 4 = timeout 5000ms ใน `src/lib/line/settings*.integration`, `src/app/api/admin/system-settings/route.integration.test.ts`, `src/app/api/cases/submit/route.integration.test.ts` ขณะเครื่องโหลดหนัก |
| Finding coverage | F1→T6 · F2→T5 · F3→T2,T3,T4 · F4→T7 · F5→T8 · F6→T9 · F8→T10 · F9→T11 · F10→T12 · F11→T13 · F12→T14 · F13→T15 · F14→T8 · F15→T1,T3,T4,T6 · F16→T9 · F18→T8 · F20→T4 · F17/F19 = deferred (เหตุผลใน findings) |

## Conventions ที่ทุก task ต้องตาม (จาก AGENTS.md)

- comment และข้อความผู้ใช้เป็นภาษาไทย; comment ที่อธิบายการตัดสินใจไม่ชัดเจนขึ้นต้นด้วย `§`
- `getDb()` เรียกในฟังก์ชันเท่านั้น (`await getDb()`), ไม่เรียกระดับ module
- `firstOrUndefined(promiseOfRows)` จาก `@/lib/db/query-helpers` แทน `.limit(1)[0]`
- audit ผ่าน `logAudit({ action: AUDIT_ACTIONS.X, resource, userId?, ipAddress?, userAgent?, metadata? })` จาก `@/lib/audit`
- test: vitest, ไฟล์ `*.test.ts` ข้างโค้ด; integration = `*.integration.test.ts` (ต้องมี Docker); mock ด้วย `vi.hoisted` + `vi.mock` แล้ว `await import()` โมดูลที่ทดสอบ (ดู `src/app/api/line/webhook/route.test.ts:1-40`)
- ห้าม refactor นอกที่ระบุ

## Files to Change

| File | Action | Task |
|---|---|---|
| `src/lib/auth/roles.ts` | modify — เพิ่ม `LoginDenialReason`, `loginDenialReason()`; `isLoginEligible` derive จากมัน | T1 |
| `src/lib/auth/roles.test.ts` | modify — test `loginDenialReason` | T1 |
| `src/lib/auth/login-errors.ts` | **create** — `IneligibleAccountSignin` | T2 |
| `src/lib/auth/authorize-credentials.ts` | **create** — ย้ายตัว authorize + DUMMY_HASH มาจาก auth.ts | T3 |
| `src/lib/auth/authorize-credentials.test.ts` | **create** | T3 |
| `src/auth.ts` | modify — `authorize: authorizeCredentials`, ลบ DUMMY_HASH/import ที่ไม่ใช้, แก้ header comment | T3, T7 |
| `src/app/admin/actions.ts` | modify — จัดการ `IneligibleAccountSignin`, helper `denyLogin`, post-check ใช้ `loginDenialReason` | T4, T7 |
| `src/app/admin/actions.test.ts` | **create** | T4 |
| `src/app/api/auth/[...nextauth]/route.ts` | modify — บล็อก POST credentials callback | T5 |
| `src/app/api/auth/[...nextauth]/route.test.ts` | **create** | T5 |
| `src/lib/auth/tiers.ts` | modify — `loadTierMap` แยก 42P01; header comment | T6 |
| `src/lib/auth/tiers-load.test.ts` | **create** | T6 |
| `src/lib/auth/require-staff.ts` | modify — catch → `SUPERADMIN_ONLY`; `resolveStaff` ใช้ `loginDenialReason` | T6 |
| `src/lib/auth/require-staff.test.ts` | **create** | T6 |
| `AGENTS.md`, `src/proxy.ts` | modify — เอกสาร | T7 |
| `src/lib/line/sse/broadcaster.ts` | modify — watchdog + teardown + setMaxListeners | T8 |
| `src/lib/line/sse/broadcaster.redis.test.ts` | **create** | T8 |
| `src/app/admin/chat/_hooks/use-chat-sse.ts` | read-only check — event type ที่ไม่รู้จัก (`ping`) ต้องไม่ throw | T8 |
| `src/lib/line/sse/broadcaster.test.ts` | modify — mock `@/lib/upstash` (hermetic) | T8 |
| `src/lib/cid-hmac.test.ts` | modify — ลบ tautology + golden vector + fresh-key test + แก้ comment | T9, T10 |
| `src/lib/dedup.ts` | modify — § เงื่อนไขลบ legacy | T9 |
| `src/lib/dedup.integration.test.ts` | **create** | T9 |
| `src/lib/cid-hmac.ts`, `vitest.config.ts` | modify — comment | T10 |
| `src/app/api/cron/close-stale/route.ts` | modify | T11 |
| `src/app/api/cron/close-stale/route.test.ts` | **create** | T11 |
| `src/lib/cases/intake.ts`, `src/lib/cases/intake.test.ts` | modify | T12 |
| `src/lib/auth/token-expiry.test.ts` | **create** | T13 |
| `src/app/api/line/webhook/route.ts`, `route.test.ts` | modify | T14 |
| `src/lib/line/signature.ts`, `signature.test.ts` | modify | T15 |

## NOT Building

- ไม่แก้ F17 (normalize zero-width/NFC) และ F19 (`maxDuration`) — deferred ตาม findings
- ไม่เปลี่ยน `createVersionedCache` (ใช้ร่วมกับ LINE bot config) — ไม่ทำ last-known-good
- ไม่เพิ่ม rate limit ใน `authorize()` — T5 ปิด HTTP path แล้ว server action คือทางเข้าเดียว
- ไม่เปลี่ยน UX/หน้าตา login, ไม่เปลี่ยน schema/migration
- ไม่แก้ integration test flaky 3 ไฟล์ใน baseline (นอกขอบเขต — แค่ยืนยันว่ารันเดี่ยวผ่าน)
- ไม่ลบ legacy dedup path (ยังอยู่ในช่วงเปลี่ยนผ่าน) — ใส่แค่เงื่อนไขลบ
- ไม่แตะ import กลางไฟล์ใน `require-staff.ts:33` (pre-existing, ไม่อยู่ใน findings)

## Step-by-Step Tasks

ลำดับ: T1 → T2 → T3 → T4 → T5 → T6 → T7 (auth chain, ไฟล์ทับกัน = sequential) แล้ว T8…T15 (ไฟล์แยกกัน อิสระต่อกัน; T9 ก่อน T10 เพราะแก้ `cid-hmac.test.ts` ไฟล์เดียวกัน) ทุก task ทำแบบ TDD: เขียน/แก้ test → รันให้เห็นแดง (หรือ compile error สำหรับ export ใหม่) → implement → เขียว

### T1 — `loginDenialReason` เป็น single source ของกฎ eligibility (F15)

- **Root cause:** PR เพิ่ม `isLoginEligible` (boolean) แต่ `resolveStaff` และ login action ต้องการ "เหตุผล" จึงเขียนเงื่อนไขซ้ำเอง
- **ACTION:** modify `src/lib/auth/roles.ts`, `src/lib/auth/roles.test.ts`
- **IMPLEMENT** (ต่อท้าย roles.ts แทนฟังก์ชัน `isLoginEligible` เดิม):
  ```ts
  /** เหตุผลที่บัญชีที่ยืนยันรหัสผ่านแล้วยังเข้า /admin ไม่ได้ — ตรงกับ reason ใน audit */
  export type LoginDenialReason = 'citizen_role' | 'inactive';

  /**
   * § กฎเดียวของ "ใครได้ session staff" — authorize(), login action และ resolveStaff ใช้ร่วมกัน
   * citizen มาก่อน inactive (citizen ไม่เคยมีสิทธิ์ staff ไม่ว่าสถานะใด)
   */
  export function loginDenialReason(role: UserRole, isActive: boolean): LoginDenialReason | null {
    if (role === 'citizen') return 'citizen_role';
    if (!isActive) return 'inactive';
    return null;
  }

  /** (คง JSDoc § เดิมของ isLoginEligible ไว้) */
  export function isLoginEligible(role: UserRole, isActive: boolean): boolean {
    return loginDenialReason(role, isActive) === null;
  }
  ```
  roles.ts ต้องคง pure (ไม่ import อะไร)
- **MIRROR:** describe `auth · isLoginEligible` ใน `roles.test.ts:83-96` (`it.each([...STAFF_ROLES])`)
- **Tests:** `loginDenialReason('officer', true) === null`; `('citizen', true) === 'citizen_role'`; `('citizen', false) === 'citizen_role'`; `it.each(STAFF_ROLES)('%s inactive', r => 'inactive')`; test เดิมของ `isLoginEligible` ต้องผ่านต่อ + เพิ่ม `(citizen,false) → false`
- **Regression risk:** ต่ำ — `isLoginEligible` คืนค่าเท่าเดิมทุก input (citizen∨inactive → false)
- **VALIDATE:** `npx vitest run src/lib/auth/roles.test.ts` เขียว · `npx tsc --noEmit`

### T2 — `IneligibleAccountSignin` (F3)

- **Root cause (F3):** authorize คืน `null` ได้อย่างเดียว → Auth.js throw `CredentialsSignin` ธรรมดา → action แยกบัญชีระงับออกจากรหัสผิดไม่ได้
- **Fix strategy:** ใช้กลไกที่ Auth.js รองรับ: throw subclass ของ `CredentialsSignin` จาก authorize — `@auth/core/lib/actions/callback/index.js:386-387` rethrow `AuthError` instance เดิม และ `next-auth/lib/actions.js:44` (`Auth(req,{...,raw})`) ส่งต่อถึง `signIn()` ใน server action → `instanceof` ใช้ได้
- **ACTION:** create `src/lib/auth/login-errors.ts`
- **IMPLEMENT:**
  ```ts
  import { CredentialsSignin } from 'next-auth';
  import type { LoginDenialReason } from './roles';

  /**
   * § authorize() throw ตัวนี้เมื่อรหัสผ่านถูกแต่บัญชีไม่มีสิทธิ์ staff (citizen / ระงับ)
   * ไม่ออก JWT ให้ แต่ส่ง "เหตุผล" ถึง login action ให้แสดงข้อความเจาะจง + audit ACCESS_DENIED
   * ไม่ใช่ enumeration oracle: ถึงจุดนี้รหัสผ่านถูกพิสูจน์แล้ว
   * code ไปโผล่ใน URL ได้เฉพาะ HTTP callback ซึ่งถูกบล็อกใน route (T5)
   */
  export class IneligibleAccountSignin extends CredentialsSignin {
    readonly reason: LoginDenialReason;
    readonly userId: string;

    constructor(reason: LoginDenialReason, userId: string) {
      super();
      this.reason = reason;
      this.userId = userId;
      this.code = reason;
    }
  }
  ```
- **MIRROR:** n/a (ไฟล์ใหม่เล็ก) — ชื่อ class/field camelCase/PascalCase ตาม repo
- **Tests:** ครอบโดย T3/T4 (`instanceof CredentialsSignin` ต้องจริง — assert ใน T3)
- **Regression risk:** ถ้า `next-auth` import ไม่ได้ใน vitest → **fallback ที่กำหนดแล้ว:** ใน test ไฟล์ที่ import โมดูลนี้ให้ `vi.mock('next-auth', () => ({ CredentialsSignin: class CredentialsSignin extends Error { code = 'credentials'; } }))` (instanceof ข้ามโมดูลใช้ได้เพราะทุกโมดูลได้ class mock ตัวเดียวกัน) — ห้ามเปลี่ยน production code เพื่อเลี่ยง
- **VALIDATE:** `npx tsc --noEmit`

### T3 — แยกตัว authorize ออกมาทดสอบได้ + throw `IneligibleAccountSignin` (F3, F15; ทดสอบ HIGH fix ของ #117)

- **Root cause:** ตัว authorize ฝังอยู่ใน `NextAuth({...})` ระดับ module ของ `src/auth.ts` → ไม่มี test ใดเรียกถึงบรรทัด `isLoginEligible` (ลบทิ้งได้โดยไม่มีอะไรแดง — TEST/SPEC)
- **ACTION:** create `src/lib/auth/authorize-credentials.ts` + `.test.ts`; modify `src/auth.ts`
- **IMPLEMENT:**
  1. ย้ายเนื้อ `async authorize(credentials) {...}` (auth.ts:74-112) และ `const DUMMY_HASH` (auth.ts:57-59 พร้อม § comment) มาเป็น
     ```ts
     export type AuthorizedUser = Pick<typeof users.$inferSelect, 'id' | 'email' | 'role' | 'passwordVersion'> & { remember: boolean };
     export async function authorizeCredentials(
       credentials: Partial<Record<string, unknown>> | undefined,
     ): Promise<AuthorizedUser | null>
     ```
     imports: `eq` (drizzle-orm), `bcrypt` (bcryptjs), `getDb`, `firstOrUndefined`, `users`, `loginDenialReason` (./roles), `IneligibleAccountSignin` (./login-errors)
  2. แทนบรรทัด `if (!isLoginEligible(user.role, user.isActive)) return null;` ด้วย
     ```ts
     // § ตัดสิน eligibility หลัง bcrypt ผ่านเท่านั้น (timing เท่าทุกกรณี) — citizen/บัญชีระงับ
     // ไม่ได้ JWT แต่ throw เหตุผลให้ login action แสดงข้อความเจาะจง (ไม่ใช่ oracle: รหัสถูกแล้ว)
     const denial = loginDenialReason(user.role, user.isActive);
     if (denial) throw new IneligibleAccountSignin(denial, user.id);
     ```
  3. แก้ § comment เดิม "ไม่ throw ใน authorize — คืน null เสมอเมื่อ fail" เป็น: คืน `null` เมื่อรหัสผิด/ไม่มี user (เหมือนกันทุกกรณี กัน oracle); throw เฉพาะ `IneligibleAccountSignin` หลังรหัสถูก — error อื่นห้าม throw ออกไป
  4. แก้ comment "เพิ่มเติมด้วย per-email rate-limit ใน actions.ts" → "rate limit ต่อ IP/email อยู่ที่ login action ซึ่งเป็นทางเข้าเดียว (HTTP credentials callback ถูกบล็อกใน `src/app/api/auth/[...nextauth]/route.ts`)"
  5. `src/auth.ts`: `Credentials({ id, name, credentials: {...เดิม}, authorize: authorizeCredentials })`; ลบ import ที่ไม่ใช้แล้ว (`bcrypt`, `eq`, `firstOrUndefined`, `users`, `getDb`, `isLoginEligible`) — **ตรวจก่อนลบ** ว่า callbacks ใน auth.ts ไม่ใช้ (ถ้าใช้ คงไว้)
- **MIRROR:** mock DB แบบ chain ตาม `src/lib/cases/intake.test.ts:15-130` (ย่อ: `getDb → { select: () => ({ from: () => ({ where: () => ({ limit: async () => rows }) }) }) }`)
- **Tests** (`authorize-credentials.test.ts`, bcrypt จริง `bcrypt.hashSync('correct-pw', 4)`):
  - staff active รหัสถูก → คืน `{ id, email, role, passwordVersion, remember:false }`; `remember:'on'` → `remember:true`
  - รหัสผิด → `null`; ไม่มี user → `null`; email/password ว่าง → `null`
  - officer `isActive:false` รหัสถูก → reject เป็น `IneligibleAccountSignin` ที่ `reason==='inactive'`, `code==='inactive'`, `userId` ตรง และ `instanceof CredentialsSignin`
  - citizen รหัสถูก → `reason==='citizen_role'`
  - citizen/inactive **รหัสผิด** → `null` (ไม่เปิดเผยเหตุผลเมื่อยังไม่พิสูจน์รหัส)
- **Regression risk:** กลาง — Auth.js type ของ `authorize`; ถ้า `authorize: authorizeCredentials` type ไม่ตรง ให้ห่อ `authorize: (credentials) => authorizeCredentials(credentials)`; e2e `e2e/admin-auth.spec.ts` login admin ต้องผ่านเหมือนเดิม (พฤติกรรม success path ไม่เปลี่ยน)
- **VALIDATE:** `npx vitest run src/lib/auth/authorize-credentials.test.ts` · `npx tsc --noEmit` · `npx eslint src/auth.ts src/lib/auth`

### T4 — login action แสดงเหตุผลจริง + audit แยก + ปิด X-Auth-Return-Redirect (F3, F15, F20)

- **Root cause / impact:** ดู F3 — บัญชีระงับเห็น "รหัสผ่านไม่ถูกต้อง", audit เป็น `LOGIN_FAILURE/invalid_credentials` ปน brute-force metric
- **ACTION:** modify `src/app/admin/actions.ts`; create `src/app/admin/actions.test.ts`
- **IMPLEMENT:**
  ```ts
  import { IneligibleAccountSignin } from '@/lib/auth/login-errors';
  import { loginDenialReason, type LoginDenialReason } from '@/lib/auth/roles';

  type IneligibleReason = LoginDenialReason | 'no_staff_record';
  const INELIGIBLE_MESSAGES: Record<IneligibleReason, string> = {
    inactive: 'บัญชีนี้ถูกระงับการใช้งาน',
    citizen_role: 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานส่วนเจ้าหน้าที่',
    no_staff_record: 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานส่วนเจ้าหน้าที่',
  };

  // § ใช้ access_denied (ไม่ใช่ login_failure) — ตัวตนยืนยันผ่านแล้ว แยก SIEM brute-force rate ออกจาก suspended-login
  async function denyLogin(reason: IneligibleReason, userId: string | undefined, email: string, ip: string): Promise<LoginState> {
    await logAudit({ action: AUDIT_ACTIONS.ACCESS_DENIED, resource: 'auth', userId, ipAddress: ip, metadata: { email, reason } });
    return { error: INELIGIBLE_MESSAGES[reason] };
  }
  ```
  - ใน `catch (err)` **ก่อน** `if (!(err instanceof CredentialsSignin)) throw err;` เพิ่ม `if (err instanceof IneligibleAccountSignin) return denyLogin(err.reason, err.userId, normalizedEmail, ip);` (ไม่ต้อง signOut — ไม่มี session ถูกออก)
  - post-check หลัง signIn (actions.ts:90-115) แทนด้วย
    ```ts
    // § กัน race: บัญชีถูกระงับ/ลบระหว่าง authorize กับตรงนี้ — signIn ตั้ง cookie ไปแล้วต้อง signOut
    const denial: IneligibleReason | null = !staffUser ? 'no_staff_record' : loginDenialReason(staffUser.role, staffUser.isActive);
    if (!staffUser || denial) {
      await signOut({ redirect: false });
      return denyLogin(denial ?? 'no_staff_record', staffUser?.id, normalizedEmail, ip);
    }
    ```
  - **F20** (root cause: `@auth/core/index.js:108,124-125` ไม่ throw เมื่อ request มี `X-Auth-Return-Redirect`; `next-auth/lib/actions.js:7,48-54` copy header ขาเข้าแล้วคืน url ปกติ → `signInOk=true` กับรหัสผิด): หลังตรวจ rate limit และก่อน `signIn` เพิ่ม
    ```ts
    // § Auth.js ไม่ throw CredentialsSignin เมื่อ request มี X-Auth-Return-Redirect (signIn copy header ขาเข้า)
    // รหัสผิดจะกลายเป็น "สำเร็จ" + oracle อีเมล — server action ไม่มีผู้ใช้ header นี้โดยชอบ จึงปฏิเสธทันที
    if ((await headers()).has('x-auth-return-redirect')) return { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
    ```
    import `{ headers } from 'next/headers'`
  - หมายเหตุพฤติกรรม: citizen ที่ inactive ด้วย → ข้อความ "ไม่มีสิทธิ์" (เดิมได้ "ระงับ") ให้สอดคล้องกับ audit reason `citizen_role` ที่เดิมก็บันทึกแบบนี้
- **MIRROR:** mock pattern ของ `src/app/api/line/webhook/route.test.ts:1-40`
- **Tests** (`actions.test.ts`): mock `@/auth` (`auth`, `signIn`, `signOut` = `vi.fn`), `@/lib/audit` (importOriginal + `logAudit` mock), `@/lib/db` (chain คืน `mockState.users`), `@/lib/rate-limit/enforce` (`{allowed:true,remaining:9,reset:60}`), `@/lib/auth/require-staff` (`getClientIp: async () => '203.0.113.9'`), `next/navigation` (`redirect: vi.fn()`); สร้าง `FormData` email/password
  - signIn throw `new IneligibleAccountSignin('inactive','u1')` → `{ error: 'บัญชีนี้ถูกระงับการใช้งาน' }`, logAudit 1 ครั้ง `action: 'access_denied'`-ค่าจาก `AUDIT_ACTIONS.ACCESS_DENIED`, `userId:'u1'`, `metadata.reason:'inactive'`; **ไม่มี** `LOGIN_FAILURE`; signOut ไม่ถูกเรียก
  - `'citizen_role'` → 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานส่วนเจ้าหน้าที่'
  - signIn throw `new CredentialsSignin()` → 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' + `LOGIN_FAILURE {reason:'invalid_credentials'}`
  - signIn throw `new Error('config')` → reject (re-throw)
  - signIn สำเร็จ + DB user officer active → `{ error:null, success:true }` + `LOGIN_SUCCESS`
  - request มี header `x-auth-return-redirect` (`mockHeaders` คืน `new Headers({ 'x-auth-return-redirect': '1' })`) → `{ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }` และ `signIn` ไม่ถูกเรียก (test อื่นใช้ `new Headers()` ว่าง — mock `next/headers` → `{ headers: mockHeaders }`)
  - signIn สำเร็จ + DB user inactive (race) → signOut 1 ครั้ง + ข้อความระงับ + `ACCESS_DENIED`
- **Regression risk:** กลาง — ลำดับ `instanceof` ผิดจะทำให้ Ineligible ตกไป branch รหัสผิด (test ข้อ 1 จับ); `.claude/skills/verify/features/admin-auth.md:54` คาดข้อความ 4 แบบ — หลังแก้กลับมาเป็นจริง ไม่ต้องแก้ไฟล์นั้น
- **VALIDATE:** `npx vitest run src/app/admin/actions.test.ts` · `npx tsc --noEmit` · `npx eslint src/app/admin/actions.ts`

### T5 — บล็อก HTTP `POST /api/auth/callback/credentials` (F2)

- **Root cause:** rate limit/audit อยู่ที่ server action แต่ Auth.js เปิด HTTP callback ให้เรียก authorize ตรง (`[...nextauth]/route.ts:9` export handlers ตรง)
- **Fix strategy:** แอปไม่มีผู้ใช้ HTTP path นี้ (`signIn()` ใน server action เรียก `Auth()` ใน process — `next-auth/lib/actions.js:43-44`) → บล็อกด้วยกฎ parse เดียวกับ `@auth/core/lib/utils/web.js:91-108` (`^/api/auth(.+)` → `split('/').filter(Boolean)`; basePath = `/api/auth` เพราะ AUTH_URL เป็น root — `next-auth/lib/env.js:26-36`; Auth.js ใช้ `new URL(req.url).pathname` ไม่ decode `%xx`)
- **ACTION:** modify `src/app/api/auth/[...nextauth]/route.ts`; create `route.test.ts` ในโฟลเดอร์เดียวกัน
- **IMPLEMENT:**
  ```ts
  import { NextResponse, type NextRequest } from 'next/server';
  import { handlers } from '@/auth';

  export const { GET } = handlers;

  /**
   * § mirror parseActionAndProviderId ของ @auth/core — ตัด basePath แล้ว split('/') ทิ้งช่องว่าง
   * ('/api/auth//callback/credentials/' ก็นับ) ต้องตรงกฎเดียวกันไม่งั้นเลี่ยงด้วย slash ได้
   */
  function isCredentialsCallback(pathname: string): boolean {
    const segments = pathname.replace(/^\/api\/auth/, '').split('/').filter(Boolean);
    return segments.length === 2 && segments[0] === 'callback' && segments[1] === 'credentials';
  }

  /**
   * § login staff เข้าได้ทางเดียวคือ server action (src/app/admin/actions.ts) ซึ่งมี rate limit
   * ต่อ IP+email และ audit — signIn() ใน action เรียก Auth.js ใน process ไม่ผ่าน HTTP นี้
   * ปล่อย HTTP callback ไว้ = brute-force รหัสผ่านไม่จำกัด (ขอ CSRF จาก /api/auth/csrf ก็ยิงได้)
   */
  export async function POST(req: NextRequest): Promise<Response> {
    if (isCredentialsCallback(new URL(req.url).pathname)) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }
    return handlers.POST(req);
  }
  ```
  คง JSDoc เดิมของไฟล์ไว้ด้านบน
- **MIRROR:** `src/app/api/line/webhook/route.test.ts` (mock + `await import('./route')`)
- **Tests:** mock `@/auth` → `{ handlers: { GET: mockGet, POST: mockPost } }` (`mockPost` คืน `new Response('ok')`)
  - `it.each(['/api/auth/callback/credentials', '/api/auth/callback/credentials/', '/api/auth//callback//credentials'])` → 404, `mockPost` ไม่ถูกเรียก
  - `/api/auth/signout`, `/api/auth/callback/other` → ส่งต่อ `mockPost` 1 ครั้ง
  - `GET` ที่ export คือ `mockGet` ตัวเดียวกัน
- **Regression risk:** ต่ำ — logout (`signOut()` ใน server action) ไม่ผ่าน HTTP; หน้า login ใช้ server action; ไม่มี `callback/credentials` ใน `e2e/`, `src/`, `scripts/` (grep แล้ว)
- **VALIDATE:** `npx vitest run "src/app/api/auth"` · `npx tsc --noEmit`

### T6 — tier matrix fail-closed จริง (F1, F15)

- **Root cause:** ดู F1 — `return allowedRoles` คืน compiled default (`tierKeyForRoles` เทียบค่ากับ `TIER_DEFAULTS`); `loadTierMap` กลืน error ทุกชนิดแล้วคืน default ที่ถูก cache ≤60 วิ
- **Fix strategy:**
  - `loadTierMap`: ตาราง `tier_roles` ไม่มี (`42P01`) → default (ถูกต้องตามนิยาม: ไม่มีตาราง = ไม่มี override) ; error อื่น → rethrow (cache ไม่เก็บ เพราะ `createVersionedCache.reload` ตั้ง entry เฉพาะเมื่อ load สำเร็จ — `src/lib/line/versioned-cache.ts:41-53`)
  - `resolveAllowedRoles` catch → `SUPERADMIN_ONLY` (superadmin อยู่ทุก tier ตาม #111 → ไม่ล็อกทั้งระบบ; `/admin/page.tsx:33` เรียก `requireStaff()` ไม่มี whitelist → ไม่วน redirect)
- **Security implication:** ระหว่าง DB สะดุดเฉพาะ query `tier_roles` staff ที่ไม่ใช่ superadmin ถูกปฏิเสธหน้าที่ใช้ tier (403/redirect `/admin`) แทนการได้สิทธิ์เกิน — ตรงเจตนาที่ PR #117 ประกาศ
- **ACTION:** modify `src/lib/auth/tiers.ts`, `src/lib/auth/require-staff.ts`; create `src/lib/auth/tiers-load.test.ts`, `src/lib/auth/require-staff.test.ts`
- **IMPLEMENT:**
  - tiers.ts:
    ```ts
    const UNDEFINED_TABLE = '42P01';
    /** drizzle 0.45 ห่อ error ของ postgres-js ไว้ใน .cause (DrizzleQueryError) — เช็คทั้งสองชั้น */
    function isUndefinedTableError(err: unknown): boolean {
      const codeOf = (e: unknown): unknown =>
        e && typeof e === 'object' && 'code' in e ? (e as { code?: unknown }).code : undefined;
      return codeOf(err) === UNDEFINED_TABLE || codeOf((err as { cause?: unknown } | null)?.cause) === UNDEFINED_TABLE;
    }
    ```
    ใน `loadTierMap` เปลี่ยน `catch {` เป็น `catch (err) { if (!isUndefinedTableError(err)) throw err; return <defaults เดิม>; }` พร้อม § comment: "ตารางยังไม่มี (migrate ไม่ทัน) = ไม่มี override ได้ → default คือค่าจริง ไม่ใช่ fail-open; error อื่น = อ่าน override ไม่ได้ → throw (ไม่ cache) ให้ require-staff fail-closed"
    แก้ header (tiers.ts:1-8) "ตก DB = fallback ค่าคงที่เสมอ ไม่มีทางล็อกทั้งระบบ" → "ตาราง tier_roles ยังไม่มี = ค่าคงที่ (ไม่มี override ให้ข้าม); อ่านไม่ได้ด้วยเหตุอื่น = throw → require-staff fail-closed เหลือ superadmin (อยู่ทุก tier ตาม #111 จึงไม่ล็อกทั้งระบบ)"
  - require-staff.ts: `import { loginDenialReason, SUPERADMIN_ONLY, type UserRole } from '@/lib/auth/roles';` catch:
    ```ts
    // § fail-closed จริง: อ่าน matrix ไม่ได้ = ไม่รู้ว่าแอดมินตั้ง override แคบแค่ไหน — whitelist ของ
    // caller คือ compiled default ของ tier (tierKeyForRoles เทียบค่า) ซึ่งกว้างกว่า override ได้
    // เหลือ superadmin ที่อยู่ทุก tier เสมอ (#111) ระบบจึงไม่ล็อกทั้งหมด
    console.error(`[auth] tier matrix unreadable (${key}), fail-closed to superadmin only`, err);
    return SUPERADMIN_ONLY;
    ```
    `resolveStaff` (บรรทัด 87-102) แทนเงื่อนไขซ้ำด้วย
    ```ts
    const denial: StaffDenialReason | null = !staffUser ? 'no_staff_record' : loginDenialReason(staffUser.role, staffUser.isActive);
    if (!staffUser || denial) {
      const reason = denial ?? 'no_staff_record';
      await logAudit({ action: AUDIT_ACTIONS.ACCESS_DENIED, resource: 'auth', userId: staffUser?.id, ipAddress, userAgent, metadata: { reason } });
      return { ok: false, reason };
    }
    ```
- **MIRROR:** test mock ตาม webhook route.test.ts; DB chain ตาม T3
- **Tests:**
  - `tiers-load.test.ts`: mock `@/lib/db` (`getDb → { select: () => ({ from: mockFrom }) }`), `@/lib/line/config-version` (`readConfigVersion: async () => null`, `bumpConfigVersion: async () => {}`); `beforeEach(refreshTierCache)`
    - `mockFrom` reject `Object.assign(new Error('relation does not exist'), { code: '42P01' })` → `getTierRoles('admin')` = `[...ADMIN_ROLES]`
    - reject `Object.assign(new Error('wrapped'), { cause: { code: '42P01' } })` → default
    - reject `{ code: '57P01' }` error → `getTierRoles` reject
    - ครั้งแรก reject (57P01) ครั้งถัดไป resolve `[{ tier:'admin', roles:['superadmin'] }]` → ครั้งที่สองได้ `['superadmin']` (ไม่ cache ความล้มเหลว)
  - `require-staff.test.ts`: mock `@/auth` (`auth` คืน `{ user: { userId:'u1', passwordVersion:1 } }`, `signOut`), `next/headers` (`headers: async () => new Headers({ 'user-agent':'vitest' })`), `next/navigation` (`redirect: vi.fn()`), `@/lib/db` (chain คืน `[mockState.user]`), `@/lib/audit` (importOriginal + logAudit mock), `@/lib/auth/tiers` (importOriginal + `getTierRoles: mockGetTierRoles`) — ใช้ `requireStaffApi` (ไม่ redirect)
    - getTierRoles reject + officer + `STAFF_ROLES` → `ok:false`, status 403, audit `insufficient_role`
    - getTierRoles reject + superadmin + `STAFF_ROLES` → ok
    - getTierRoles resolve `['superadmin']` + officer + `STAFF_ROLES` → 403 (override แคบถูกเคารพ)
    - getTierRoles resolve `['officer','superadmin']` + officer → ok
    - ไม่ส่ง whitelist → ok และ getTierRoles ไม่ถูกเรียก
    - user inactive → 401 + audit `reason:'inactive'`; citizen → 401 `reason:'citizen_role'`; ไม่มี user → 401 `no_staff_record`; passwordVersion ไม่ตรง → 401 `stale_credentials`
- **Regression risk:** กลาง — `tiers.integration.test.ts` ("ไม่มีแถว → fallback") ต้องผ่านต่อ; หน้า admin ทุกหน้าที่ใช้ tier จะปฏิเสธ non-superadmin ระหว่าง tier query ล้ม (ตั้งใจ)
- **VALIDATE:** `npx vitest run src/lib/auth` (รวม `tiers.integration.test.ts`) · `npx tsc --noEmit` · `npx eslint src/lib/auth`

### T7 — เอกสาร/§ comment ให้ตรงพฤติกรรม (F4)

- **Root cause:** PR #117 เปลี่ยนพฤติกรรม authorize แต่ไม่อัปเดต AGENTS.md/§ comment (ดู F4)
- **MIRROR:** รูปแบบย่อหน้าเดิมของ AGENTS.md ส่วน Auth/Authorization (AGENTS.md:190-206)

- **ACTION:** modify `AGENTS.md`, `src/auth.ts` (header 14-24), `src/app/admin/actions.ts` (JSDoc 20-24 + comment 87-88), `src/proxy.ts` (15-16)
- **IMPLEMENT:**
  - `AGENTS.md:197` แทนทั้งย่อหน้าด้วย: "`authorize()` (body in `src/lib/auth/authorize-credentials.ts`) runs `bcrypt.compare` against a `DUMMY_HASH` even for nonexistent emails so failure timing is constant. Only **after** the password verifies does it reject citizen/inactive accounts — by throwing `IneligibleAccountSignin` (`src/lib/auth/login-errors.ts`, a `CredentialsSignin` subclass), so no JWT is ever issued to them. The login action maps the reason to a specific Thai message and an `ACCESS_DENIED` audit row; revealing it is not an enumeration oracle because the password is already proven. `POST /api/auth/callback/credentials` returns 404 (`src/app/api/auth/[...nextauth]/route.ts`): the login action calls Auth.js in-process, so that HTTP endpoint has no legitimate caller and would bypass the action's rate limit and audit."
  - `AGENTS.md` ส่วน Authorization (หลังบรรทัด 206) เพิ่ม: "If the tier matrix (`tier_roles`) cannot be read, `resolveAllowedRoles` fails closed to `SUPERADMIN_ONLY` (superadmin is in every tier, so the system never fully locks). A missing `tier_roles` table is not an error — no overrides can exist, so the compiled defaults are exact."
  - `src/auth.ts` header: แทน 3 บรรทัด "§ authorize() ไม่ทำ role/isActive check …" ด้วย "§ authorize() (src/lib/auth/authorize-credentials.ts) ปฏิเสธ citizen/บัญชีระงับหลัง bcrypt ผ่าน โดย throw IneligibleAccountSignin — ไม่ออก JWT ให้ แต่ action ยังแสดงข้อความเจาะจงได้ (ไม่ใช่ oracle: รหัสถูกแล้ว)"
  - `actions.ts` JSDoc ของ `login`: "ตรวจ role/isActive ที่นี่ …" → "authorize() ปฏิเสธ citizen/บัญชีระงับหลังยืนยันรหัส (IneligibleAccountSignin) — action แปลงเป็นข้อความเจาะจง + ACCESS_DENIED; post-check หลัง signIn เหลือไว้กัน race"; ลบ comment "(authorize callback ตั้งใจไม่เช็ค 2 อย่างนี้ …)"
  - `proxy.ts:15-16`: "role check จริงอยู่ที่ admin/actions.ts (login) + admin/page.tsx (defensive re-check)" → "role/isActive ตัดสินที่ authorize() (ไม่ออก JWT ให้ citizen/บัญชีระงับ) และ requireStaff/requireStaffApi (re-fetch DB ทุก request)"
- **Tests:** ไม่มี (เอกสาร) — ตรวจด้วย grep
- **Regression risk:** ไม่มี (comment/docs)
- **VALIDATE:** `grep -rn "deliberately does not check\|ไม่ทำ role/isActive\|ตั้งใจไม่เช็ค 2 อย่าง\|role check จริงอยู่ที่ admin/actions" AGENTS.md src` → ว่าง

### T8 — SSE subscriber ต่อใหม่จริง + ไม่ deliver ซ้ำ + เพดาน listener (F5, F14, F18)

- **Root cause:** `@upstash/redis@1.38.0/nodejs.js:232-265` อ่าน stream ใน IIFE แยก — stream จบ/พังไม่ dispatch `'error'` ให้ Subscriber → ตรวจไม่ได้จาก event; reconnect เดิมรอ client ใหม่; ตัวเก่าไม่ถูก unsubscribe
- **Fix strategy:** heartbeat watchdog ผ่าน loopback — Redis ส่ง publish กลับหา publisher เองอยู่แล้ว (เหตุผลของ `SERVER_ID` เดิม) ทุก `HEARTBEAT_MS` publish ping; ข้อความ origin ตัวเอง (ping หรือ broadcast จริง) = หลักฐานว่า stream ยังมีชีวิต; เงียบเกิน `STALE_AFTER_MS` หรือ `'error'` → ปิดตัวเก่า + subscribe ใหม่; ไม่มี listener → หยุดทั้ง subscriber และ watchdog
- **ACTION:** modify `src/lib/line/sse/broadcaster.ts`, `broadcaster.test.ts`; create `broadcaster.redis.test.ts`
- **IMPLEMENT** (แทน `subscriberStarted` + `ensureRedisSubscriber` เดิม; `broadcast()` คงเดิม):
  ```ts
  const emitter = new EventEmitter();
  // § เพดาน 100 = staff ~20 คน × หลายแท็บ (1 listener ต่อ SSE connection) ยังเหลือ headroom
  // default 10 ต่ำกว่าโหลดปกติ → warn หลอก; เกิน 100 ค่อยเป็นสัญญาณรั่วจริง
  emitter.setMaxListeners(100);

  type PingWire = { type: 'ping'; _origin: string };
  type WireMessage = WireEvent | PingWire;

  // § Upstash อ่าน stream ใน IIFE แยก — stream ขาดไม่ยิง 'error' ให้ Subscriber จึงต้องตรวจเอง:
  // ping วนกลับหาตัวเอง (loopback) ทุก HEARTBEAT_MS เงียบเกิน STALE_AFTER_MS = stream ตาย → ต่อใหม่
  const HEARTBEAT_MS = 30_000;
  const STALE_AFTER_MS = HEARTBEAT_MS * 2 + 5_000;

  type Sub = ReturnType<typeof redis.subscribe<WireMessage>>;
  let sub: Sub | null = null;
  let lastLoopbackAt = 0;
  let watchdog: ReturnType<typeof setInterval> | null = null;

  function stopSubscriber(): void {
    const old = sub;
    sub = null;
    if (!old) return;
    old.removeAllListeners();
    old.unsubscribe().catch(() => {});
  }

  function startSubscriber(): void {
    stopSubscriber();
    const current = redis.subscribe<WireMessage>(CHANNEL);
    sub = current;
    lastLoopbackAt = Date.now();
    current.on('message', ({ message }) => {
      // § ตัวเก่าที่ถูกแทนแล้วห้าม deliver — กันข้อความซ้ำช่วงสลับ subscriber
      if (sub !== current || !message) return;
      if (message._origin === SERVER_ID) {
        lastLoopbackAt = Date.now();
        return;
      }
      if (message.type === 'ping') return;
      const { _origin: _ignored, ...event } = message;
      emitter.emit('sse', event as SseEvent);
    });
    current.on('error', (error) => {
      if (sub !== current) return;
      console.warn('[sse-broadcaster] redis subscriber error — ต่อใหม่รอบ heartbeat ถัดไป', error);
      stopSubscriber();
    });
  }

  function stopWatchdog(): void {
    if (watchdog) clearInterval(watchdog);
    watchdog = null;
  }

  function heartbeat(): void {
    if (emitter.listenerCount('sse') === 0) {
      stopSubscriber();
      stopWatchdog();
      return;
    }
    if (!sub || Date.now() - lastLoopbackAt > STALE_AFTER_MS) startSubscriber();
    const ping: PingWire = { type: 'ping', _origin: SERVER_ID };
    redis.publish(CHANNEL, JSON.stringify(ping)).catch(() => {});
  }

  function ensureRedisSubscriber(): void {
    if (!REDIS_BRIDGE_ENABLED) return;
    if (!sub) startSubscriber();
    if (!watchdog) {
      watchdog = setInterval(heartbeat, HEARTBEAT_MS);
      watchdog.unref?.();
    }
  }
  ```
  `subscribe()` เดิมเรียก `ensureRedisSubscriber()` แล้ว `emitter.on` เหมือนเดิม; `ReturnType<typeof redis.subscribe<WireMessage>>` เป็น instantiation expression (TS ≥4.7) ใช้ได้เพราะ `Redis.subscribe` typed `<TMessage>(channels) => Subscriber<TMessage>`; ถ้าไม่ผ่านให้ใช้ `ReturnType<typeof redis.subscribe>` แล้ว cast `message as WireMessage` (**ห้าม** import `Subscriber` — @upstash/redis 1.38 ไม่ export type นี้, nodejs.d.ts:240)
- **MIRROR:** mock `@/lib/upstash` แบบ `src/app/api/line/webhook/route.test.ts:21-36`
- **Tests** (`broadcaster.redis.test.ts`): `vi.hoisted` สร้าง `FakeSub` (`on(type, fn)` เก็บ handler, `emit(type, payload)`, `unsubscribe = vi.fn(async () => {})`, `removeAllListeners = vi.fn()`) และ `fake = { subs: FakeSub[], echo: true }`; mock `@/lib/upstash` → `redis.subscribe` สร้าง FakeSub ใหม่ push ลง `fake.subs`, `redis.publish(ch, payload)` ถ้า `fake.echo` ส่ง `{ message: JSON.parse(payload) }` ให้ handler `'message'` ของ sub ตัวล่าสุด; `beforeEach`: `vi.useFakeTimers()`, `vi.stubEnv('UPSTASH_REDIS_REST_URL','http://fake')`, `vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','fake-token-0123456789')`, `vi.resetModules()`, reset fake, แล้ว `await import('./broadcaster')`; `afterEach`: `vi.useRealTimers()`, `vi.unstubAllEnvs()`
  1. subscribe 2 ครั้ง → `redis.subscribe` 1 ครั้ง
  2. sub `'error'` → `subs[0].unsubscribe` ถูกเรียก; `advanceTimersByTime(30_000)` → `subs.length === 2` (ต่อใหม่โดยไม่มี client ใหม่)
  3. `fake.echo = false` (stream ตายเงียบ) → `advanceTimersByTime(90_000)` → `subs.length === 2` และ `subs[0].unsubscribe` ถูกเรียก
  4. `fake.echo = true` → `advanceTimersByTime(300_000)` → `subs.length === 1`
  5. หลังต่อใหม่: `subs[0].emit('message', { message: { type:'new_message', conversationId:'c', payload:{}, _origin:'other' } })` → listener ไม่ถูกเรียก; ส่งทาง `subs[1]` → ถูกเรียก 1 ครั้งด้วย event ไม่มี `_origin`
  6. ping จาก origin อื่น → listener ไม่ถูกเรียก
  7. ถอด listener ทั้งหมด → `advanceTimersByTime(30_000)` → `subs[0].unsubscribe` ถูกเรียก; publish ไม่เพิ่มอีกหลัง `advanceTimersByTime(120_000)`
  8. `vi.spyOn(process, 'emitWarning')` + subscribe 20 listener → `emitWarning.mock.calls.some(([w]) => (w as Error)?.name === 'MaxListenersExceededWarning')` เป็น false (Node ส่ง Error object ไม่ใช่ string); fake publish ต้องเรียก handler แบบ synchronous ก่อน await ใด ๆ
  - `broadcaster.test.ts` เดิม: เพิ่ม `vi.mock('@/lib/upstash', () => ({ redis: { subscribe: () => ({ on: () => {}, unsubscribe: async () => {}, removeAllListeners: () => {} }), publish: async () => 1 } }))` บนสุด (test เดิมห้ามแก้ assertion)
- **Regression risk:** กลาง — publish ping เพิ่ม 2 คำสั่ง/นาที/process ที่มี SSE client (ยอมรับได้); รุ่นเก่าระหว่าง rolling deploy ที่ได้ ping จะ emit `{type:'ping'}` ให้ client — `use-chat-sse.ts` ต้องไม่พังกับ type ที่ไม่รู้จัก (**ตรวจใน implement**: ถ้า handler `switch` ไม่มี default ที่ throw ถือว่าปลอดภัย)
- **VALIDATE:** `npx vitest run src/lib/line/sse` · `npx tsc --noEmit` · `npx eslint src/lib/line/sse`

### T9 — legacy dedup: test จริง + เงื่อนไขลบ (F6, F16)

- **Root cause:** test สร้าง array ที่มีค่าที่ assert อยู่แล้ว; `checkDuplicate` ไม่เคยถูกเรียกใน test ใดด้วยแถว hash สูตรเก่า
- **ACTION:** modify `src/lib/cid-hmac.test.ts` (describe `legacyDedupPayload`), `src/lib/dedup.ts`; create `src/lib/dedup.integration.test.ts`
- **IMPLEMENT:**
  - cid-hmac.test.ts test 'hash เก่าจับเรื่องเก่าได้…': คง `expect(oldHash).not.toBe(newHash)`, **ลบ** `expect([newHash, oldHash]).toContain(oldHash)` และ comment ข้างบน; เพิ่ม test golden: `import { createHmac } from 'node:crypto'` → `expect(generateLegacyDedupHash('c','  ถนน  ชำรุด ','x')).toBe(createHmac('sha256', process.env.CID_HMAC_KEY ?? '').update('c|  ถนน  ชำรุด |x'.toLowerCase().trim(),'utf8').digest('hex'))`
  - dedup.ts เหนือบรรทัด `const legacy = …` เพิ่ม: "§ ลบ legacy ได้ (ตัวนี้ + generateLegacyDedupHash/legacyDedupPayload ใน cid-hmac.ts) เมื่อพ้น 7 วันหลัง deploy production ที่มี #117 — ตรวจก่อนลบ: `SELECT count(*) FROM dedup_hashes WHERE created_at < '<วัน deploy>' AND expires_at > now()` ต้องได้ 0"
  - dedup.integration.test.ts (pattern `src/app/api/cron/close-stale/route.integration.test.ts`: `RUN = Date.now()`, เก็บ id, `afterAll` ลบ + `closeDb()`): helper `insertRow(hash, expiresInMs)` insert `dedupHashes` `{ id: generateId(), hash, caseId: \`it-dedup-${RUN}-${n}\`, expiresAt: new Date(Date.now()+expiresInMs) }` (`case_id` ไม่มี FK จริง — schema.ts:537)
    1. แถว `generateLegacyDedupHash(cid,'ถนน  ชำรุด','x')` อายุ +1 วัน → `checkDuplicate(cid,'ถนน  ชำรุด','x')` = `{ isDuplicate:true, caseId }` (input มีช่องว่างคู่ → hash ใหม่ ≠ เก่า จึงพิสูจน์ทาง legacy)
    2. แถว legacy หมดอายุ (−1 นาที) → `isDuplicate:false`
    3. แถว `generateDedupHash(cid2,'ถนน ชำรุด','x')` → `checkDuplicate(cid2,'ถนน   ชำรุด','x')` = true (whitespace-variant ด้วยสูตรใหม่)
    ใช้ `cid = \`it-dedup-${RUN}\`` ไม่ชนข้อมูลอื่น
- **Regression risk:** ต่ำ (test + comment)
- **VALIDATE:** `npx vitest run src/lib/cid-hmac.test.ts src/lib/dedup.integration.test.ts`

### T10 — cid-hmac: comment ถูกต้อง + test อ่าน key สด (F8)

- **Root cause:** § comment อ้างว่าโค้ดเก่า "assert สดแต่ hash ใช้ตัวแปรเก่า" ซึ่งไม่จริง (b0301ff^ ใช้ `HMAC_KEY` ทั้งคู่); test เดิม reset module ทุกเคส จึงไม่พิสูจน์การอ่านสด
- **ACTION:** modify `src/lib/cid-hmac.ts:12-13`, `src/lib/cid-hmac.test.ts:107-108`, `vitest.config.ts:12-14`
- **IMPLEMENT:**
  - cid-hmac.ts แทน 2 บรรทัด § ด้วย: "§ อ่าน key สดทุกครั้ง ไม่ผูกค่าไว้ตอน import — assert กับ hash ใช้แหล่งเดียวกันในจังหวะเดียวกันเสมอ และโค้ดที่ตั้ง env หลัง import (scripts, test ที่ stubEnv) ได้ key ที่ถูก (production ที่ key ว่าง/สั้น assertKeyUsable throw ก่อน hash เสมอ)"
  - cid-hmac.test.ts:107-108 → "§ reset module + import ใหม่ทุกเคส เพื่อจำลอง process ที่ env ต่างกัน (key อ่านสดอยู่แล้ว — ดู describe 'อ่าน CID_HMAC_KEY สดทุกครั้ง')"
  - vitest.config.ts:12-14 → "ค่าคงที่สำหรับ unit test เท่านั้น — cid-hmac.ts อ่าน env สดทุกครั้งที่ hash ตั้งไว้ที่นี่ให้ทุก test มี key ผ่าน minLen โดยไม่ต้อง stub เอง (ไม่ใช่ secret จริง) ถูก override ด้วยค่าจริงจาก .env.local สำหรับ integration test"
  - เพิ่ม describe ใหม่ (ใช้ `generateCidHash` ที่ import แบบ static บนสุดของไฟล์ — import ครั้งเดียว):
    - `vi.stubEnv('CID_HMAC_KEY','a'.repeat(32))` → h1; `vi.stubEnv('CID_HMAC_KEY','b'.repeat(32))` → h2; `expect(h1).not.toBe(h2)`
    - `vi.stubEnv('NODE_ENV','production'); vi.stubEnv('CID_HMAC_KEY','')` → `generateCidHash` throw `/CID_HMAC_KEY/`
    - `afterEach(() => vi.unstubAllEnvs())`
- **Regression risk:** ต่ำ
- **VALIDATE:** `npx vitest run src/lib/cid-hmac.test.ts` (ต้องเห็น test ใหม่ผ่าน; ยืนยันว่าถ้ากลับไปใช้ `const HMAC_KEY` ระดับ module test แรกแดง — ทดลองในใจ/รันก็ได้)

### T11 — close-stale: เลือกแถวแน่นอน + truncated แม่น + test (F9)

- **Root cause:** `.limit()` ไม่มี orderBy; `>=` นับค้างหลอก; flag ไม่มีคนอ่าน
- **ACTION:** modify `src/app/api/cron/close-stale/route.ts`; create `route.test.ts`
- **IMPLEMENT:**
  ```ts
  import { eq, and, lt, asc } from 'drizzle-orm';
  // ...
  // § เก่าสุดก่อน (เลือกแถวแน่นอน) + ดึงเกิน 1 แถวเพื่อรู้ว่ายังค้างจริง — `>= LIMIT` บอกค้างหลอกตอนเหลือพอดี
  const staleRows = await db
    .select({ id: cases.id })
    .from(cases)
    .where(and(eq(cases.status, 'done'), eq(cases.isHistorical, false), lt(cases.updatedAt, staleThreshold)))
    .orderBy(asc(cases.updatedAt))
    .limit(CLOSE_STALE_BATCH_LIMIT + 1);
  const truncated = staleRows.length > CLOSE_STALE_BATCH_LIMIT;
  const staleCases = staleRows.slice(0, CLOSE_STALE_BATCH_LIMIT);
  // ...loop เดิม...
  // § cron-job.org ไม่อ่าน body — log ให้เห็น backlog ใน runtime log
  if (truncated) console.warn(`[cron/close-stale] ยังค้างเกิน ${CLOSE_STALE_BATCH_LIMIT} เรื่อง — รอบถัดไปปิดต่อ`);
  ```
  response ใช้ `truncated` ตัวแปรนี้; คง § comment historical เดิม
- **Tests** (`route.test.ts`, ไม่ต้อง Docker): mock `@/lib/cron-auth` (`requireCron: () => ({ ok: true })`), `@/lib/cases/operations` (`applyCaseUpdate: mockApply`, `SYSTEM_ACTOR: { id:'system', role:'system' }`), `@/lib/db` (`getDb → { select: () => chain }` โดย `chain.from/where/orderBy` คืน chain และ `chain.limit = mockLimit` คืน Promise ของ rows)
  - 101 แถว → `closedCount 100`, `truncated true`, `mockApply` 100 ครั้ง, `mockLimit` ถูกเรียกด้วย 101, `orderBy` ถูกเรียก
  - 100 แถว → `truncated false`
  - mockApply คืน `{ ok:false, error:'x' }` 1 แถว → `failedCount 1`, `success false`
- **Regression risk:** ต่ำ — `route.integration.test.ts` assert `closedCount >= 1` ยังจริง
- **VALIDATE:** `npx vitest run src/app/api/cron/close-stale`

### T12 — intake: ด่าน identity ก่อนแตะ DB + test PDPA metadata (F10)

- **Root cause:** pre-check วางหลัง category/dedup/tracking query; guard ใน tx ซ้ำกับ pure function บน input ที่ไม่ถูก mutate; comment อ้างว่ามี audit ซึ่งไม่มี
- **ACTION:** modify `src/lib/cases/intake.ts`, `src/lib/cases/intake.test.ts`
- **IMPLEMENT:**
  - บรรทัดแรกของ `createCase` (ก่อน `const db = await getDb()`):
    ```ts
    // § ด่าน input ก่อนแตะ DB — ไม่มีตัวตน (เว็บไม่มี cid / line ไม่มี lineUserId) = caller ส่ง input ผิด
    // คืน internal แทน throw (caller map เป็น 500/ข้อความทั่วไป) + log ให้เห็น (ไม่มี PII — แค่ channel)
    const identity = citizenIdentityOf(input);
    if (!identity) {
      console.error(`[intake] createCase ไม่มีตัวตนผู้แจ้ง (channel=${input.channel})`);
      return { ok: false, error: 'ไม่สามารถสร้างผู้ใช้งานได้', errorCode: 'internal' };
    }
    ```
  - ลบบล็อก `preIdentity` (intake.ts:114-119) และ guard ใน tx (124-128); ใน tx ใช้ `resolveCitizen(identity, tx)` ตรง ๆ (TS คง narrowing ของ `const` ใน closure)
- **Tests** (เพิ่ม describe ใน intake.test.ts ใช้ `webInput()`, `mockDb`, `mockState` ที่มีอยู่):
  - `it.each([['web ไม่มี cid', { cid: undefined }], ['line ไม่มี lineUserId', { channel: 'line', cid: undefined, lineUserId: undefined }]])` → `{ ok:false, errorCode:'internal' }`, `mockDb.select` และ `mockDb.transaction` ไม่ถูกเรียก (เรียก `.mockClear()` ก่อน), `insertedCases` ว่าง
  - `createCase(webInput({ ipAddress:'203.0.113.9', userAgent:'ua-test' }))` → ok; `JSON.parse(String(mockState.insertedCases[0]?.metadata))` ไม่มี key `ipAddress`/`userAgent` และมี `source:'web'`
- **Regression risk:** ต่ำ-กลาง — ลำดับ error เปลี่ยน: input ไม่มีตัวตน + หมวดผิด เดิมได้ `invalid_category` ตอนนี้ได้ `internal` (caller ทั้ง 2 คือ `api/cases/submit` และ LINE `case-flow.ts` ส่ง identity มาเสมอ — ตรวจ test เดิมทั้งไฟล์ต้องผ่าน)
- **VALIDATE:** `npx vitest run src/lib/cases/intake.test.ts` · `npx tsc --noEmit`

### T13 — test ขอบ `isTokenExpired` (F11)

- **Root cause:** ไม่มี test file — revert `<=` เป็น `<` ได้โดยไม่มีอะไรแดง
- **MIRROR:** vitest `vi.useFakeTimers` + `vi.setSystemTime` (fake Date เป็นค่า default ของ vitest 3)

- **ACTION:** create `src/lib/auth/token-expiry.test.ts`
- **IMPLEMENT:** `const NOW_S = 1_800_000_000`; `beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW_S * 1000); })`; `afterEach(() => vi.useRealTimers())`; `it.each([[NOW_S - 1, true], [NOW_S, true], [NOW_S + 1, false]])('expiresAt=%i → %s', …)`; `isTokenExpired(undefined) === false`
- **Regression risk:** ไม่มี
- **VALIDATE:** `npx vitest run src/lib/auth/token-expiry.test.ts` (ยืนยันว่าถ้า `<=` เป็น `<` เคส `NOW_S` แดง)

### T14 — webhook: event ผิดรูปไม่ลามทั้ง batch + comment ถูกต้อง (F12)

- **Root cause:** `isDuplicateEvent(event)` อยู่นอก try ต่อ event; comment อ้างว่า 400 กัน redeliver (LINE redeliver ทุก non-2xx)
- **ACTION:** modify `src/app/api/line/webhook/route.ts`, `route.test.ts`
- **IMPLEMENT:**
  - § comment เหนือ `let parsed`: "§ body ผ่าน signature แล้วแต่ parse ไม่ได้/ไม่มี events array = request ผิดรูป → 400 ตามความหมาย (ไม่ปล่อย JSON.parse throw เป็น 500 ปน error จริงใน log) — หมายเหตุ: LINE redeliver ทุกสถานะที่ไม่ใช่ 2xx เมื่อเปิด webhook redelivery 400 จึงไม่ได้กัน redeliver"
  - ใน `.map(async (event) => {`:
    ```ts
    // § event ผิดรูป (null/ไม่ใช่ object) ข้ามทีละตัว และ dedup อยู่ใน try ด้วย —
    // message event ที่ไม่มี .message ทำ lineMessageIdOf throw ได้ ห้ามลามเป็น 500 ทั้ง batch
    if (!event || typeof event !== 'object') return;
    try {
      if (await isDuplicateEvent(event)) return;
      await handleEvent(event);
    } catch (error) { /* log เดิม */ }
    ```
- **Tests** (route.test.ts — ใช้ webhookEventId ไม่ซ้ำ test อื่นเพราะ mock redis จำ key ข้าม test):
  - เปลี่ยนชื่อ test 'JSON แตก → 400 ไม่ใช่ 500 (กัน LINE redeliver วน)' → 'JSON แตก → 400 (request ผิดรูป ไม่หลุดเป็น 500)'
  - body `'null'` → 400; `{ events: 'x' }` → 400 (regression test — ผ่านกับโค้ดปัจจุบันอยู่แล้ว ไม่ต้องเห็นแดง)
  - ถ้า eslint type-aware บ่น guard `!event` (type ไม่ nullable) ให้ประกาศพารามิเตอร์ map เป็น `unknown` แล้ว cast `as LineWebhookEvent` หลัง guard
  - `{ events: [null, { type:'follow', webhookEventId:'w-mixed-ok' }] }` → 200, `mockHandle` 1 ครั้งด้วย event follow
  - `{ events: [{ type:'message', webhookEventId:'w-no-msg' }] }` → 200, `mockHandle` ไม่ถูกเรียก
- **Regression risk:** ต่ำ
- **VALIDATE:** `npx vitest run src/app/api/line/webhook`

### T15 — signature: กลับไปเทียบ base64 canonical (F13)

- **Root cause:** `Buffer.from(sig,'base64')` ไม่ throw และยอมรูปไม่ canonical → decode ได้ 32 bytes เท่ากัน; comment อ้างกลับด้าน
- **ACTION:** modify `src/lib/line/signature.ts`, `signature.test.ts`
- **IMPLEMENT:**
  ```ts
  export function verifyLineSignature(body: string, signature: string | null): boolean {
    const channelSecret = process.env.LINE_CHANNEL_SECRET;
    if (!channelSecret || !signature) return false;

    // § เทียบ base64 string ตรงตัว (canonical) ไม่ decode ก่อน — Buffer.from(sig, 'base64') ไม่ throw
    // และยอมรูปไม่ canonical (ไม่มี padding / url-safe / มีขยะปน) ซึ่ง decode ได้ 32 bytes เท่ากันหมด
    // เทียบ string จึงรับเฉพาะรูปที่ LINE ส่งจริง; เช็คความยาวก่อนเพราะ timingSafeEqual บังคับ
    // (ความยาวไม่ใช่ความลับ — HMAC-SHA256 base64 ยาว 44 ตัวเสมอ)
    const expected = Buffer.from(createHmac('sha256', channelSecret).update(body, 'utf8').digest('base64'));
    const received = Buffer.from(signature);
    if (expected.length !== received.length) return false;
    return timingSafeEqual(expected, received);
  }
  ```
- **Tests:** แก้ 'does not throw on malformed base64 signature' ให้ assert `toBe(false)` เพิ่ม; เพิ่ม:
  - unpadded (`sign(body).replace(/=+$/, '')`) → false
  - ต่อท้าย `'\n'` → false; แทรก `'!!'` กลาง → false
  - url-safe: วนหา body `{"i":n}` ที่ `sign(body)` มี `+` หรือ `/` แล้วแปลง `+→-`, `/→_` → false
  - ค่าถูกยัง true (test เดิม)
- **Regression risk:** ต่ำ — ตรรกะเดียวกับก่อน #117 ที่ใช้ใน prod มาแล้ว
- **VALIDATE:** `npx vitest run src/lib/line/signature.test.ts` (test variant ต้องแดงกับโค้ดปัจจุบันก่อนแก้)

## UX Before / After

| จุด | Before (main @ b0301ff) | After |
|---|---|---|
| login: บัญชีระงับ รหัสถูก | 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' | 'บัญชีนี้ถูกระงับการใช้งาน' (กลับเป็นพฤติกรรมก่อน #117) |
| login: citizen รหัสถูก | 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' | 'บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานส่วนเจ้าหน้าที่' |
| login: รหัสผิด / rate limit | ข้อความเดิม | ไม่เปลี่ยน |
| หน้า admin ที่ใช้ tier ระหว่าง `tier_roles` อ่านไม่ได้ | staff ได้สิทธิ์ตาม default (อาจเกิน override) | non-superadmin ถูกส่งกลับ `/admin` (หน้า) หรือได้ 403 (API) จนกว่า query กลับมาได้ |
| แชทแอดมิน (SSE) หลัง Redis stream ขาด | ข้อความข้าม process หายเงียบจนกว่าจะมี client ใหม่ | ต่อใหม่เองภายใน ~90 วินาที (client ไม่ต้องทำอะไร) |
| อื่น ๆ (cron, webhook, intake, signature, dedup) | — | N/A — internal change ไม่มี UI |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `next-auth` import ไม่ได้ใน vitest (T2-T4) | กลาง | fallback ที่กำหนดใน T2: mock `next-auth` ด้วย `CredentialsSignin` stub เฉพาะใน test |
| type ของ `authorize` ไม่รับ `authorizeCredentials` ตรง ๆ (T3) | กลาง | ห่อเป็น arrow `(credentials) => authorizeCredentials(credentials)` |
| fail-closed ทำให้ staff เข้าหน้า tier ไม่ได้ช่วง DB สะดุด (T6) | ต่ำ (ต้อง query `tier_roles` ล้มขณะ `users` query ผ่าน) | ตั้งใจ (เจตนา #117); superadmin ยังเข้าได้; `/admin` ไม่ใช้ tier จึงไม่วน redirect |
| ping ของ watchdog ไปถึง process รุ่นเก่าช่วง rolling deploy (T8) | ต่ำ | ตรวจ `src/app/admin/chat/_hooks/use-chat-sse.ts` ว่า event type ไม่รู้จักไม่ throw ก่อน merge |
| ระยะต่อใหม่ SSE สูงสุด ~90 วิ (T8) | — | ยอมรับ (เดิม = ไม่ต่อเลย); ค่าคงที่ปรับได้ |
| ลำดับ error ของ createCase เปลี่ยน (T12) | ต่ำ | caller ส่ง identity เสมอ; test เดิมทั้งไฟล์ต้องผ่าน |
| flaky timeout เดิม 3 integration file กลบผล full suite | กลาง | รันเดี่ยวยืนยัน (Validation Commands) และเทียบรายชื่อกับ baseline |

## Validation Commands

```bash
npx tsc --noEmit
npx eslint .
npx next build                                   # build gate (script `build` = next build && verify-env; ใช้ env จาก .env.local)
npx vitest run src/lib/auth src/app/admin/actions.test.ts "src/app/api/auth" src/lib/line src/lib/cid-hmac.test.ts src/lib/dedup.integration.test.ts src/app/api/cron/close-stale src/lib/cases/intake.test.ts src/app/api/line/webhook
npx vitest run                                   # full suite เทียบ baseline 1090/1094
npx vitest run src/lib/line/settings.integration.test.ts src/app/api/admin/system-settings/route.integration.test.ts src/app/api/cases/submit/route.integration.test.ts   # flaky baseline รันเดี่ยว
grep -rn "deliberately does not check\|ไม่ทำ role/isActive\|ตั้งใจไม่เช็ค 2 อย่าง\|role check จริงอยู่ที่ admin/actions" AGENTS.md src   # ต้องว่าง
```

(ชื่อไฟล์ settings integration ให้หาด้วย `ls src/lib/line/*settings*.integration.test.ts` ก่อนรัน)

## Testing Strategy

- TDD ต่อ task: test ใหม่ต้องแดงกับโค้ดปัจจุบัน (หรือ compile error สำหรับ export ใหม่) ก่อน implement — บันทึกผลแดงไว้ใน log การ implement
- Unit: mock ที่ขอบ (DB/Redis/Auth.js/headers) ตาม pattern ใน repo; ไม่ mock ตัวที่ทดสอบ
- Integration: เฉพาะ dedup legacy (ต้องใช้ unique index + เวลาหมดอายุของ Postgres จริง)
- ไม่มี e2e ใหม่ (login UI ไม่เปลี่ยน) — `e2e/admin-auth.spec.ts` เป็น smoke เผื่อมีเวลา: `npx playwright test e2e/admin-auth.spec.ts`
- Full suite ท้ายสุด: ไม่มี failure ใหม่เทียบ baseline

## Acceptance Criteria

ตาม PRD ข้อ 1-15 (ทุกข้อ map กับ test ใน task ข้างบน) และ:
- ทุก finding ที่ ACCEPT ใน findings file มี task (ตาราง Finding coverage ใน Metadata)
- High เปิดค้าง = 0
- deviation จากแผนบันทึกเป็น WHAT/WHY
