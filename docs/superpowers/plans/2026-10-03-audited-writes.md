# Audited Writes (เขียนข้อมูล + audit ใน transaction เดียว) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ทุกจุดที่ "เปลี่ยนสถานะข้อมูล + เขียน audit" ในขอบเขตนี้ (แจ้งเรื่องใหม่, ถอนความยินยอม, จัดการผู้ใช้ใน admin, แก้/ลบ FAQ) commit หรือ rollback พร้อมกันเสมอ — audit ล้ม = ข้อมูลไม่เปลี่ยน, ไม่มี error หลอกหลัง commit, แจ้งเรื่องใหม่ไม่ค้างครึ่งทาง

**Architecture:** ใช้แบบอย่างเดียวกับ `applyCaseUpdate` (`src/lib/cases/operations.ts:87-107`) คือ `db.transaction(async (tx) => { …เขียน…; await logAudit(entry, tx); })` — `logAudit(entry, db?: DbOrTx)` รองรับ tx อยู่แล้ว (`src/lib/audit.ts:76-89`) งานหลักคือ (1) ขยาย type พารามิเตอร์ `db?` ของ `grantConsent`/`revokeConsent`/`recordDedupHash` จาก `Db` เป็น `DbOrTx` (2) ห่อ `createCase` ทั้ง 5 การเขียนไว้ใน tx เดียว แล้วเรียก `resolveCitizen`/`recordIntakeConsent` ของ c1 ด้วย `tx` (3) เพิ่ม `revokeConsentWithAudit(w, tx)` ใน `src/lib/consent.ts` — ไม่เปิด tx เอง c1 เป็นเจ้าของ tx (4) ห่อ update+audit ใน `users.ts` และ `faq/[id]/route.ts` ด้วย tx โดยใช้ `result.data` ไม่มีการเปลี่ยน schema ไม่มี migration

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM 0.45.2 + postgres-js, PostgreSQL 17 (Docker :5433), Upstash REST ผ่าน up-redis (พอร์ตโฮสต์จาก `UPREDIS_HOST_PORT` ใน `.env` — เครื่องนี้ `8081`; compose ไม่ได้อ่าน `.env.local`; REST URL `http://localhost:8081` อยู่ใน `.env.local`), Vitest 3, Zod 4.4.3

**Spec:** `project-log-md/architecture-review/2026-10-03/architecture-review-20261003-205746.html` — การ์ด `id="c6"` ("เขียนข้อมูลกับ audit ใน transaction เดียวกัน")

## Global Constraints

### ข้อยกเว้น baseline ก่อน c1 ที่ผู้ใช้อนุมัติ (2026-10-04)

ส่วนนี้มีผลเหนือ snippet ที่พึ่ง c1 ด้านล่าง: ห้ามสร้าง/เรียก resolveCitizen,
recordIntakeConsent, withdrawCaseConsent หรือ citizen-access ของ c1

PRD: ข้อมูลและ audit ต้อง commit/rollback พร้อมกันใน createCase, withdrawal,
users actions และ FAQ โดยไม่มี migration ไม่เปลี่ยน error/§ comments
เกณฑ์รับงานและ metric: rollback tests และ success tests ผ่าน; tsc, eslint เฉพาะไฟล์
และ vitest รวม integration ผ่านจริง ไม่รวมหมวด B/D, operations.ts, push/PR/merge

PRP-Plan: Task 0 ใช้ stack เดิมและ baseline ต้องผ่าน; Task 1 ขยาย consent/dedup
เป็น DbOrTx คง resolveSubmitter ให้รับ tx ใช้ ON CONFLICT แล้ว SELECT เมื่อชน
ไม่ catch statement error; ห่อ user/link/consent/case/dedup/audit ใน tx เดียว
ออก trackingCode ก่อน tx คง consent เว็บ/LIFF ตาม baseline แก้ mock tx/conflict
และสร้าง intake integration ตามแผน; Task 2 helper revokeConsentWithAudit ไม่เปิด tx
route เดิมเปิด tx เรียก helper ทั้งเว็บ/LIFF คง enforcement c7 และ denial audit
Task 3–4 ตามแผนเดิม คง parsed.data เพราะ c8 ยังไม่ merge; Task 5 gates ทีละคำสั่ง
แล้ว commit local เฉพาะไฟล์งานนี้

เพิ่มเติมจาก full-suite gate: src/lib/line/bot/case-flow.test.ts มี DB mock อีกชุดที่
createCase ใช้จริง จึงต้องเพิ่ม transaction/ON CONFLICT/RETURNING เฉพาะ mock นี้
ไม่แก้ src/lib/line/bot/case-flow.ts ซึ่งเป็น caller ที่ห้ามแตะ

Test strategy: red → green ด้วย passthrough audit mock/Postgres จริงทุกหน่วย
เพิ่มตรวจ route wiring เว็บ/LIFF และ unique conflict ที่ไม่ abort tx
ทำทีละ Task ไม่มี tranche ขนานเพราะ RAM ต่ำ ความเสี่ยง unique collision/consent
และ rate limit regression บรรเทาด้วย tests และคง semantics เดิม
Review: ไฟล์จริงมี resolveSubmitter, DbOrTx, logAudit(entry, tx), parsed.data
และ enforcement c7 ตามที่ใช้ ไม่พึ่ง c1 ขอบเขตตรงกับคำสั่งที่อนุมัติ


- ใช้ `npx` แทน `pnpm` ทุกคำสั่ง (`pnpm` ค้างใน environment นี้)
- ทำงานบน branch `refactor/audited-writes` เท่านั้น; GitHub Actions ปิดโดยตั้งใจ — gate จริงคือ `npx tsc --noEmit`, `npx eslint` เฉพาะไฟล์ที่แตะต้อง 0, `npx vitest run` + Vercel Preview ห้ามอ้าง `npx eslint .` exit 0 (baseline 21 errors / 3 warnings)
- **ชนกับ plan `citizen-case-access` (c1) — semantic ไม่ใช่แค่ rebase:**
  - ก่อน Task 1: `git fetch origin && git log origin/main --oneline -- src/lib/cases/intake.ts src/app/api/consent/withdraw/route.ts src/lib/cases/citizen-access` ถ้า c1 merge แล้ว อ่านไฟล์ใหม่ ห้ามเรียก `resolveSubmitter` (c1 ลบแล้ว)
  - `createCase` ห่อ transaction แล้วเรียก `resolveCitizen(identity, tx)` + `recordIntakeConsent(..., tx)` ของ c1 (`db?: DbOrTx` ตั้งแต่ต้นในแผน c1) ห้ามส่ง `Db` อย่างเดียว
  - identity ของ c1 ใช้ `INSERT ... ON CONFLICT ... RETURNING` แล้ว `SELECT` ในคำสั่งเดียวกัน (snippet เดียวกันในแผน c1 Task 1) — ห้าม catch-unique-แล้ว-select ใน tx (statement error ทำให้ทั้ง tx abort) ห้ามแค่เปลี่ยน type
  - atomic withdraw: **c1 เป็นเจ้าของ tx** (`withdrawCaseConsent`) แล้วเรียก helper `revokeConsentWithAudit(w, tx)` ของแผนนี้ภายใน tx เดียวกัน ห้ามเปิด tx ใน helper (จะซ้อนกับ `withdrawConsent` เดิม) route ของ c1 เรียก `withdrawCaseConsent` ไม่เรียก `withdrawConsent`
  - **แผนนี้เป็นเจ้าของ** `src/lib/cases/intake.integration.test.ts` (โครง + rollback รวม `channel=line`) c1 ต่อท้ายเฉพาะ test consent/visibility — ห้ามให้ c1 สร้างไฟล์ทับ
  - ตารางหมวด B/D ต้อง re-validate หลัง c1/c5 merge: c5 ลบ `setChatSetting`/`invalidateIntentCache`, c1 ลบ `linkLineIdentity` — อย่า implement หมวด B/D จากตารางนี้โดยไม่เปิดไฟล์จริง
- **ชนกับ plan `parsebody-adoption` (c8):** `src/app/api/line/admin/faq/[id]/route.ts` **ไม่ใช่คนละ hunk** — c8 เปลี่ยนชื่อตัวแปร parse เป็น `result` และ `.set({...parsed.data})` / `Object.keys(parsed.data)` อยู่ใน hunk update+audit ที่ Task 4 แทน ต้องใช้ `result.data` ภายใน tx ทั้ง update และ audit (c8 ใช้ชื่อ `result`) ถ้า c8 ยังไม่ merge ให้คง `parsed` ไว้แล้วสลับเป็น `result.data` ตอน rebase
- **ชนกับ plan `rate-limit-policies` (c7):** `src/app/api/consent/withdraw/route.ts` — ถ้าแผนนี้แตะ route (เฉพาะกรณี c1 ยังไม่ merge) ต้องคง enforcement ของ c7: `enforceRateLimit('consentWithdraw', ip)` + `clientIpFromHeaders` ห้าม revert กลับ `checkRateLimit` ตรง ๆ ลำดับที่ลดการรื้อ: c7 ก่อน, แล้ว c1+แผนนี้ประกอบกัน (c1 เป็นเจ้าของ route)
- comment ในโค้ดเป็นภาษาไทย; comment ที่อธิบายการตัดสินใจไม่ชัดเจนขึ้นต้นด้วย `§`; **ห้ามลบ `§` comment เดิม** (โดยเฉพาะใน `intake.ts`: dedup key, reveal policy, LIFF consent, ลูปเลขติดตาม, ตัวตนผูกกับ CID)
- ข้อความ error ที่ผู้ใช้เห็นต้องคงเดิมทุกตัวอักษร: `'เกิดข้อผิดพลาดในการสร้างผู้ใช้'`, `'เกิดข้อผิดพลาดในการอัปเดต'`, `'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน'`, `'ไม่พบ FAQ'`, `'ไม่สามารถสร้างผู้ใช้งานได้'`, `'ไม่สามารถออกเลขติดตามได้ กรุณาลองใหม่'`, `'หมวดหมู่ไม่ถูกต้อง'`, `'คุณเคยแจ้งเรื่องนี้ไปแล้วภายใน 7 วัน'`
- ห้ามเปลี่ยน signature `createCase(input: CaseIntakeInput): Promise<CaseIntakeResult>` และ type `CaseIntakeResult`; caller 3 จุด (`src/app/api/cases/submit/route.ts:47`, `:99`, `src/lib/line/bot/case-flow.ts:173`) ห้ามแก้
- ห้ามแตะ `src/lib/cases/operations.ts` (เป็นแบบอย่างและมี plan `case-update-race` แก้อยู่)
- ตาราง DB ไม่มี FK จริง (`auditLogs.userId`, `consentRecords.userId` เป็น text ธรรมดา) จึงบังคับให้ audit insert ล้มด้วย FK ไม่ได้ — integration test ทุกตัวบังคับความล้มด้วย `vi.mock('@/lib/audit')` แบบ passthrough ที่ throw ได้ตามสั่ง แล้วตรวจแถวใน Postgres จริง
- integration test ต้องมี Docker: `docker compose up -d postgres redis up-redis` + `npx drizzle-kit push` + seed category (`npx tsx scripts/seed.ts`) และ `.env.local` (โหลดผ่าน `vitest.setup.ts`)
- commit แบบ conventional commits (`refactor(audit): …`, `test(audit): …`) — **plan นี้ไม่ได้สั่ง push/PR**; ขั้น commit ทำได้เมื่อผู้ใช้อนุญาต

