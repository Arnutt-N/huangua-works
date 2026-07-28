# Changelog

การเปลี่ยนแปลงสำคัญของ huangua-works — เรียงจากใหม่ไปเก่า (รูปแบบปรับจาก [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ให้จับกลุ่มตามวันที่)
บันทึกย้อนหลังถึง PR #1 (2026-07-16); รายละเอียดเชิงเทคนิคเต็มอยู่ใน git history และ PR ที่อ้างอิง

## [2026-07-28]

- **fix(auth): wrong-password login 500 in prod (minified err.name check)** ([PR #39](https://github.com/Arnutt-N/huangua-works/pull/39))
  - Production incident: กรอกรหัสผ่านผิดแล้วหน้า login 500 ทั้งหน้า (เกิดเฉพาะ prod — dev ไม่เป็น)
  - ต้นเหตุ: `@auth/core` ตั้ง `error.name` จาก `constructor.name` ซึ่งโดน minify เปลี่ยนชื่อใน prod build → เทียบ `err.name === 'CredentialsSignin'` ไม่ตรง → re-throw กลายเป็น 500
  - แก้เป็น `instanceof CredentialsSignin` (next-auth re-export class object เดียวกัน — ปลอดภัยจาก minification)
  - ฟื้น audit log `login_failure` ที่เคยถูกข้ามเพราะ error หลุดก่อนถึงจุดบันทึก; ยืนยันบน production build จริง (ผิด→200+alert, ถูก→redirect `/admin`)
- **docs(changelog): start CHANGELOG.md with auth fixes** ([PR #38](https://github.com/Arnutt-N/huangua-works/pull/38))
- **fix(auth): in-button login spinner + remember-me checked by default** ([PR #37](https://github.com/Arnutt-N/huangua-works/pull/37))
  - Spinner + "กำลังเข้าระบบ..." ย้ายเข้าไปในปุ่ม submit แล้ว redirect ไป `/admin` โดยตรง — เลิกแสดงการ์ด spinner แทนที่ทั้งฟอร์ม
  - "จดจำฉัน" ติ๊กเป็นค่าเริ่มต้น (session 30 วัน) — แก้อาการ "remember me แต่ไม่ keep me" ที่ไม่ติ๊กมาทำให้ session หมดอายุใน 1 ชม. (JWT `expiresAt` claim)
  - กัน React 19 reset ช่องกรอกว่างวูบหลัง login สำเร็จ (input เป็น controlled)
  - เพิ่ม e2e test ถอดรหัส session JWT ยันอายุ session ~30 วัน (ติ๊ก) vs ~1 ชม. (ไม่ติ๊ก)
- **feat(auth): password visibility toggle + no blank flash on login redirect** ([PR #36](https://github.com/Arnutt-N/huangua-works/pull/36))
- **docs(env): document SMTP keys for password-reset email** ([PR #35](https://github.com/Arnutt-N/huangua-works/pull/35))
- **docs(design): add Layout Patterns visual section (ASCII wireframes)** ([PR #34](https://github.com/Arnutt-N/huangua-works/pull/34))
- **fix(ui): align rounded-2xl/3xl with radius token scale** ([PR #33](https://github.com/Arnutt-N/huangua-works/pull/33))
- **docs(design): correct 4 factual errors in DESIGN.md review** ([PR #32](https://github.com/Arnutt-N/huangua-works/pull/32))
- **docs(design): add layout/shape/component foundations to DESIGN.md** ([PR #31](https://github.com/Arnutt-N/huangua-works/pull/31))

## [2026-07-27]

- **feat(auth): self-service password reset + remember-me + login UI** ([PR #30](https://github.com/Arnutt-N/huangua-works/pull/30))
- **feat(admin): แบ่ง sidebar เป็น 3 กลุ่ม + หน้าหน่วยงาน/หมวดหมู่ + ย้าย settings เป็น profile** ([PR #29](https://github.com/Arnutt-N/huangua-works/pull/29))
- **feat(admin): sidebar layout + หน้าตั้งค่าบัญชี + แก้ /admin/reports 500** ([PR #28](https://github.com/Arnutt-N/huangua-works/pull/28))
- **redesign(admin): เข้าธีม landing + แก้ contrast ที่อ่านไม่ออก + แก้นาฟบาร์หล่นบรรทัด** ([PR #27](https://github.com/Arnutt-N/huangua-works/pull/27))
- **fix(auth): set trustHost:true — UntrustedHost was 500ing all auth endpoints** ([PR #26](https://github.com/Arnutt-N/huangua-works/pull/26))

## [2026-07-26]

- **fix(auth): decouple login redirect from cookie-setting response** ([PR #25](https://github.com/Arnutt-N/huangua-works/pull/25))
- **fix(ci): resolve 3 pre-existing lint errors blocking green CI** ([PR #24](https://github.com/Arnutt-N/huangua-works/pull/24))
- **fix(ui): unify /intake, /track, /admin/login with landing glassmorphism style** ([PR #23](https://github.com/Arnutt-N/huangua-works/pull/23))
- **fix(scripts): fix TS type-narrowing errors blocking production build** ([PR #22](https://github.com/Arnutt-N/huangua-works/pull/22))

## [2026-07-25]

- **feat(geo): FK constraints + e2e fixes + UI/UX fixes** ([PR #21](https://github.com/Arnutt-N/huangua-works/pull/21))

## [2026-07-23]

- **feat(line): LINE Messaging API — chatbot + admin live chat** ([PR #20](https://github.com/Arnutt-N/huangua-works/pull/20))
- **feat(village): add village data (80k records) + 4th cascade level + fix type errors** ([PR #19](https://github.com/Arnutt-N/huangua-works/pull/19))
- **feat(geography): FK constraints, admin structured address, E2E cascade tests** ([PR #18](https://github.com/Arnutt-N/huangua-works/pull/18))

## [2026-07-22]

- **test(geodata): unit + integration tests for geodata API and validation** ([PR #17](https://github.com/Arnutt-N/huangua-works/pull/17))
- **fix(intake): geo fetch error feedback + race condition guard** ([PR #16](https://github.com/Arnutt-N/huangua-works/pull/16))
- **feat(geography): cascading province/district/subdistrict dropdowns** ([PR #15](https://github.com/Arnutt-N/huangua-works/pull/15))

## [2026-07-21]

- **fix(security): harden CSP, enforce PDPA consent, sanitize IP headers** ([PR #14](https://github.com/Arnutt-N/huangua-works/pull/14))
- **feat(pdpa): privacy + terms + consent withdraw + zod + CSP + cleanup (#4/7)** ([PR #13](https://github.com/Arnutt-N/huangua-works/pull/13))
- **feat(admin): filter + reports + user management + audit page (#3/7)** ([PR #12](https://github.com/Arnutt-N/huangua-works/pull/12))
- **feat(admin): case detail page + actions + PATCH API + state machine (#2/7)** ([PR #11](https://github.com/Arnutt-N/huangua-works/pull/11))
- **feat(landing): wire CTA → /intake + /track, real stats, SEO basics (#1/7)** ([PR #10](https://github.com/Arnutt-N/huangua-works/pull/10))

## [2026-07-20]

- **fix(copy): replace Traffy template leftovers with อบต.หัวงัว scope** ([PR #9](https://github.com/Arnutt-N/huangua-works/pull/9))

## [2026-07-19]

- **fix(copy): replace 'ร้องเรียก/ร้องทุกข์' with 'แจ้งเหตุ' across 9 sites** ([PR #8](https://github.com/Arnutt-N/huangua-works/pull/8))
- **chore(deps): remove unused @upstash/qstash dependency** ([PR #7](https://github.com/Arnutt-N/huangua-works/pull/7))

## [2026-07-18]

- **chore(meta): update site title/description wording** ([PR #6](https://github.com/Arnutt-N/huangua-works/pull/6))
- **fix(ui): HowItWorks step badge overlap + low-contrast yellow + connector** ([PR #5](https://github.com/Arnutt-N/huangua-works/pull/5))
- **fix(build): force-dynamic on DB-backed pages** ([PR #4](https://github.com/Arnutt-N/huangua-works/pull/4))
- **docs(deploy): beginner deploy guide + cron-job.org migration** ([PR #3](https://github.com/Arnutt-N/huangua-works/pull/3))

## [2026-07-16]

- **fix(consent,pdpa): secure case tracking + enforce PDPA consent, drop plaintext CID** ([PR #2](https://github.com/Arnutt-N/huangua-works/pull/2))
- **feat: migrate Supabase stack to plain PostgreSQL + Auth.js v5** ([PR #1](https://github.com/Arnutt-N/huangua-works/pull/1))
