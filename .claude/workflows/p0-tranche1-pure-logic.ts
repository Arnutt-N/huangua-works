/**
 * P0 Tranche 1: Pure Logic Libs (TDD, no Supabase dependency)
 *
 * 6 agents parallel implement + test pure TypeScript libs:
 * 1. vitest setup (config + first dummy test)
 * 2. cid-checksum.ts (บัตร 13 หลัก algorithm กรมการปกครอง)
 * 3. cid-hmac.ts (keyed HMAC helper C2)
 * 4. thai-date.ts (พ.ศ.+543 + BE locale)
 * 5. budget-validation.ts (numeric(14,2) + ggor_code)
 * 6. dedup.ts (book_no + fiscal_year fingerprint + 24h)
 * 7. route-registry.ts (service_role allow-list C3)
 *
 * Output: 7 files + unit tests (coverage ≥80%) runnable ด้วย `pnpm test:unit`
 * ไม่ต้องการ Supabase/Upstash — ทดสอบได้ local ทันที
 *
 * Dependency: M0 (foundation) + PRP-Plan §4 P0 Foundation + tracking-issues P0-13,P0-14,P0-17,P0-19,P0-21
 */

export const meta = {
  name: 'p0-tranche1-pure-logic',
  description: 'P0 Tranche 1 — Pure logic libs (cid/thai-date/budget/dedup/registry) + vitest TDD',
  phases: [
    'Setup vitest config + dummy test',
    'Implement cid-checksum + tests (TDD)',
    'Implement cid-hmac + tests (TDD)',
    'Implement thai-date + tests (TDD)',
    'Implement budget-validation + tests (TDD)',
    'Implement dedup + route-registry + tests (TDD)',
    'Run all tests + verify coverage ≥80%',
  ],
};

// Spec constants จาก PRP-Plan
const SPEC = {
  CID_HMAC_KEY_MIN: 32, // C2
  BOOK_NO_DEDUP_TTL_HOURS: 24,
  BUDGET_PRECISION: [14, 2], // numeric(14,2)
  FISCAL_YEAR_OFFSET: 543, // พ.ศ. = ค.ศ. + 543
  SERVICE_ROLE_ROUTES: ['/api/cron/*'], // C3
  COVERAGE_TARGET: 80,
};