---

## สำรวจ `logAudit` — 47 แถวในตาราง คือ 47 จุดเรียก ไม่ใช่ 36 ฟังก์ชัน

หัวข้อเดิม "36 ฟังก์ชัน (47 จุดเรียก)" คลาด นับใหม่บน working tree (ไม่นับ test, ไม่นับนิยามใน `src/lib/audit.ts`):

```powershell
# PowerShell
(Select-String -Path src\app\*.ts,src\app\**\*.ts,src\lib\*.ts,src\lib\**\*.ts -Pattern 'logAudit\(' |
  Where-Object { $_.Path -notmatch '\\audit\.ts$' -and $_.Path -notmatch '\.test\.ts$' }).Count
```

```bash
# bash — เทียบเท่า
grep -rn "logAudit(" src --include=*.ts | grep -v '\.test\.ts' | grep -v 'src/lib/audit.ts'
```

ผล ณ ตรวจแผน (2026-10-04): **47 จุดเรียก** ใน 25 ไฟล์ (ไม่นับนิยาม `logAudit` ใน `src/lib/audit.ts` ซึ่งทำให้ grep ดิบได้ 48) ตารางด้านล่างมี 47 แถว = 47 จุดเรียก กระจายในฟังก์ชันน้อยกว่า 47 เพราะบางฟังก์ชันเรียกมากกว่า 1 ครั้ง (`login` 3, `requestPasswordReset` 3, `completePasswordReset` 3, withdraw `POST` 4) เลขบรรทัดอิง main ณ `d885ab4` — drift ได้ เปิดไฟล์จริงก่อน implement

หมวด B/D ต้อง re-validate หลัง c1/c5 merge (c5 ลบ `setChatSetting`/`invalidateIntentCache`, c1 ลบ `linkLineIdentity`) ก่อนเปิด issue follow-up

หมวด:
- **A — ทำใน plan นี้**: เปลี่ยนสถานะ + audit, ใส่ tx ได้ตรง ๆ
- **B — ควรเป็น tx, follow-up**: เปลี่ยนสถานะ + audit แบบเดียวกับ A แต่อยู่นอกขอบเขตการ์ด c6 (เปิด issue แยก)
- **C — ปล่อยไว้**: audit อย่างเดียว (event / denial / view) ไม่มีการเขียนข้อมูลธุรกิจคู่กัน
- **D — tx ไม่ช่วย**: การเปลี่ยนแปลงหลักอยู่นอก Postgres (S3, LINE API, อีเมล) หรือใช้ pattern catch-แล้ว-retry ที่ tx ของ Postgres ไม่รองรับ (statement ที่ล้มทำให้ทั้ง tx abort)

| # | จุดเรียก | ฟังก์ชัน | action | หมวด | หมายเหตุ |
|---|---|---|---|---|---|
| 1 | `src/lib/cases/intake.ts:156` | `createCase` | `SUBMIT_CASE` | **A** | users/consent/cases/dedup/audit — Task 1 |
| 2 | `src/app/api/consent/withdraw/route.ts:106` | `POST` (LIFF) | `CONSENT_WITHDRAWN` | **A** | คู่กับ `revokeConsent` `:100` — Task 2 |
| 3 | `src/app/api/consent/withdraw/route.ts:175` | `POST` (web) | `CONSENT_WITHDRAWN` | **A** | คู่กับ `revokeConsent` `:169` — Task 2 |
| 4 | `src/app/admin/actions/users.ts:83` | `createUser` | `CREATE_USER` | **A** | Task 3 |
| 5 | `src/app/admin/actions/users.ts:143` | `toggleUserActive` | `ACTIVATE_USER`/`DEACTIVATE_USER` | **A** | Task 3 |
| 6 | `src/app/admin/actions/users.ts:207` | `updateUserRole` | `UPDATE_USER_ROLE` | **A** | Task 3 |
| 7 | `src/app/admin/actions/users.ts:265` | `resetPassword` | `RESET_USER_PASSWORD` | **A** | Task 3 |
| 8 | `src/app/api/line/admin/faq/[id]/route.ts:52` | `PATCH` | `FAQ_UPDATE` | **A** | Task 4 |
| 9 | `src/app/api/line/admin/faq/[id]/route.ts:82` | `DELETE` | `FAQ_DELETE` | **A** | Task 4 (soft delete) |
| 10 | `src/lib/cases/operations.ts:98` | `applyCaseUpdate` | `UPDATE_CASE_*` ฯลฯ | ✓ | อยู่ใน tx แล้ว — แบบอย่าง |
| 11 | `src/app/admin/actions/master-data.ts:84` | `saveDepartment` | `DEPARTMENT_CREATE/UPDATE` | B | |
| 12 | `src/app/admin/actions/master-data.ts:171` | `saveCategory` | `CATEGORY_CREATE/UPDATE` | B | |
| 13 | `src/app/admin/actions/master-data.ts:210` | `toggleActive` | `*_ACTIVATE/DEACTIVATE` | B | |
| 14 | `src/app/admin/actions/profile.ts:57` | `updateProfile` | `PROFILE_UPDATE` | B | |
| 15 | `src/app/admin/actions/profile.ts:132` | `changeOwnPassword` | `PASSWORD_CHANGE` | B | |
| 16 | `src/app/admin/actions/reset.ts:206` | `completePasswordReset` | `PASSWORD_RESET_SUCCESS` | B | ต้องให้ `consumeResetToken` (`src/lib/auth/reset-token.ts:85`) รับ `db?` ก่อน — ลำดับสำคัญสูงสุดใน B (token ต้องถูกเผาพร้อมรหัสใหม่) |
| 17 | `src/app/api/line/admin/broadcasts/route.ts:62` | `POST` | `BROADCAST_CREATE` | B | |
| 18 | `src/app/api/line/admin/faq/route.ts:80` | `POST` | `FAQ_CREATE` | B | |
| 19 | `src/app/api/line/admin/intents/route.ts:106` | `POST` | `INTENT_CREATE` | B | หลาย insert + `invalidateIntentCache` ต้องอยู่หลัง commit — **re-validate หลัง c5** (c5 ลบ `invalidateIntentCache`) |
| 20 | `src/app/api/line/admin/intents/[id]/route.ts:100` | `PATCH` | `INTENT_UPDATE` | B | delete+insert keywords/responses ไม่มี tx เลย |
| 21 | `src/app/api/line/admin/intents/[id]/route.ts:125` | `DELETE` | `INTENT_DELETE` | B | |
| 22 | `src/app/api/line/admin/reply-objects/route.ts:67` | `POST` | `REPLY_OBJECT_CREATE` | B | |
| 23 | `src/app/api/line/admin/reply-objects/[id]/route.ts:52` | `PATCH` | `REPLY_OBJECT_UPDATE` | B | |
| 24 | `src/app/api/line/admin/reply-objects/[id]/route.ts:99` | `DELETE` | `REPLY_OBJECT_DELETE` | B | |
| 25 | `src/app/api/line/admin/rich-menus/route.ts:64` | `POST` | `RICH_MENU_CREATE` | B | |
| 26 | `src/app/api/line/admin/settings/route.ts:72` | `PUT` | `CHATBOT_SETTINGS_UPDATE` | B | ต้องให้ `setChatSetting` รับ `db?` + `invalidateSettingsCache` หลัง commit — **re-validate หลัง c5** (c5 ลบ `setChatSetting` / ย้าย cache) |
| 27 | `src/app/admin/actions/reset.ts:106` | `requestPasswordReset` | `PASSWORD_RESET_REQUESTED` | D | ส่งอีเมลจริงคั่นกลาง — ยกเลิกอีเมลที่ส่งไปแล้วไม่ได้ |
| 28 | `src/app/api/liff/session/route.ts:134` | `POST` | `LIFF_LOGIN` | D | เดิม `linkLineIdentity` ใช้ catch-แล้ว-select — **re-validate หลัง c1** (c1 ลบ `linkLineIdentity`; identity ใช้ ON CONFLICT ในคำสั่งเดียวกัน ไม่ใช่ savepoint) |
| 29 | `src/app/api/line/admin/broadcasts/[id]/send/route.ts:33` | `POST` | `BROADCAST_SEND` | D | push ไป LINE แล้ว |
| 30 | `src/app/api/line/admin/media/route.ts:99` | `POST` | `MEDIA_UPLOAD` | D | อัปโหลด S3 แล้ว |
| 31 | `src/app/api/line/admin/media/[id]/route.ts:29` | `DELETE` | `MEDIA_DELETE` | D | ลบ S3 แล้ว |
| 32 | `src/app/api/line/admin/rich-menus/[id]/publish/route.ts:23` | `POST` | `RICH_MENU_PUBLISH` | D | เรียก LINE API |
| 33 | `src/app/api/line/admin/rich-menus/[id]/sync/route.ts:23` | `POST` | `RICH_MENU_SYNC` | D | เรียก LINE API |
| 34 | `src/app/admin/actions.ts:77` | `login` | `LOGIN_FAILURE` | C | |
| 35 | `src/app/admin/actions.ts:101` | `login` | `ACCESS_DENIED` | C | |
| 36 | `src/app/admin/actions.ts:118` | `login` | `LOGIN_SUCCESS` | C | session อยู่ใน cookie ไม่ใช่ DB |
| 37 | `src/app/admin/actions.ts:138` | `logout` | `LOGOUT` | C | |
| 38 | `src/app/admin/actions/profile.ts:113` | `changeOwnPassword` | `PASSWORD_CHANGE_FAILURE` | C | |
| 39 | `src/app/admin/actions/reset.ts:116` | `requestPasswordReset` | `PASSWORD_RESET_FAILURE` | C | |
| 40 | `src/app/admin/actions/reset.ts:127` | `requestPasswordReset` | `PASSWORD_RESET_REQUESTED` (ไม่ eligible) | C | |
| 41 | `src/app/admin/actions/reset.ts:164` | `completePasswordReset` | `PASSWORD_RESET_FAILURE` | C | |
| 42 | `src/app/admin/actions/reset.ts:185` | `completePasswordReset` | `PASSWORD_RESET_FAILURE` | C | |
| 43 | `src/app/api/cases/[id]/route.ts:82` | `GET` | `VIEW_CASE` | C | read-only view audit |
| 44 | `src/app/api/consent/withdraw/route.ts:89` | `POST` (LIFF) | `CONSENT_WITHDRAW_DENIED` | C | |
| 45 | `src/app/api/consent/withdraw/route.ts:157` | `POST` (web) | `CONSENT_WITHDRAW_DENIED` | C | |
| 46 | `src/lib/auth/require-staff.ts:69` | `resolveStaff` | `ACCESS_DENIED` | C | |
| 47 | `src/lib/auth/require-staff.ts:82` | `resolveStaff` | `ACCESS_DENIED` | C | |

