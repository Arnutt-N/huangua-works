# Plan Review: pr117-review-fix — รอบ 1

**Plan**: .agents/PRPs/plans/pr117-review-fix.plan.md
**Reviewed**: 2026-10-16
**Source PRD**: .agents/PRPs/prds/pr117-review-fix.prd.md · Findings: .agents/PRPs/findings/pr117-findings.md
**Review Mode**: dual
**Verdict**: NOT READY
**Confidence Score**: 7/10 (consensus FAIL → cap 7; arithmetic 10 − 1 (B3) − 1 (X-Auth-Return-Redirect) = 8)

## Reviewer Verdicts

| Reviewer | Diversity | Verdict | Critical issues |
|---|---|---|---|
| A | opus (general-purpose) | FAIL | 0 |
| B | sonnet (general-purpose) — model diversity | PASS | 0 |

## Rubric Results

| # | A | B | Evidence |
|---|---|---|---|
| A1-A6 | PASS | PASS | refs ตรวจกับ repo ได้จริง (callback/index.js:386, web.js:91-108, actions.js:44, nodejs.js:232-265) |
| B1, B2, B4-B7 | PASS | PASS | coverage map ครบ, NOT Building + Risks ครบ |
| B3 | FAIL | PASS | T8 fallback อ้าง `Subscriber` ที่ @upstash/redis 1.38 ไม่ export (nodejs.d.ts:240) |

## 🟡 Important
- T8 fallback type ที่ไม่มีจริง (A) — **แก้แล้ว**: ห้าม import `Subscriber`; ใช้ instantiation expression หรือ `ReturnType<typeof redis.subscribe>` + cast
- `X-Auth-Return-Redirect` ทำให้ signIn ไม่ throw (B) — LEAD ตรวจซ้ำพบว่าแย่กว่าที่ B ประเมิน (รหัสผิดได้ LOGIN_SUCCESS + oracle อีเมล) → **เพิ่ม F20 + ขั้นใน T4 + test**

## 🟢 Minor (แก้แล้ว)
- versioned-cache ref 43-55 → 41-53 · T8 test 8 assert `.name` · T14 ระบุ test ที่เป็น regression (ไม่แดงก่อน) + fallback eslint · T7/T13 เพิ่ม Root cause/MIRROR · use-chat-sse.ts ใน Files to Change

## Reviewer Disagreements
B3: A FAIL (export ที่ไม่มีจริง) vs B PASS — ถือ FAIL ตามกฎ aggregate

## Recommended Next Step
revise (ทำแล้ว) → re-validate รอบ 2

---

# รอบ 2

**Reviewed**: 2026-10-16 · **Review Mode**: dual (A opus, B sonnet — model diversity)
**Verdict**: READY · **Confidence Score**: 8/10 (10 − 0 failed criteria − 2 unique Important)

| Reviewer | Verdict | Critical |
|---|---|---|
| A | PASS (13/13) | 0 |
| B | PASS (13/13) | 0 |

## 🟡 Important (ทำระหว่าง implement)
- T1: JSDoc ของ `isLoginEligible` (roles.ts:44-48) จะค้างหลัง T3 — เขียนใหม่ + ใส่ใน grep gate ของ T7
- PRD ยังไม่มี F20 — เพิ่มใน Scope + AC16

## 🟢 Minor (รับไปทำ)
- T7: AGENTS.md:189 แถว `src/auth.ts` (bcrypt/DB lookup ย้ายไป authorize-credentials.ts)
- T4/F20: เขียน `LOGIN_FAILURE {reason:'auth_return_redirect_header'}` ก่อนคืน
- T11 mock SYSTEM_ACTOR = `{ userId:'system', role:'system' }` (operations.ts:33)
- T8: ตรวจ chat-client.tsx:76-100 ด้วย (A ยืนยันแล้วว่า ignore 'ping'); 'error' จาก parse message ทีละอันจะ restart stream — ระบุใน § comment
- findings: นับรับแก้ = 17 (ไม่ใช่ 16)

## Recommended Next Step
implement