const CONTEXT = `
# Context สำหรับ Pure Logic Agents

## Goal
Implement 7 pure TypeScript libs + unit tests (≥80% coverage) TDD-first ไม่ต้องการ Supabase/DB

## Files to Create
1. vitest.config.ts — vitest config (coverage threshold 80%, test match **/*.test.ts)
2. src/lib/cid-checksum.ts + test — บัตร 13 หลัก checksum algorithm กรมการปกครอง (P0-14)
3. src/lib/cid-hmac.ts + test — keyed HMAC helper (C2, P0-13) validate CID_HMAC_KEY ≥32
4. src/lib/thai-date.ts + test — พ.ศ. formatter (P0-07 dependency)
5. src/lib/budget-validation.ts + test — numeric(14,2) + ggor_code pattern (P0-17)
6. src/lib/dedup.ts + test — fingerprint book_no+fiscal_year (P0-21)
7. src/lib/route-registry.ts + test — service_role allow-list (C3, P0-19)

## Acceptance Criteria (ทุกไฟล์)
- TDD: เขียน test ก่อน implement (RED → GREEN → REFACTOR)
- Unit test coverage ≥80% per file
- TypeScript strict mode ผ่าน
- ไม่มี external dependency ที่ต้องการ secret/DB (pure logic)
- \`pnpm test:unit\` รันผ่านทั้งหมด

## Tech Stack
- Vitest 3.x (already in package.json devDeps)
- TypeScript strict
- Node.js crypto (built-in สำหรับ HMAC)

## Coding Standards (ตาม C:\Users\arnutt.n\.claude\rules\typescript\*)
- Immutability: คืน object ใหม่ ไม่ mutate input
- Error handling: throw Error ชัดเจน กับ invalid input
- Naming: camelCase functions, PascalCase types
- File size: 200-400 บรรทัด (≤800)
- Comments: เฉพาะ constraint/algorithm ที่โค้ดเองบอกไม่ได้

## PRP-Plan References
- §4 P0 Foundation (L416-443): list ไฟล์ทั้ง 7
- §3.1 folder structure (L171-218): \`src/lib/*.ts\`
- §6 Test Strategy (L542-561): Vitest unit, coverage ≥80%
- P0-13 (tracking-issues L52): CID keyed HMAC ≥32 char
- P0-14 (L53): CID checksum algorithm
- P0-17 (L56): budget numeric(14,2) + ggor_code
- P0-19 (L58): service-role registry
- P0-21 (L60): dedup DB fallback

## Algorithm Specs

### 1. CID Checksum (P0-14)
บัตรประชาชน 13 หลัก checksum algorithm กรมการปกครอง:
\`\`\`
digit[0..11] weight [13,12,11,10,9,8,7,6,5,4,3,2]
sum = Σ(digit[i] * weight[i])
checksum = (11 - (sum % 11)) % 10
ถ้า checksum === digit[12] → valid
\`\`\`
Function: \`validateCidChecksum(cid: string): boolean\`
- Input: string 13 หลัก (อาจมี dash '-' แทรก)
- Normalize: strip non-digit, ต้องเหลือ 13 digit พอดี
- Return: true ถ้า checksum ถูก, false otherwise

Test cases:
- Valid: '1234567890123' (สมมุติ — ต้องคำนวณจริง)
- Invalid: '1234567890124' (checksum ผิด)
- Format: '1-2345-67890-12-3' → normalize แล้วตรวจ
- Edge: '', '12345', 'abcdefghijklm', null/undefined → false

### 2. CID HMAC (P0-13, C2)
Keyed HMAC-SHA256 wrapper สำหรับ hash CID:
\`\`\`typescript
import { createHmac } from 'node:crypto';

function computeCidHmac(cid: string, key: string): string {
  if (key.length < 32) throw new Error('CID_HMAC_KEY must be ≥32 chars');
  // validate cid checksum ก่อน
  const hmac = createHmac('sha256', key).update(cid).digest('hex');
  return hmac;
}
\`\`\`
Functions:
- \`computeCidHmac(cid: string, key: string): string\` — คืน hex (64 chars)
- \`validateHmacKey(key: string): boolean\` — ต้อง ≥32 char

Test cases:
- Valid key ≥32 + valid CID → hex 64 chars
- Key <32 → throw Error
- Same CID + same key → same HMAC (deterministic)
- Different key → different HMAC
- Invalid CID checksum → throw Error

### 3. Thai Date (thai-date.ts)
พ.ศ. formatter (BE = Buddhist Era):
\`\`\`typescript
function formatThaiDate(date: Date, locale: 'th' | 'th-northeast' = 'th'): string {
  const year = date.getFullYear() + 543;
  // format DD/MM/YYYY (พ.ศ.)
  return \`\${day}/\${month}/\${year}\`;
}

function parseThaiYear(buddhistYear: number): number {
  return buddhistYear - 543; // คืน gregorian year
}
\`\`\`
Functions:
- \`formatThaiDate(date: Date, locale?): string\` — 'DD/MM/YYYY (พ.ศ.)'
- \`parseThaiYear(be: number): number\` — BE → CE
- \`getCurrentFiscalYear(): number\` — ปีงบ (ต.ค. → ก.ย. ปีถัดไป) ในรูป พ.ศ.

Test cases:
- 2024-01-15 → '15/01/2567'
- 2025-10-01 fiscal year → 2569 (ปีงบ 2569 = ต.ค. 2568 - ก.ย. 2569)
- parseThaiYear(2567) → 2024

### 4. Budget Validation (P0-17, L-D1)
งบประมาณ กก.ทร. structured:
\`\`\`typescript
interface BudgetInput {
  amount: number;       // ต้อง numeric(14,2) — max 999999999999.99
  ggorCode?: string;    // รหัส กก.ทร. optional (pattern check)
  fiscalYear: number;   // ปีงบ พ.ศ.
}

function validateBudget(input: BudgetInput): { valid: boolean; errors: string[] } {
  // amount: 0 ≤ x ≤ 999999999999.99, ทศนิยม ≤2 ตำแหน่ง
  // ggorCode: ถ้ามี ต้องเป็น pattern (ตัวอย่าง 'GGOR-2024-001')
  // fiscalYear: ≥ 2560 (พ.ศ.)
  return { valid: true, errors: [] };
}
\`\`\`
Functions:
- \`validateBudget(input): { valid, errors }\`
- \`formatBudgetAmount(amount: number): string\` — '1,234,567.89'

Test cases:
- Valid: { amount: 50000.50, fiscalYear: 2568 }
- Invalid amount: -100, 1e15 (เกิน 14 digits), 123.456 (3 decimals)
- Invalid fiscalYear: 2500 (ก่อน พ.ศ. 2560)
- ggorCode pattern (ถ้ามี): 'GGOR-2024-001' valid, 'invalid' invalid

### 5. Dedup (P0-21, H8)
Fingerprint book_no + fiscal_year สำหรับ dedup (24h TTL):
\`\`\`typescript
function generateDedupKey(bookNo: string, fiscalYear: number): string {
  // composite key: "dedup:book:\${bookNo}:\${fiscalYear}"
  return \`dedup:book:\${bookNo}:\${fiscalYear}\`;
}

function parseDedupKey(key: string): { bookNo: string; fiscalYear: number } | null {
  // parse กลับ
}
\`\`\`
Functions:
- \`generateDedupKey(bookNo, fiscalYear): string\`
- \`parseDedupKey(key): { bookNo, fiscalYear } | null\`

Test cases:
- generateDedupKey('HN-2568-000123', 2568) → 'dedup:book:HN-2568-000123:2568'
- parseDedupKey('dedup:book:HN-2568-000123:2568') → { bookNo: 'HN-2568-000123', fiscalYear: 2568 }
- parseDedupKey('invalid') → null

### 6. Route Registry (P0-19, C3)
Service-role allow-list:
\`\`\`typescript
const ALLOWED_SERVICE_ROLE_ROUTES = [
  '/api/cron/ping',
  '/api/cron/close-stale',
  '/api/cron/retention',
  '/api/cron/escalate',
];

function isServiceRoleRouteAllowed(pathname: string): boolean {
  return ALLOWED_SERVICE_ROLE_ROUTES.some(r => pathname.startsWith(r));
}
\`\`\`
Functions:
- \`isServiceRoleRouteAllowed(pathname): boolean\`
- \`ALLOWED_SERVICE_ROLE_ROUTES: readonly string[]\`

Test cases:
- '/api/cron/ping' → true
- '/api/cron/retention' → true
- '/api/cases' → false (ไม่อยู่ใน allow-list)
- '/api/cron/unknown' → false (ไม่มีใน list แม้ขึ้นต้น /api/cron/)

## Workflow Strategy
1. Agent "vitest-setup": สร้าง vitest.config.ts + src/lib/__tests__/dummy.test.ts (sanity)
2. Agent "cid-checksum": TDD — เขียน test ก่อน → implement → coverage ≥80%
3. Agent "cid-hmac": TDD — เขียน test ก่อน → implement → coverage ≥80%
4. Agent "thai-date": TDD — เขียน test ก่อน → implement → coverage ≥80%
5. Agent "budget-validation": TDD — เขียน test ก่อน → implement → coverage ≥80%
6. Agent "dedup-registry": TDD — implement dedup.ts + route-registry.ts + tests → coverage ≥80%
7. Final verify: รัน \`pnpm test:unit\` ทั้งหมด + check coverage report ≥80%

Agent ทำงาน parallel (1-6), agent 7 (verify) รอทุกคนเสร็จ
`;