สรุปจุดเรียก: A = 9, ✓ = 1, B = 16, D = 7, C = 14 (รวม 47 จุดเรียก) ห้ามเรียกตารางนี้ว่า "36 ฟังก์ชัน"

---

## File Structure

| ไฟล์ | การเปลี่ยนแปลง | ความรับผิดชอบ |
|---|---|---|
| `src/lib/consent.ts` | Modify `:6`, `:34`, `:53-59`; เพิ่ม `revokeConsentWithAudit` ท้ายไฟล์ (ไม่เปิด tx เอง) | helper revoke+audit ที่ c1 เรียกภายใน tx ของ `withdrawCaseConsent` |
| `src/lib/dedup.ts` | Modify `:6`, `:46-52` | `recordDedupHash` รับ tx ได้ |
| `src/lib/cases/intake.ts` | Modify `:1-2`, `:41-167`, `:169-171` (ถ้า c1 merge แล้ว ช่วงนี้คือ `resolveCitizen` + `recordIntakeConsent` ไม่ใช่ `resolveSubmitter`) | createCase เขียนทั้งหมดใน tx เดียว |
| `src/lib/cases/intake.test.ts` | Modify `:106-109` | mock db รองรับ `transaction` |
| `src/lib/cases/intake.integration.test.ts` | Create (เจ้าของไฟล์ — c1 ต่อท้าย consent/visibility ห้ามสร้างซ้ำ) | rollback รวม `channel=line` + cleanup ที่ไม่พึ่งผลสำเร็จ |
| `src/lib/consent.integration.test.ts` | Create | พิสูจน์ `revokeConsentWithAudit` atomic เมื่อผู้เรียกเปิด tx |
| `src/app/api/consent/withdraw/route.ts` | ไม่แก้ถ้า c1 merge แล้ว (c1 เขียนทั้งไฟล์เรียก `withdrawCaseConsent`) — แก้เฉพาะ baseline ก่อน c1 และต้องคง `enforceRateLimit` ของ c7 | route ไม่จับคู่ revoke+audit เอง |
| `src/app/admin/actions/users.ts` | Modify `:72-95`, `:137-155`, `:201-225`, `:258-277` | update+audit ใน tx |
| `src/app/admin/actions/users.integration.test.ts` | Create | พิสูจน์ rollback ของ server action |
| `src/app/api/line/admin/faq/[id]/route.ts` | Modify `:47-60`, `:80-89` ใช้ `result.data` ภายใน tx (ชื่อตัวแปรของ c8) | update+audit ใน tx |
| `src/app/api/line/admin/faq/[id]/route.integration.test.ts` | Create | พิสูจน์ rollback ของ route |

---

### Task 0: เตรียม branch และ baseline

**Files:** ไม่มี

**Interfaces:**
- Consumes: ไม่มี
- Produces: branch `refactor/audited-writes` จาก `main` ล่าสุด, Docker stack พร้อม

- [ ] **Step 1: แตก branch**

working tree ปัจจุบันมีไฟล์ untracked/modified ที่ไม่เกี่ยวข้อง (`.gitignore`, `AGENTS.md`, `next-env.d.ts`, `.claude/…`, `.gemini/`, `GEMINI.md`, `opencode.json` ฯลฯ) — ถ้า checkout ปฏิเสธ ให้ `git stash push -u -m "pre-audited-writes"` ก่อน แล้ว `git stash pop` หลังจบงาน (ห้าม commit ไฟล์เหล่านั้นลง branch นี้)

```bash
git checkout main && git pull && git checkout -b refactor/audited-writes
```

Expected: `Switched to a new branch 'refactor/audited-writes'`

- [ ] **Step 2: ตรวจว่าต้อง rebase ตาม plan citizen-case-access หรือไม่**

```bash
git log --oneline -5 -- src/lib/cases/intake.ts src/app/api/consent/withdraw/route.ts
```

Expected: commit ล่าสุดของสองไฟล์นี้ไม่ใช่ของ citizen-case-access — ถ้าเป็น ให้ทำตาม Global Constraints (อ่านไฟล์ใหม่ ปรับ snippet ก่อนลงมือ)

- [ ] **Step 3: ยก stack และรัน baseline**

```bash
docker compose up -d postgres redis up-redis
npx drizzle-kit push
npx tsx scripts/seed.ts
npx vitest run src/lib/cases/intake.test.ts src/lib/cases/operations.integration.test.ts src/app/api/cases/submit/route.integration.test.ts
```

Expected: ทุก test PASS — ถ้าไม่ผ่าน หยุดและแก้ environment ก่อน (Docker ไม่รัน / `.env.local` ไม่มี `DATABASE_URL` / ไม่มี category)

---

### Task 1: `createCase` เขียนทั้ง 5 ตารางใน transaction เดียว

**Files:**
- Modify: `src/lib/consent.ts:6`, `:34`, `:53-59`
- Modify: `src/lib/dedup.ts:6`, `:46-52`
- Modify: `src/lib/cases/intake.ts:1-2`, `:41-167`, `:169-171`
- Modify: `src/lib/cases/intake.test.ts:106-109`
- Test (create): `src/lib/cases/intake.integration.test.ts`

**Interfaces:**
- Consumes: `logAudit(entry: AuditLogEntry, db?: DbOrTx): Promise<void>` (`src/lib/audit.ts`); `type Tx`, `type DbOrTx` (`src/lib/db/index.ts:46-47`); `generateCidHash(cid: string): string`, `generateDedupHash(cid: string, title: string, description: string): string` (`src/lib/cid-hmac.ts`)
- Produces:
  - `grantConsent(grant: ConsentGrant, db?: DbOrTx): Promise<void>`
  - `revokeConsent(userId: string, consentType: ConsentType, metadata?: Record<string, unknown>, db?: DbOrTx): Promise<void>`
  - `recordDedupHash(cid: string, title: string, description: string, caseId: string, db?: DbOrTx): Promise<void>`
  - `createCase(input: CaseIntakeInput): Promise<CaseIntakeResult>` — signature เดิม แต่ถ้าการเขียนใดล้ม (รวม audit) จะ throw และไม่มีแถวใดถูกเขียน

- [ ] **Step 1: เขียน integration test ที่ล้มกับโค้ดปัจจุบัน**

สร้าง `src/lib/cases/intake.integration.test.ts` (แผนนี้เป็นเจ้าของไฟล์ — c1 ห้ามสร้างซ้ำ):

```ts
import { eq, inArray, or } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Integration test — ต้องมี local Postgres (`docker compose up -d postgres redis up-redis`)
 * พิสูจน์ว่า createCase เขียน users / consent_records / cases / dedup_hashes / audit_logs
 * แบบ all-or-nothing
 *
 * § บังคับ audit ล้มด้วย mock แบบ passthrough — ตารางไม่มี FK จริงจึงทำให้ insert
 * ล้มด้วยข้อมูลไม่ได้ ตัว mock เรียก logAudit ของจริงเสมอ ยกเว้นตอนสั่ง failNext
 */
const auditControl = vi.hoisted(() => ({ failNext: false }));

vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>();
  return {
    ...actual,
    logAudit: vi.fn(async (...args: Parameters<typeof actual.logAudit>) => {
      if (auditControl.failNext) {
        auditControl.failNext = false;
        throw new Error('audit insert failed (forced)');
      }
      return actual.logAudit(...args);
    }),
  };
});

import { closeDb, getDb } from '@/lib/db';
import { auditLogs, cases, categories, consentRecords, dedupHashes, lineUsers, users } from '@/lib/db/schema';
import { generateCidHash, generateDedupHash } from '@/lib/cid-hmac';
import { generateId } from '@/lib/id';
import { createCase } from './intake';

// CID ต่อรอบรัน (13 หลัก) — createCase ไม่ตรวจ checksum จึงใช้เลขสุ่มได้
const RUN = Date.now().toString().slice(-9);
const cidFor = (n: number) => `99${n}${RUN}`.slice(0, 13).padEnd(13, '0');
const cidEmail = (cid: string) => `cid-${generateCidHash(cid)}@placeholder.local`;

const createdCaseIds: string[] = [];
const createdEmails: string[] = [];
const LINE_NEW = `U-it-aw-new-${RUN}`;
const LINE_EXISTING = `U-it-aw-old-${RUN}`;
let categoryId: string;

/** ลบของ fixture นี้แม้ฟังก์ชัน throw ก่อน push id — ไม่พึ่งผลสำเร็จ (C6-03) */
async function cleanupFixture(): Promise<void> {
  const db = await getDb();
  const titles = [
    `ทดสอบ rollback ผู้แจ้งใหม่ ${RUN}`,
    `ทดสอบ rollback ผู้แจ้งเดิม ${RUN}`,
    `ทดสอบ commit ครบ ${RUN}`,
    `ทดสอบ rollback line ใหม่ ${RUN}`,
    `ทดสอบ rollback line มีแถว ${RUN}`,
  ];
  const leaked = await db.select({ id: cases.id }).from(cases).where(inArray(cases.title, titles));
  const caseIds = [...new Set([...createdCaseIds, ...leaked.map((r) => r.id)])];
  if (caseIds.length > 0) {
    await db.delete(auditLogs).where(inArray(auditLogs.resourceId, caseIds));
    await db.delete(dedupHashes).where(inArray(dedupHashes.caseId, caseIds));
    await db.delete(cases).where(inArray(cases.id, caseIds));
  }
  await db.delete(lineUsers).where(inArray(lineUsers.lineUserId, [LINE_NEW, LINE_EXISTING]));
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        inArray(users.email, createdEmails),
        eq(users.email, `line-${LINE_NEW}@placeholder.local`),
        eq(users.email, `line-${LINE_EXISTING}@placeholder.local`),
      ),
    );
  const userIds = userRows.map((u) => u.id);
  if (userIds.length > 0) {
    await db.delete(consentRecords).where(inArray(consentRecords.userId, userIds));
    await db.delete(auditLogs).where(inArray(auditLogs.userId, userIds));
    await db.delete(users).where(inArray(users.id, userIds));
  }
}

beforeAll(async () => {
  const db = await getDb();
  const [category] = await db.select().from(categories).limit(1);
  if (!category) throw new Error('ไม่มี category ใน DB — รัน `npx tsx scripts/seed.ts` ก่อน');
  categoryId = category.id;
});

beforeEach(() => {
  auditControl.failNext = false;
});

afterAll(async () => {
  await cleanupFixture();
  await closeDb();
});

function webInput(cid: string, title: string) {
  return {
    channel: 'web' as const,
    title,
    description: `รายละเอียด ${title}`,
    categoryId,
    cid,
    fullName: 'ทดสอบ ธุรกรรม',
  };
}

describe('createCase · atomic (integration)', () => {
  test('audit ล้ม (ผู้แจ้งใหม่) → ไม่มี users / cases / dedup_hashes ค้าง', async () => {
    const cid = cidFor(1);
    const input = webInput(cid, `ทดสอบ rollback ผู้แจ้งใหม่ ${RUN}`);
    createdEmails.push(cidEmail(cid));
    auditControl.failNext = true;

    await expect(createCase(input)).rejects.toThrow('audit insert failed (forced)');

    const db = await getDb();
    expect(await db.select().from(cases).where(eq(cases.title, input.title))).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.email, cidEmail(cid)))).toHaveLength(0);
    const hash = generateDedupHash(cid, input.title, input.description);
    expect(await db.select().from(dedupHashes).where(eq(dedupHashes.hash, hash))).toHaveLength(0);
  });

  test('audit ล้ม (ผู้แจ้งเดิม) → ไม่มี consent_records ใหม่และไม่มีเรื่อง', async () => {
    const cid = cidFor(2);
    const db = await getDb();
    const existingUserId = generateId();
    await db.insert(users).values({
      id: existingUserId,
      email: cidEmail(cid),
      role: 'citizen',
      isActive: true,
      fullName: 'ผู้แจ้งเดิม',
    });
    createdEmails.push(cidEmail(cid));
    const input = webInput(cid, `ทดสอบ rollback ผู้แจ้งเดิม ${RUN}`);
    auditControl.failNext = true;

    await expect(createCase(input)).rejects.toThrow('audit insert failed (forced)');

    expect(
      await db.select().from(consentRecords).where(eq(consentRecords.userId, existingUserId)),
    ).toHaveLength(0);
    expect(await db.select().from(cases).where(eq(cases.submittedBy, existingUserId))).toHaveLength(0);
  });

  test('สำเร็จ → เขียนครบทั้ง 5 ตาราง', async () => {
    const cid = cidFor(3);
    const input = webInput(cid, `ทดสอบ commit ครบ ${RUN}`);
    createdEmails.push(cidEmail(cid));

    const result = await createCase(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdCaseIds.push(result.caseId);

    const db = await getDb();
    const [user] = await db.select().from(users).where(eq(users.email, cidEmail(cid)));
    expect(user).toBeDefined();
    const [caseRow] = await db.select().from(cases).where(eq(cases.id, result.caseId));
    expect(caseRow?.submittedBy).toBe(user?.id);
    expect(
      await db.select().from(consentRecords).where(eq(consentRecords.userId, user!.id)),
    ).toHaveLength(1);
    expect(
      await db.select().from(dedupHashes).where(eq(dedupHashes.caseId, result.caseId)),
    ).toHaveLength(1);
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, result.caseId));
    expect(audits.map((a) => a.action)).toEqual(['submit_case']);
  });

  test('audit ล้ม (channel=line, ยังไม่มี line_users) → linkedUserId ไม่ค้าง และไม่มี users', async () => {
    auditControl.failNext = true;
    await expect(
      createCase({
        channel: 'line',
        lineUserId: LINE_NEW,
        categoryId,
        title: `ทดสอบ rollback line ใหม่ ${RUN}`,
        description: 'รายละเอียด line',
        location: 'ทดสอบ',
      }),
    ).rejects.toThrow('audit insert failed (forced)');

    const db = await getDb();
    expect(await db.select().from(lineUsers).where(eq(lineUsers.lineUserId, LINE_NEW))).toHaveLength(0);
    expect(await db.select().from(users).where(eq(users.email, `line-${LINE_NEW}@placeholder.local`))).toHaveLength(0);
  });

  test('audit ล้ม (channel=line, มี line_users แล้ว) → linkedUserId ไม่ถูกเขียนค้าง', async () => {
    const db = await getDb();
    await db.insert(lineUsers).values({
      id: generateId(),
      lineUserId: LINE_EXISTING,
      linkedUserId: null,
    });
    auditControl.failNext = true;

    await expect(
      createCase({
        channel: 'line',
        lineUserId: LINE_EXISTING,
        categoryId,
        title: `ทดสอบ rollback line มีแถว ${RUN}`,
        description: 'รายละเอียด line',
        location: 'ทดสอบ',
      }),
    ).rejects.toThrow('audit insert failed (forced)');

    const [row] = await db.select().from(lineUsers).where(eq(lineUsers.lineUserId, LINE_EXISTING));
    expect(row?.linkedUserId ?? null).toBeNull();
  });
});
```

ไฟล์นี้เป็นของแผนนี้ c1 ต่อท้าย describe consent/visibility ห้ามให้ c1 สร้างไฟล์ทับ ตอน rebase รวม describe ของ c1 เข้ามา cleanup ของ c1 ต้องใช้ namespace/title/owner ของ fixture ตัวเองด้วย (กติกาเดียวกับ `cleanupFixture`)

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run src/lib/cases/intake.integration.test.ts`
Expected: FAIL — rollback web 2 tests + rollback line 2 tests (แถวค้างเพราะยังไม่มี tx); test `สำเร็จ` PASS

- [ ] **Step 3: ขยาย type ของ consent.ts และ dedup.ts ให้รับ tx**

`src/lib/consent.ts:6` เปลี่ยน
```ts
import { getDb, type Db } from './db';
```
เป็น
```ts
import { getDb, type DbOrTx } from './db';
```
แล้วแทน `db?: Db` เป็น `db?: DbOrTx` ทุกจุดในไฟล์ (`grantConsent :34`, `revokeConsent :57`, `hasConsent :78`, `getConsentHistory :97`)

`src/lib/dedup.ts:6` เปลี่ยน
```ts
import { getDb, type Db } from './db';
```
เป็น
```ts
import { getDb, type DbOrTx } from './db';
```
แล้วแทน `db?: Db` เป็น `db?: DbOrTx` ทุกจุดในไฟล์ (`checkDuplicate :21`, `recordDedupHash :51`, `cleanupExpiredHashes :66`)

Run: `npx tsc --noEmit`
Expected: ไม่มี error (union กว้างขึ้น caller เดิมทุกตัวยัง compile)

- [ ] **Step 4: เขียน createCase ใหม่ให้การเขียนทั้งหมดอยู่ใน tx**

`src/lib/cases/intake.ts:1-2` เปลี่ยน
```ts
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
```
เป็น
```ts
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
```
(ไม่ต้อง import `Tx` — `resolveSubmitter` ถูกลบโดย c1; ถ้า c1 ยังไม่ merge ให้ลบ `resolveSubmitter` ตามแผน c1 ก่อน ห้ามเก็บ catch-unique-แล้ว-select ไว้ใน tx)

import ของ citizen-access ต้องมี `recordIntakeConsent`, `resolveCitizen`, `CitizenIdentity`, `IntakeConsentVia` (แผน c1 Task 3)

แทนช่วงตั้งแต่ `const submitterId = await resolveSubmitter(db, input);` (หรือ `resolveCitizen` นอก tx ถ้า c1 merge แล้ว) จนถึง `return { ok: true, caseId, trackingCode, estimatedDays };` ด้วย:

```ts
  const caseId = generateId();
  const fiscalYear = getFiscalYear(new Date());
  const estimatedDays = category.estimatedDays || 7;
  const dueDate = new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000);

  // § ตรวจทุกรหัสที่สุ่มได้ก่อนใช้ — เดิมวนสุ่มใหม่ตอนชนแล้วออกจากลูปโดยไม่ได้ตรวจ
  // ตัวสุดท้าย ทำให้รหัสที่ไม่เคยผ่านการตรวจหลุดไปถึง insert แล้วพังที่ unique index
  //
  // § ออกเลขติดตามก่อนเปิด transaction — เป็นการอ่านล้วน และถ้าออกเลขไม่ได้จะได้
  // ไม่ต้องสร้างผู้ใช้/consent ทิ้งไว้ (เดิมสร้าง user ก่อนแล้วค่อยออกเลข)
  let trackingCode: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateTrackingCode();
    const collision = await firstOrUndefined(
      db.select({ id: cases.id }).from(cases).where(eq(cases.trackingCode, candidate)).limit(1)
    );
    if (!collision) {
      trackingCode = candidate;
      break;
    }
  }
  if (!trackingCode) {
    return { ok: false, error: 'ไม่สามารถออกเลขติดตามได้ กรุณาลองใหม่', errorCode: 'internal' };
  }
  const issuedTrackingCode = trackingCode;

  // § การเขียนทั้ง 5 อย่างของ "แจ้งเรื่องใหม่" (ผู้แจ้ง, ความยินยอม, เรื่อง, dedup hash,
  // audit) อยู่ใน transaction เดียว — เดิมเป็น statement แยกกัน ถ้าตัวหลังล้ม (เช่น audit)
  // จะเหลือ user/consent/เรื่องที่ไม่มี audit หรือเรื่องที่ไม่มี dedup hash ค้างอยู่
  // ล้มที่ไหน rollback ทั้งก้อนแล้ว throw ต่อให้ caller (route ตอบ 500 เหมือนเดิม)
  // แบบอย่างเดียวกับ applyCaseUpdate ใน ./operations.ts
  //
  // § เรียก resolveCitizen / recordIntakeConsent ของ citizen-access ด้วย tx ตัวเดียวกัน
  // identity ใช้ INSERT ... ON CONFLICT ... RETURNING แล้ว SELECT (แผน c1 Task 1)
  // ห้าม catch unique แล้ว select — statement error ทำให้ tx นี้ abort
  const identity = citizenIdentityOf(input);
  if (!identity) {
    return { ok: false, error: 'ไม่สามารถสร้างผู้ใช้งานได้', errorCode: 'internal' };
  }

  const submitterId = await db.transaction(async (tx) => {
    const resolvedSubmitterId = await resolveCitizen(identity, tx);

    // § ทุกช่องทางบันทึกความยินยอมตอนแจ้ง (รวมบอท) — อยู่ใน tx เดียวกับเรื่อง
    await recordIntakeConsent(
      resolvedSubmitterId,
      intakeConsentVia(input),
      { ipAddress: input.ipAddress, userAgent: input.userAgent },
      tx,
    );

    await tx.insert(cases).values({
      id: caseId,
      status: 'pending',
      priority: 'normal',
      title: input.title,
      description: input.description,
      location: input.location ?? '',
      provinceId: input.provinceId ?? null,
      districtId: input.districtId ?? null,
      subDistrictId: input.subDistrictId ?? null,
      villageId: input.villageId ?? null,
      village: input.village || null,
      categoryId: input.categoryId,
      submittedBy: resolvedSubmitterId,
      departmentId: category.defaultDepartmentId || null,
      dueDate,
      attachments: input.attachments ? JSON.stringify(input.attachments) : null,
      metadata: JSON.stringify({
        fiscalYear,
        source: input.channel,
        ...(input.origin === 'liff' ? { origin: 'liff' } : {}),
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      }),
      trackingCode: issuedTrackingCode,
    });

    if (dedupKey) {
      await recordDedupHash(dedupKey, input.title, input.description, caseId, tx);
    }

    await logAudit(
      {
        userId: resolvedSubmitterId,
        action: AUDIT_ACTIONS.SUBMIT_CASE,
        resource: 'cases',
        resourceId: caseId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        metadata: { categoryId: input.categoryId, fiscalYear, channel: input.channel },
      },
      tx,
    );

    return resolvedSubmitterId;
  });

  if (!submitterId) {
    return { ok: false, error: 'ไม่สามารถสร้างผู้ใช้งานได้', errorCode: 'internal' };
  }

  return { ok: true, caseId, trackingCode: issuedTrackingCode, estimatedDays };