agent({
  name: 'vitest-setup',
  prompt: `${CONTEXT}

## Your Task: Setup Vitest Config + Sanity Test

1. สร้าง \`vitest.config.ts\` ที่ root:
   - test.include: ['**/*.test.ts']
   - coverage.enabled: true, provider: 'v8', thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 }
   - exclude: node_modules, .next, dist

2. สร้าง \`src/lib/__tests__/dummy.test.ts\` (sanity test):
   - import { describe, it, expect } from 'vitest'
   - test ง่ายๆ เช่น \`expect(1 + 1).toBe(2)\`

3. เพิ่ม script ใน package.json:
   - \`"test:unit": "vitest run"\`
   - \`"test:unit:watch": "vitest"\`
   - \`"test:unit:coverage": "vitest run --coverage"\`

4. รัน \`pnpm test:unit\` verify sanity test ผ่าน

Output: vitest.config.ts + dummy.test.ts + package.json scripts + verify run ผ่าน`,
});

agent({
  name: 'cid-checksum',
  prompt: `${CONTEXT}

## Your Task: CID Checksum (TDD)

TDD workflow:
1. เขียน test \`src/lib/__tests__/cid-checksum.test.ts\` ก่อน (RED):
   - Valid CID examples (ต้องคำนวณ checksum จริง)
   - Invalid checksum
   - Format with dash normalize
   - Edge cases (empty, short, non-digit, null)

2. Implement \`src/lib/cid-checksum.ts\` (GREEN):
   - \`validateCidChecksum(cid: string): boolean\`
   - Algorithm ตาม spec (weight [13,12,...,2], modulo 11)
   - Normalize: strip non-digit, length === 13

3. Refactor (REFACTOR): clean up, add JSDoc comments

4. รัน \`pnpm test:unit src/lib/__tests__/cid-checksum.test.ts\` verify ผ่าน
5. Check coverage \`pnpm test:unit:coverage\` ต้อง ≥80%

Output: cid-checksum.ts + cid-checksum.test.ts (coverage ≥80%)`,
});