```

ลบ `resolveSubmitter` ทั้งฟังก์ชัน (c1 ย้ายไป `resolveCitizen`) ถ้ายังเหลืออยู่ แล้วต่อท้ายไฟล์ด้วย `citizenIdentityOf` + `intakeConsentVia` ตามแผน c1 Task 2–3 (copy snippet จากแผนนั้นให้ตรงกัน ห้ามเขียนคนละแบบ):

```ts
function citizenIdentityOf(input: CaseIntakeInput): CitizenIdentity | null {
  if (input.channel === 'line') {
    return input.lineUserId
      ? { kind: 'line', lineUserId: input.lineUserId, fullName: input.fullName, source: 'line_intake' }
      : null;
  }
  return input.cid
    ? {
        kind: 'cid',
        cid: input.cid,
        fullName: input.fullName,
        phoneNumber: input.phoneNumber,
        contactEmail: input.email,
      }
    : null;
}

function intakeConsentVia(input: CaseIntakeInput): IntakeConsentVia {
  if (input.channel === 'web') return 'intake_submit';
  return input.origin === 'liff' ? 'liff_submit' : 'line_bot_submit';
}
```

- [ ] **Step 5: ให้ mock db ใน unit test รองรับ `transaction`**

`src/lib/cases/intake.test.ts:106-109` เปลี่ยน
```ts
  const mockDb = {
    select: vi.fn(() => makeSelect()),
    insert: vi.fn((table: unknown) => makeInsert(table)),
  };
```
เป็น
```ts
  const mockDb = {
    select: vi.fn(() => makeSelect()),
    insert: vi.fn((table: unknown) => makeInsert(table)),
    // § createCase เขียนทุกอย่างใน db.transaction — mock ส่ง mockDb ตัวเดิมเป็น tx
    transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockDb)),
  };
```

- [ ] **Step 6: รัน test ทั้ง unit และ integration**

Run: `npx vitest run src/lib/cases/intake.test.ts src/lib/cases/intake.integration.test.ts src/app/api/cases/submit/route.integration.test.ts`
Expected: PASS ทั้งหมด (intake.test.ts 14 tests — ตัวเลขนี้ถูก ห้ามแก้เป็น 10; intake.integration.test.ts 5 tests ของแผนนี้ บวก describe ที่ c1 ต่อท้ายถ้ามีแล้ว; submit route ทุก test เดิม)

Run: `npx tsc --noEmit && npx eslint src/lib/cases src/lib/consent.ts src/lib/dedup.ts`
Expected: ไม่มี error

- [ ] **Step 7: Commit**

```bash
git add src/lib/consent.ts src/lib/dedup.ts src/lib/cases/intake.ts src/lib/cases/intake.test.ts src/lib/cases/intake.integration.test.ts
git commit -m "refactor(intake): เขียน user/consent/case/dedup/audit ของ createCase ใน transaction เดียว"
```

---

### Task 2: `revokeConsentWithAudit` — helper ที่ไม่เปิด tx (c1 เป็นเจ้าของ tx)

**Files:**
- Modify: `src/lib/consent.ts` (เพิ่ม import + `revokeConsentWithAudit` ท้ายไฟล์ — ไม่มี `withdrawConsent` ที่เปิด tx เอง)
- Modify: `src/app/api/consent/withdraw/route.ts` **เฉพาะเมื่อ c1 ยังไม่ merge** ถ้า c1 merge แล้ว route เรียก `withdrawCaseConsent` อยู่แล้ว — ห้ามใส่ `withdrawConsent` กลับ และห้าม revert `enforceRateLimit('consentWithdraw', ip)` ของ c7
- Test (create): `src/lib/consent.integration.test.ts`

**Interfaces:**
- Consumes: `revokeConsent(userId, consentType, metadata?, db?: DbOrTx)` และ `hasConsent(userId, consentType, db?)` จาก Task 1; `logAudit`, `AUDIT_ACTIONS` จาก `src/lib/audit.ts`
- Produces:
  ```ts
  export interface ConsentWithdrawal {
    userId: string;
    caseId: string;
    trackingCode: string;
    via: 'web' | 'liff';
    ipAddress?: string;
    userAgent?: string;
  }
  export async function revokeConsentWithAudit(w: ConsentWithdrawal, tx: DbOrTx): Promise<void>
  ```
  ผู้เรียกเปิด tx เอง (c1: `withdrawCaseConsent`) helper เขียน `consent_records` (isGranted=false, metadata `{ via: 'web_withdraw' | 'liff_withdraw', caseId, trackingCode }`) และ `audit_logs` (`consent_withdrawn`, metadata `{ trackingCode, via }` — web และ liff มี `via` ทั้งคู่ ให้ตรง test ของ c1) **ใน tx ที่รับมา** ห้าม `getDb().transaction` ใน helper (จะซ้อน) ล้ม = throw และผู้เรียก rollback

- [ ] **Step 1: เขียน integration test**

สร้าง `src/lib/consent.integration.test.ts`:

```ts
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Integration test — ต้องมี local Postgres รันอยู่
 * revokeConsentWithAudit ต้องเขียน consent_records + audit_logs แบบ all-or-nothing
 * เมื่อผู้เรียกเปิด transaction — helper เองห้ามเปิด tx
 * (PDPA: audit ของการถอนความยินยอมต้องตรงกับสถานะความยินยอมจริงเสมอ)
 */
const auditControl = vi.hoisted(() => ({ failNext: false }));

vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>();
  return {
    ...actual,
    logAudit: vi.fn(async (...args: Parameters<typeof actual.logAudit>) => {
      if (auditControl.failNext) {
        auditControl.failNext = false;
        throw new Error('audit insert failed (forced)');
      }
      return actual.logAudit(...args);
    }),
  };
});