agent({
  name: 'cid-hmac',
  prompt: `${CONTEXT}

## Your Task: CID HMAC (TDD)

TDD workflow:
1. เขียน test \`src/lib/__tests__/cid-hmac.test.ts\` ก่อน (RED):
   - Valid key ≥32 + valid CID → hex 64 chars
   - Key <32 → throw Error
   - Same CID + key → deterministic HMAC
   - Different key → different HMAC
   - Invalid CID checksum → throw Error (call cid-checksum.validateCidChecksum)

2. Implement \`src/lib/cid-hmac.ts\` (GREEN):
   - \`computeCidHmac(cid: string, key: string): string\`
   - \`validateHmacKey(key: string): boolean\`
   - import { createHmac } from 'node:crypto'
   - import { validateCidChecksum } from './cid-checksum'

3. Refactor + JSDoc

4. รัน test + check coverage ≥80%

Output: cid-hmac.ts + cid-hmac.test.ts (coverage ≥80%)`,
});

agent({
  name: 'thai-date',
  prompt: `${CONTEXT}

## Your Task: Thai Date (TDD)

TDD workflow:
1. เขียน test \`src/lib/__tests__/thai-date.test.ts\` ก่อน:
   - formatThaiDate(new Date('2024-01-15')) → '15/01/2567'
   - parseThaiYear(2567) → 2024
   - getCurrentFiscalYear() (mock date ต.ค./ก.ย. boundary)

2. Implement \`src/lib/thai-date.ts\`:
   - \`formatThaiDate(date: Date, locale?: 'th' | 'th-northeast'): string\`
   - \`parseThaiYear(be: number): number\`
   - \`getCurrentFiscalYear(): number\` (ต.ค. เริ่มปีงบใหม่)

3. Refactor + JSDoc

4. รัน test + coverage ≥80%

Output: thai-date.ts + thai-date.test.ts (coverage ≥80%)`,
});

agent({
  name: 'budget-validation',
  prompt: `${CONTEXT}

## Your Task: Budget Validation (TDD)

TDD workflow:
1. เขียน test \`src/lib/__tests__/budget-validation.test.ts\`:
   - Valid budget
   - Invalid: negative, เกิน 14 digits, >2 decimals, fiscalYear <2560
   - ggorCode pattern (optional)
   - formatBudgetAmount

2. Implement \`src/lib/budget-validation.ts\`:
   - \`interface BudgetInput { amount, ggorCode?, fiscalYear }\`
   - \`validateBudget(input): { valid, errors }\`
   - \`formatBudgetAmount(amount): string\` (comma separator)

3. Refactor + JSDoc

4. รัน test + coverage ≥80%

Output: budget-validation.ts + budget-validation.test.ts (coverage ≥80%)`,
});

agent({
  name: 'dedup-registry',
  prompt: `${CONTEXT}

## Your Task: Dedup + Route Registry (TDD)

TDD workflow:
1. เขียน test \`src/lib/__tests__/dedup.test.ts\` + \`route-registry.test.ts\`:
   - dedup: generateDedupKey + parseDedupKey
   - registry: isServiceRoleRouteAllowed (allowed/disallowed routes)

2. Implement \`src/lib/dedup.ts\`:
   - \`generateDedupKey(bookNo, fiscalYear): string\`
   - \`parseDedupKey(key): { bookNo, fiscalYear } | null\`

3. Implement \`src/lib/route-registry.ts\`:
   - \`ALLOWED_SERVICE_ROLE_ROUTES: readonly string[]\` = ['/api/cron/ping', '/api/cron/close-stale', '/api/cron/retention', '/api/cron/escalate']
   - \`isServiceRoleRouteAllowed(pathname): boolean\`

4. Refactor + JSDoc

5. รัน test + coverage ≥80%

Output: dedup.ts + route-registry.ts + 2 test files (coverage ≥80%)`,
});

agent({
  name: 'final-verify',
  prompt: `${CONTEXT}

## Your Task: Final Verify All Tests + Coverage

1. รัน \`pnpm test:unit\` ทั้งหมด verify ไม่มี failing test
2. รัน \`pnpm test:unit:coverage\` verify coverage ≥80% ทุกไฟล์:
   - cid-checksum.ts
   - cid-hmac.ts
   - thai-date.ts
   - budget-validation.ts
   - dedup.ts
   - route-registry.ts

3. ถ้ามี file ใดที่ coverage <80% แจ้ง agent ที่รับผิดชอบให้เพิ่ม test

4. สรุปผล:
   - ✅ ไฟล์ทั้ง 7 + tests ครบ
   - ✅ \`pnpm test:unit\` ผ่านทั้งหมด
   - ✅ Coverage ≥80% ทุกไฟล์
   - Output: coverage report summary

ถ้าทุกอย่างผ่าน → **Tranche 1 เสร็จสมบูรณ์**`,
  dependsOn: ['vitest-setup', 'cid-checksum', 'cid-hmac', 'thai-date', 'budget-validation', 'dedup-registry'],
});