import { closeDb, getDb } from '@/lib/db';
import { auditLogs, consentRecords, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { hasConsent, revokeConsentWithAudit } from './consent';

let userId: string;
const caseIdRollback = generateId();
const caseIdCommit = generateId();

beforeAll(async () => {
  const db = await getDb();
  userId = generateId();
  await db.insert(users).values({
    id: userId,
    email: `it-consent-withdraw-${userId}@placeholder.local`,
    role: 'citizen',
    isActive: true,
    fullName: 'ทดสอบ ถอนความยินยอม',
  });
});

beforeEach(() => {
  auditControl.failNext = false;
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(auditLogs).where(eq(auditLogs.userId, userId));
  await db.delete(consentRecords).where(eq(consentRecords.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  await closeDb();
});

describe('revokeConsentWithAudit (integration)', () => {
  test('audit ล้ม → ไม่มี consent_records ถูกเขียน', async () => {
    auditControl.failNext = true;
    const db = await getDb();

    await expect(
      db.transaction((tx) =>
        revokeConsentWithAudit(
          { userId, caseId: caseIdRollback, trackingCode: 'HG000000001', via: 'web' },
          tx,
        ),
      ),
    ).rejects.toThrow('audit insert failed (forced)');

    const db = await getDb();
    expect(await db.select().from(consentRecords).where(eq(consentRecords.userId, userId))).toHaveLength(0);
    expect(await db.select().from(auditLogs).where(eq(auditLogs.resourceId, caseIdRollback))).toHaveLength(0);
  });

  test('สำเร็จ (liff) → consent ถูกถอน + audit มี metadata เดิม', async () => {
    const db = await getDb();
    await db.transaction((tx) =>
      revokeConsentWithAudit(
        {
          userId,
          caseId: caseIdCommit,
          trackingCode: 'HG000000002',
          via: 'liff',
          ipAddress: '203.0.113.7',
        },
        tx,
      ),
    );

    expect(await hasConsent(userId, 'data_collection')).toBe(false);
    const db = await getDb();
    const [consent] = await db.select().from(consentRecords).where(eq(consentRecords.userId, userId));
    expect(consent?.isGranted).toBe(false);
    expect(consent?.metadata).toEqual({ via: 'liff_withdraw', caseId: caseIdCommit, trackingCode: 'HG000000002' });

    const [audit] = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, caseIdCommit));
    expect(audit?.action).toBe('consent_withdrawn');
    expect(audit?.ipAddress).toBe('203.0.113.7');
    // logAudit เก็บ metadata เป็น JSON string ใน jsonb (audit.ts:87)
    expect(JSON.parse(String(audit?.metadata))).toEqual({ trackingCode: 'HG000000002', via: 'liff' });
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run src/lib/consent.integration.test.ts`
Expected: FAIL — `revokeConsentWithAudit is not a function` (ยังไม่ได้ export)

- [ ] **Step 3: เพิ่ม `revokeConsentWithAudit` ใน consent.ts (ห้ามมี `withdrawConsent` ที่เปิด tx เอง)**

ใต้บรรทัด `import { eq, and, desc } from 'drizzle-orm';` (`:9`) เพิ่ม:
```ts
import { AUDIT_ACTIONS, logAudit } from './audit';
```

ท้ายไฟล์ `src/lib/consent.ts` เพิ่ม:
```ts
export interface ConsentWithdrawal {
  userId: string;
  caseId: string;
  trackingCode: string;
  via: 'web' | 'liff';
  ipAddress?: string;
  userAgent?: string;
}

/**
 * ถอนความยินยอม data_collection พร้อม audit — ต้องถูกเรียกใน tx ที่ผู้เรียกเปิดไว้
 *
 * § c1 (`withdrawCaseConsent`) เป็นเจ้าของ tx แล้วเรียก helper นี้ข้างใน
 * ห้ามเปิด transaction ในฟังก์ชันนี้ (จะซ้อน) และห้ามมี withdrawConsent ที่เปิด tx เอง
 * เดิม route เรียก revokeConsent แล้วค่อย logAudit แยกกัน ถ้า audit ล้ม ความยินยอมถูกถอน
 * ไปแล้วแต่ไม่มีหลักฐาน — PDPA ต้องการให้ audit ตรงกับสถานะจริงเสมอ
 * metadata audit มี via ทั้ง web และ liff ให้ตรง test ของ citizen-access
 */
export async function revokeConsentWithAudit(w: ConsentWithdrawal, tx: DbOrTx): Promise<void> {
  await revokeConsent(
    w.userId,
    'data_collection',
    {
      via: w.via === 'liff' ? 'liff_withdraw' : 'web_withdraw',
      caseId: w.caseId,
      trackingCode: w.trackingCode,
    },
    tx,
  );

  await logAudit(
    {
      userId: w.userId,
      action: AUDIT_ACTIONS.CONSENT_WITHDRAWN,
      resource: 'consent',
      resourceId: w.caseId,
      ipAddress: w.ipAddress,
      userAgent: w.userAgent,
      metadata: { trackingCode: w.trackingCode, via: w.via },
    },
    tx,
  );
}
```

- [ ] **Step 4: รัน test**

Run: `npx vitest run src/lib/consent.integration.test.ts`
Expected: PASS 2 tests

- [ ] **Step 5: route — ข้ามถ้า c1 merge แล้ว**

c1 เขียน `src/app/api/consent/withdraw/route.ts` ทั้งไฟล์ให้เรียก `withdrawCaseConsent` ซึ่งเปิด tx แล้วเรียก `revokeConsentWithAudit` ข้างใน **อย่าแก้ route ในกรณีนั้น** และอย่าใส่ `withdrawConsent` กลับ

ทำขั้นนี้เฉพาะ baseline ที่ c1 ยังไม่ merge: คงบรรทัด rate limit ของ c7 (`enforceRateLimit('consentWithdraw', ip)` + `clientIpFromHeaders`) ห้าม revert เป็น `checkRateLimit` ตรง ๆ ส่วนคู่ revoke+audit ให้ย้ายเข้า `withdrawCaseConsent` ตามแผน c1 Task 8 ไม่จับคู่ใน route

`logAudit` / `AUDIT_ACTIONS` ยังถูกใช้ที่ `CONSENT_WITHDRAW_DENIED` สองจุดใน route เดิม — ถ้ายังแก้ route อยู่ คง import นั้นไว้

- [ ] **Step 6: ตรวจ compile + lint**

Run: `npx tsc --noEmit && npx eslint src/lib/consent.ts src/app/api/consent/withdraw/route.ts`
Expected: ไม่มี error

- [ ] **Step 7: Commit**

```bash
git add src/lib/consent.ts src/lib/consent.integration.test.ts src/app/api/consent/withdraw/route.ts
git commit -m "refactor(consent): revokeConsentWithAudit ถอนความยินยอม + audit ใน tx ที่ผู้เรียกเปิด"
```

---

### Task 3: server actions จัดการผู้ใช้ — update + audit ใน tx

**Files:**
- Modify: `src/app/admin/actions/users.ts:72-95`, `:137-155`, `:201-225`, `:258-277`
- Test (create): `src/app/admin/actions/users.integration.test.ts`

**Interfaces:**
- Consumes: `logAudit(entry, db?: DbOrTx)`; `requireStaff(allowedRoles?)` คืน `StaffContext = { user, ipAddress, userAgent }` (`src/lib/auth/require-staff.ts:26-30`)
- Produces: signature เดิมทั้ง 4 action (`createUser`, `toggleUserActive`, `updateUserRole`, `resetPassword` — `(prev: UserActionState, formData: FormData) => Promise<UserActionState>`); พฤติกรรมใหม่: audit ล้ม → คืน error เดิม **และ** แถว `users` ไม่เปลี่ยน

- [ ] **Step 1: เขียน integration test**

สร้าง `src/app/admin/actions/users.integration.test.ts`:

```ts
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Integration test — ต้องมี local Postgres รันอยู่
 * พิสูจน์ว่า action จัดการผู้ใช้ไม่ทิ้งการเปลี่ยนแปลงไว้เมื่อ audit ล้ม
 * (เดิม: update commit แล้ว → audit ล้ม → หน้าจอบอก error ทั้งที่ข้อมูลเปลี่ยนแล้ว)
 */
const mocks = vi.hoisted(() => ({
  failNextAudit: false,
  actorId: 'it-users-actor',
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>();
  return {
    ...actual,
    logAudit: vi.fn(async (...args: Parameters<typeof actual.logAudit>) => {
      if (mocks.failNextAudit) {
        mocks.failNextAudit = false;
        throw new Error('audit insert failed (forced)');
      }
      return actual.logAudit(...args);
    }),
  };
});

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaff: vi.fn(async () => ({
    user: { id: mocks.actorId, role: 'superadmin' },
    ipAddress: '127.0.0.1',
    userAgent: undefined,
  })),
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { closeDb, getDb } from '@/lib/db';
import { auditLogs, users } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { createUser, resetPassword, toggleUserActive, updateUserRole } from './users';

const RUN = Date.now();
let targetId: string;
const newUserEmail = `it-users-create-${RUN}@placeholder.local`;

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

async function getTarget() {
  const db = await getDb();
  const [row] = await db.select().from(users).where(eq(users.id, targetId));
  if (!row) throw new Error('target user หาย');
  return row;
}

beforeAll(async () => {
  const db = await getDb();
  targetId = generateId();
  await db.insert(users).values({
    id: targetId,
    email: `it-users-target-${RUN}@placeholder.local`,
    role: 'officer',
    isActive: true,
    fullName: 'เจ้าหน้าที่ ทดสอบ',
  });
});

beforeEach(() => {
  mocks.failNextAudit = false;
  mocks.redirect.mockClear();
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(auditLogs).where(eq(auditLogs.resourceId, targetId));
  await db.delete(users).where(inArray(users.email, [newUserEmail]));
  await db.delete(users).where(eq(users.id, targetId));
  await closeDb();
});

describe('users actions · audit ล้มต้อง rollback', () => {
  test('toggleUserActive', async () => {
    mocks.failNextAudit = true;
    const result = await toggleUserActive({ error: null }, form({ userId: targetId }));

    expect(result).toEqual({ error: 'เกิดข้อผิดพลาดในการอัปเดต' });
    expect((await getTarget()).isActive).toBe(true);
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  test('updateUserRole', async () => {
    mocks.failNextAudit = true;
    const result = await updateUserRole({ error: null }, form({ userId: targetId, role: 'chief' }));

    expect(result).toEqual({ error: 'เกิดข้อผิดพลาดในการอัปเดต' });
    expect((await getTarget()).role).toBe('officer');
  });

  test('resetPassword', async () => {
    mocks.failNextAudit = true;
    const before = (await getTarget()).passwordHash;
    const result = await resetPassword({ error: null }, form({ userId: targetId, newPassword: 'NewPassw0rd!' }));

    expect(result).toEqual({ error: 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน' });
    expect((await getTarget()).passwordHash).toBe(before);
  });

  test('createUser', async () => {
    mocks.failNextAudit = true;
    const result = await createUser(
      { error: null },
      form({ email: newUserEmail, fullName: 'ผู้ใช้ ใหม่', role: 'officer', password: 'Passw0rd!x' }),
    );

    expect(result).toEqual({ error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' });
    const db = await getDb();
    expect(await db.select().from(users).where(eq(users.email, newUserEmail))).toHaveLength(0);
  });
});

describe('users actions · สำเร็จยังทำงานเหมือนเดิม', () => {
  test('toggleUserActive เปลี่ยนสถานะ + audit + redirect', async () => {
    await toggleUserActive({ error: null }, form({ userId: targetId }));

    expect((await getTarget()).isActive).toBe(false);
    expect(mocks.redirect).toHaveBeenCalledWith('/admin/users?ok=toggled');
    const db = await getDb();
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, targetId));
    expect(audits.map((a) => a.action)).toEqual(['deactivate_user']);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run src/app/admin/actions/users.integration.test.ts`
Expected: FAIL 4 tests ใน describe แรก — เช่น `toggleUserActive` ล้มที่ `expected false to be true` (isActive เปลี่ยนไปแล้วแม้ audit ล้ม), `createUser` ล้มที่ length 1; test ใน describe ที่สองอาจล้มตาม (state ถูกสลับไปแล้ว) — รับได้ในขั้นนี้

> ถ้ารันซ้ำหลังล้ม ให้ลบแถวทดสอบค้างก่อน: `RUN` ต่างกันทุกรอบจึงไม่ชนกัน แต่แถว `it-users-*` เก่าจะค้าง — ลบได้ด้วย `npx drizzle-kit studio` หรือรันไฟล์นี้ให้ผ่านหนึ่งครั้ง (afterAll ลบเฉพาะของรอบนั้น)

- [ ] **Step 3: ห่อ update + audit ด้วย tx ทั้ง 4 action**

`createUser` — แทน `:72-95`:
```ts
  try {
    // § insert + audit ใน transaction เดียว — audit ล้ม = ไม่มีบัญชีใหม่ค้างโดยไม่มีบันทึก
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: newUserId,
        email,
        fullName,
        role,
        departmentId: deptValue,
        passwordHash,
        isActive: true,
      });

      await logAudit(
        {
          userId: actor.id,
          action: AUDIT_ACTIONS.CREATE_USER,
          resource: 'users',
          resourceId: newUserId,
          ipAddress,
          userAgent,
          metadata: { email, fullName, role },
        },
        tx,
      );
    });
  } catch (err) {
    console.error('[createUser] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการสร้างผู้ใช้' };
  }
```

`toggleUserActive` — แทน `:137-155`:
```ts
  try {
    // § update + audit ใน transaction เดียว — เดิม audit ล้มหลัง update commit แล้ว
    // หน้าจอบอก "เกิดข้อผิดพลาด" ทั้งที่สถานะบัญชีเปลี่ยนไปแล้ว (กดซ้ำ = สลับกลับ)
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ isActive: newActive, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await logAudit(
        {
          userId: actor.id,
          action: newActive ? AUDIT_ACTIONS.ACTIVATE_USER : AUDIT_ACTIONS.DEACTIVATE_USER,
          resource: 'users',
          resourceId: userId,
          ipAddress,
          userAgent,
          metadata: { fullName: target.fullName, email: target.email, previousState: target.isActive },
        },
        tx,
      );
    });
  } catch (err) {
    console.error('[toggleUserActive] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการอัปเดต' };
  }
```

`updateUserRole` — แทน `:201-225`:
```ts
  try {
    // § update + audit ใน transaction เดียว (เหตุผลเดียวกับ toggleUserActive)
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ role, departmentId: deptValue, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await logAudit(
        {
          userId: actor.id,
          action: AUDIT_ACTIONS.UPDATE_USER_ROLE,
          resource: 'users',
          resourceId: userId,
          ipAddress,
          userAgent,
          metadata: {
            fullName: target.fullName,
            email: target.email,
            previousRole: target.role,
            newRole: role,
            departmentId: deptValue,
          },
        },
        tx,
      );
    });
  } catch (err) {
    console.error('[updateUserRole] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการอัปเดต' };
  }
```

`resetPassword` — แทน `:258-277`:
```ts
  try {
    // § hash นอก transaction — bcrypt ช้า ไม่ควรถือ connection ของ tx ระหว่างรอ
    // แต่ยังอยู่ใน try เดิม เพื่อให้ hash ล้มได้ข้อความ error เดิม
    const passwordHash = await hashPassword(newPassword);
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, userId));

      await logAudit(
        {
          userId: actor.id,
          action: AUDIT_ACTIONS.RESET_USER_PASSWORD,
          resource: 'users',
          resourceId: userId,
          ipAddress,
          userAgent,
          metadata: { fullName: target.fullName, email: target.email },
        },
        tx,
      );
    });
  } catch (err) {
    console.error('[resetPassword] failed', err);
    return { error: 'เกิดข้อผิดพลาดในการรีเซ็ตรหัสผ่าน' };
  }
```

- [ ] **Step 4: รัน test**

Run: `npx vitest run src/app/admin/actions/users.integration.test.ts`
Expected: PASS 5 tests (stderr มี `[toggleUserActive] failed` ฯลฯ จาก console.error — เป็นปกติ)

Run: `npx tsc --noEmit && npx eslint src/app/admin/actions/users.ts src/app/admin/actions/users.integration.test.ts`
Expected: ไม่มี error

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/actions/users.ts src/app/admin/actions/users.integration.test.ts
git commit -m "refactor(users): update + audit ของ action จัดการผู้ใช้ใน transaction เดียว"
```

---

### Task 4: FAQ PATCH/DELETE — update + audit ใน tx

**Files:**
- Modify: `src/app/api/line/admin/faq/[id]/route.ts:47-60`, `:80-89`
- Test (create): `src/app/api/line/admin/faq/[id]/route.integration.test.ts`

**Interfaces:**
- Consumes: `logAudit(entry, db?: DbOrTx)`; `requireStaffApi(allowedRoles?)` คืน `{ ok: true, ctx: StaffContext } | { ok: false, response }`
- Produces: `PATCH`/`DELETE` signature เดิม; audit ล้ม → handler throw (Next ตอบ 500 เหมือนเดิม) และแถว `chat_faq` ไม่เปลี่ยน

- [ ] **Step 1: เขียน integration test**

สร้าง `src/app/api/line/admin/faq/[id]/route.integration.test.ts`:

```ts
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * Integration test — ต้องมี local Postgres รันอยู่
 * แก้/ลบ FAQ ต้อง rollback เมื่อ audit ล้ม (เดิม: FAQ เปลี่ยนแล้วแต่ไม่มี audit + ตอบ 500)
 */
const mocks = vi.hoisted(() => ({ failNextAudit: false }));

vi.mock('@/lib/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit')>();
  return {
    ...actual,
    logAudit: vi.fn(async (...args: Parameters<typeof actual.logAudit>) => {
      if (mocks.failNextAudit) {
        mocks.failNextAudit = false;
        throw new Error('audit insert failed (forced)');
      }
      return actual.logAudit(...args);
    }),
  };
});

vi.mock('@/lib/auth/require-staff', () => ({
  requireStaffApi: vi.fn(async () => ({
    ok: true,
    ctx: { user: { id: 'it-faq-admin' }, ipAddress: '127.0.0.1', userAgent: undefined },
  })),
}));

import { closeDb, getDb } from '@/lib/db';
import { auditLogs, chatFaq } from '@/lib/db/schema';
import { generateId } from '@/lib/id';
import { DELETE, PATCH } from './route';

let faqId: string;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

function patchRequest(body: unknown): Request {
  return new Request(`http://localhost:3000/api/line/admin/faq/${faqId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

async function getFaq() {
  const db = await getDb();
  const [row] = await db.select().from(chatFaq).where(eq(chatFaq.id, faqId));
  if (!row) throw new Error('FAQ ทดสอบหาย');
  return row;
}

beforeAll(async () => {
  const db = await getDb();
  faqId = generateId();
  await db.insert(chatFaq).values({
    id: faqId,
    question: 'คำถามเดิม',
    answer: 'คำตอบเดิม',
    keywords: ['ทดสอบ'],
  });
});

beforeEach(() => {
  mocks.failNextAudit = false;
});

afterAll(async () => {
  const db = await getDb();
  await db.delete(auditLogs).where(eq(auditLogs.resourceId, faqId));
  await db.delete(chatFaq).where(eq(chatFaq.id, faqId));
  await closeDb();
});

describe('FAQ [id] · audit ล้มต้อง rollback', () => {
  test('PATCH', async () => {
    mocks.failNextAudit = true;
    await expect(PATCH(patchRequest({ question: 'คำถามใหม่' }), params(faqId))).rejects.toThrow(
      'audit insert failed (forced)',
    );
    expect((await getFaq()).question).toBe('คำถามเดิม');
  });

  test('DELETE (soft)', async () => {
    mocks.failNextAudit = true;
    await expect(
      DELETE(new Request(`http://localhost:3000/api/line/admin/faq/${faqId}`, { method: 'DELETE' }), params(faqId)),
    ).rejects.toThrow('audit insert failed (forced)');
    expect((await getFaq()).isActive).toBe(true);
  });
});

describe('FAQ [id] · สำเร็จยังทำงานเหมือนเดิม', () => {
  test('PATCH อัปเดต + เขียน audit', async () => {
    const res = await PATCH(patchRequest({ question: 'คำถามใหม่' }), params(faqId));

    expect(res.status).toBe(200);
    expect((await getFaq()).question).toBe('คำถามใหม่');
    const db = await getDb();
    const audits = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, faqId));
    expect(audits.map((a) => a.action)).toEqual(['faq_update']);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าล้ม**

Run: `npx vitest run "src/app/api/line/admin/faq/[id]/route.integration.test.ts"`
Expected: FAIL — `PATCH` ล้มที่ `expected 'คำถามใหม่' to be 'คำถามเดิม'`, `DELETE (soft)` ล้มที่ `expected false to be true`

- [ ] **Step 3: ห่อด้วย tx**

แทน `:47-60` (PATCH: `await db.update(chatFaq)…` จนถึงปิด `logAudit`) ด้วย:
```ts
  // § update + audit ใน transaction เดียว — audit ล้ม = FAQ ไม่เปลี่ยน (ตอบ 500 เหมือนเดิม)
  await db.transaction(async (tx) => {
    await tx
      .update(chatFaq)
      .set({ ...result.data, updatedAt: new Date() })
      .where(eq(chatFaq.id, id));

    await logAudit(
      {
        userId: authz.ctx.user.id,
        action: AUDIT_ACTIONS.FAQ_UPDATE,
        resource: 'chat_faq',
        resourceId: id,
        ipAddress: authz.ctx.ipAddress,
        userAgent: authz.ctx.userAgent,
        metadata: { changes: Object.keys(result.data) },
      },
      tx,
    );
  });
```

แทน `:80-89` (DELETE: `await db.update(chatFaq).set({ isActive: false …` จนถึงปิด `logAudit`) ด้วย:
```ts
  // § soft delete + audit ใน transaction เดียว
  await db.transaction(async (tx) => {
    await tx.update(chatFaq).set({ isActive: false, updatedAt: new Date() }).where(eq(chatFaq.id, id));

    await logAudit(
      {
        userId: authz.ctx.user.id,
        action: AUDIT_ACTIONS.FAQ_DELETE,
        resource: 'chat_faq',
        resourceId: id,
        ipAddress: authz.ctx.ipAddress,
        userAgent: authz.ctx.userAgent,
      },
      tx,
    );
  });
```

> ไม่ใช่คนละ hunk กับ c8 c8 ใช้ชื่อตัวแปร `result` (`const result = await parseBody(...)`) snippet ด้านบนใช้ `result.data` ทั้ง update และ audit ถ้า c8 ยังไม่ merge ไฟล์จริงยังชื่อ `parsed` — อ่านไฟล์ก่อนวาง แล้วใช้ชื่อที่อยู่ในไฟล์นั้นทั้งสองจุดใน tx เดียวกัน ห้ามเหลือ `parsed.data` ปน `result.data`

- [ ] **Step 4: รัน test**

Run: `npx vitest run "src/app/api/line/admin/faq/[id]/route.integration.test.ts"`
Expected: PASS 3 tests

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/line/admin/faq/[id]/route.ts" "src/app/api/line/admin/faq/[id]/route.integration.test.ts"
git commit -m "refactor(chatbot): แก้/ลบ FAQ พร้อม audit ใน transaction เดียว"
```

---

### Task 5: Gate รวมและตรวจ diff

**Files:** ไม่มี (ตรวจอย่างเดียว)

**Interfaces:**
- Consumes: ผลของ Task 1–4
- Produces: branch พร้อมเปิด PR

- [ ] **Step 1: gate ทั้งหมด**

```bash
npx tsc --noEmit
npx eslint src/lib/consent.ts src/lib/dedup.ts src/lib/cases src/app/admin/actions/users.ts "src/app/api/line/admin/faq/[id]/route.ts" src/app/api/consent/withdraw/route.ts
npx vitest run
```

Expected: tsc ไม่มี error; eslint เฉพาะไฟล์ที่แตะ = 0 problems; vitest PASS ทั้งหมด รวม `tokens.contrast.test.ts` และ integration test ใหม่

ห้ามอ้าง `npx eslint .` exit 0 — baseline ของ repo คือ 21 errors / 3 warnings ที่ไม่เกี่ยวกับแผนนี้ gate = ไม่เพิ่ม error ใหม่ + tsc + vitest

- [ ] **Step 2: ตรวจว่าจุดหมวด A ทุกจุดส่ง tx แล้ว**

bash:

```bash
grep -rn -A20 "logAudit(" src/lib/cases/intake.ts src/lib/consent.ts src/app/admin/actions/users.ts "src/app/api/line/admin/faq/[id]/route.ts" | grep -c "tx,$"
```

PowerShell:

```powershell
$paths = @(
  'src/lib/cases/intake.ts',
  'src/lib/consent.ts',
  'src/app/admin/actions/users.ts',
  'src/app/api/line/admin/faq/[id]/route.ts'
)
(Select-String -Path $paths -Pattern 'logAudit\(' -Context 0,20 | Where-Object { $_.Context.PostContext -match '^\s*tx,' }).Count
```

Expected: `8` (intake 1 + consent 1 + users 4 + faq 2) — ถ้าน้อยกว่า แปลว่ามีจุดที่ลืมส่ง tx (ถ้าได้มากกว่า ให้เปิดดูด้วยตา — `-A20` อาจคร่อม `recordIntakeConsent(…, tx)` ถ้ามีคนย้ายลำดับโค้ด)

- [ ] **Step 3: ตรวจ diff ว่าไม่มีไฟล์นอกแผน**

```bash
git diff --stat main...HEAD
```

Expected: ไฟล์ในตาราง File Structure (รวม `citizen-access/*` ถ้า c1 ยังไม่ merge และแผนนี้ต้องเติม helper ที่มันเรียก) — ไม่มี `.gitignore`, `AGENTS.md`, `next-env.d.ts`, `.claude/*` ห้ามคาด "เฉพาะ 11 ไฟล์" ถ้าประกอบกับ c1 แล้ว

- [ ] **Step 4: (เมื่อผู้ใช้อนุญาต) push + PR**

```bash
git push -u origin refactor/audited-writes
gh pr create --title "refactor: เขียนข้อมูลกับ audit ใน transaction เดียว (createCase, withdraw, users, FAQ)" --body "ตามการ์ด c6 ของ architecture review 2026-10-03 — ดูตารางจำแนก 47 จุดเรียกใน docs/superpowers/plans/2026-10-03-audited-writes.md (หมวด B/D เป็น follow-up ต้อง re-validate หลัง c1/c5) gate คือ tsc + eslint เฉพาะไฟล์ที่แตะ = 0 + vitest ไม่ใช่ eslint . exit 0"
```

---

## Self-Review

1. **Spec coverage (การ์ด c6):** createCase 5 statement → Task 1 (เรียก `resolveCitizen`/`recordIntakeConsent` ด้วย tx) ✓; users.ts → Task 3 ✓; faq/[id] → Task 4 ใช้ `result.data` ใน tx ทั้ง update และ audit ✓; withdraw atomic → `revokeConsentWithAudit` ที่ c1 เรียกใน tx ของ `withdrawCaseConsent` (ไม่มี `withdrawConsent` ที่เปิด tx เอง) ✓; `DbOrTx` ใน Task 1 Step 3 ✓; ตาราง 47 จุดเรียก (ไม่ใช่ 36 ฟังก์ชัน) หมวด B/D re-validate หลัง c1/c5 ✓; intake integration เป็นของแผนนี้ รวม line rollback + cleanup ที่ไม่พึ่งผลสำเร็จ ✓; คง `enforceRateLimit` ของ c7 ใน withdraw route ✓
2. **Placeholder scan:** ไม่มี TBD/TODO; ทุก code step มีโค้ดเต็ม; `citizenIdentityOf`/`intakeConsentVia` ชี้ snippet เดียวกับแผน c1
3. **Type consistency:** `revokeConsentWithAudit(w: ConsentWithdrawal, tx: DbOrTx)` ใช้ชื่อ field `userId/caseId/trackingCode/via/ipAddress/userAgent` ตรงกันใน Task 2 และแผน c1; `resolveCitizen(identity, tx)` / `recordIntakeConsent(..., tx)` รับ `DbOrTx` ✓; `recordDedupHash(…, caseId, tx)` ตรงกับ signature ใน Interfaces ✓; intake.test.ts คง "14 tests" ไว้

**พฤติกรรมที่เปลี่ยน (ตั้งใจ):** (1) createCase ออกเลขติดตามก่อนสร้างผู้แจ้ง — ถ้าออกเลขไม่ได้จะไม่มีผู้ใช้/consent ค้าง (2) ทุกจุดหมวด A: audit ล้ม → ไม่มีการเปลี่ยนข้อมูล แทนที่จะเปลี่ยนแล้วตอบ error (3) ข้อความ error / status code / metadata ของ audit ไม่เปลี่ยน


## ผลการดำเนินงาน c6 (2026-10-04)

- [x] Task 0: branch refactor/audited-writes จาก b34ee5b; baseline 3 ไฟล์ / 40 tests ผ่าน
- [x] Task 1: intake atomic ตามข้อยกเว้นก่อน c1; red 4 failed / 1 passed → green 5 integration tests;
  unit เดิม 14 + unique-conflict regression 2 = 16; submit route integration 11 ผ่าน
- [x] Task 2: helper ไม่เปิด tx; route เดิมเปิด tx ทั้งเว็บ/LIFF และคง c7;
  helper integration 2 + route integration 5 ผ่าน รวม rollback/success/enforcement
- [x] Task 3: users actions 4 จุดใน tx; integration 5 ผ่านและคง error/redirect เดิม
- [x] Task 4: FAQ PATCH/DELETE ใน tx โดยคง parsed.data ก่อน c8; integration 3 ผ่าน
- [x] Task 5: gates รวมผ่านจริงและตรวจขอบเขต diff; commit local เท่านั้น

ผล gate รอบสุดท้าย (รันคำสั่งตามลำดับ ไม่มี suite/filter ที่ตัด integration):

```text
npx tsc --noEmit                                  exit 0
npx eslint <13 ไฟล์ .ts ที่แตะ>                    exit 0; 0 errors / 0 warnings
npx vitest run --maxWorkers=1 --no-file-parallelism exit 0
 Test Files  59 passed (59)
      Tests  533 passed (533)
   Duration  316.83s
```

full-suite รอบแรก 530 passed / 3 failed เพราะ DB mock ใน case-flow.test.ts ไม่มี transaction
แก้เฉพาะ mock ให้รับ tx/ON CONFLICT/RETURNING แล้ว focused tests 42 ผ่าน และ full suite รอบใหม่ผ่านครบ
ไม่แก้ case-flow.ts หรือ caller อื่น; ปรับ test metadata assertion ให้ตรง object ที่อ่านจาก DB จริง
และลบ declaration db ที่ซ้ำใน snippet test เดิม ไม่มี schema/migration หรือ seed เพิ่ม

Self-review: audit หมวด A ส่ง tx ครบ 8 จุด; § comments เดิมและข้อความไทยใน source
คงครบทุก literal/template; operations.ts และ callers 3 จุดไม่เปลี่ยน; c1 ไม่ถูกสร้าง/เรียก
คืนไฟล์เดิมจาก stash แล้วและเก็บ stash@{0} ชื่อ pre-audited-writes สำรองไว้ โดยแผนนี้
ถูกปรับตามที่ผู้ใช้อนุมัติ ต้นฉบับยังอยู่ใน stash

ไม่ได้ทำ: push, PR, merge, Vercel Preview, หมวด B/D และ implementation c1 ตามขอบเขตที่กำหนด
ไม่มีข้อสงสัยด้าน implementation ค้าง ส่วนการประกอบกับ c1 ให้ c1 ใช้ helper ใน tx ของตัวเอง

ไฟล์ของงานนี้ (14 ไฟล์ รวมแผนและ test fixture ที่ full suite พบว่าต้องปรับ):

```text
docs/superpowers/plans/2026-10-03-audited-writes.md
src/app/admin/actions/users.integration.test.ts
src/app/admin/actions/users.ts
src/app/api/consent/withdraw/route.integration.test.ts
src/app/api/consent/withdraw/route.ts
src/app/api/line/admin/faq/[id]/route.integration.test.ts
src/app/api/line/admin/faq/[id]/route.ts
src/lib/cases/intake.integration.test.ts
src/lib/cases/intake.test.ts
src/lib/cases/intake.ts
src/lib/consent.integration.test.ts
src/lib/consent.ts
src/lib/dedup.ts
src/lib/line/bot/case-flow.test.ts
```

Commits ก่อนบันทึกผลปิดงาน:
- 2ad1608 docs(audit): ปรับแผน baseline ก่อน c1
- 1513969 refactor(intake): intake atomic
- f412f85 refactor(consent): helper/route withdrawal atomic
- 932dc6a refactor(users): users actions atomic
- 17130af refactor(chatbot): FAQ atomic
