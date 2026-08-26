# PRP-Plan — LINE LIFF สำหรับ /intake และ /track

> คู่กับ `docs/prd-liff-mobile.md` · Branch เอกสาร: `docs/liff-prd-prp` · Branch implement: `feat/liff-intake-track`
> ทุก tranche จบด้วย gates: `npx tsc --noEmit` + `npx eslint .` + `npx vitest run` (integration ต้องมี Docker stack)

---

## 1. การทบทวนแผนฉบับแชท (self-review ก่อนเขียนแผนนี้)

แผนที่เคยเขียนในแชทถูกตรวจซ้ำกับโค้ดจริงและเอกสาร LINE แล้ว มี 4 จุดที่**แก้จากฉบับแชท**:

1. **การ verify ID token เปลี่ยนวิธี** — ฉบับแชทเขียน "verify JWT HS256 ด้วย channel secret เอง" ตรวจแล้วไม่ปลอดภัยต่อการ implement: ID token จาก LIFF ถูกเซ็นด้วย HS256 (web flow) **หรือ ES256 (native/LIFF SDK)** แล้วแต่ช่องทาง — verify เองด้วย secret เดี่ยว ๆ เสี่ยงพังเงียบ ๆ
   **แก้เป็น:** เรียก `POST https://api.line.me/oauth2/v2.1/verify` (ส่ง `id_token` + `client_id`) ให้ LINE เป็นคน verify signature/expiry แล้วเราอ่าน payload กลับมา assert `aud` = channel ID เราเอง — ไม่ต้อง parse JWT เลย และ**ไม่ต้องเก็บ channel secret ของ Login channel** เพิ่มใน env เลย (ตัด `LINE_LOGIN_CHANNEL_SECRET` ออกจากแผน) แลกกับ HTTPS call 1 ครั้งต่อการ login (ซึ่งเกิดไม่บ่อยเพราะมี session cookie)
2. **พบบั๊กเดิมในระบบ (แก้พร้อมงานนี้):** `lineUsers.linkedUserId` **ไม่มีจุดเขียนเลยในทั้งโค้ดเบส** (มีแต่จุดอ่านใน `intake.ts:142`) ผลคือการแจ้งเรื่องผ่านบอทครั้งที่ 2 ของ LINE user เดิมจะสร้าง `users` row ที่มี email `line-<id>@placeholder.local` ซ้ำ → ชน unique constraint → `createCase` คืน `internal` (500) — และ "เรื่องของฉัน" (D2) จะไม่เห็นเคสเหล่านี้ด้วย
   **แก้:** session route เป็น "เจ้าของ" การ upsert ความสัมพันธ์ (lineUsers ↔ users ↔ linkedUserId) และ `resolveSubmitter` เปลี่ยนเป็น ensure-link แทนการ create เปล่า
3. **Session cookie ห้ามใช้ `CID_HMAC_KEY` ดิบ** — ผิดหลัก key separation
   **แก้:** derive key เฉพาะทาง `HMAC(CID_HMAC_KEY, 'liff-session')` — ไม่ต้องเพิ่ม env var ใหม่และไม่ reuse คีย์ตรง ๆ
4. **Rate limit ของ session route ต้อง `failOpen: false`** — ฉบับแชทเขียน `failOpen: true` ซึ่งขัดกติกาของ repo ("authentication paths ต้อง fail-secure") และ **e2e mock ต้องเปิดด้วย env (`LIFF_E2E_MOCK=1`) เท่านั้น** ห้ามเป็น query param (มิฉะนั้นเป็นช่องปลอมตัวใน production)

ข้อสังเกตเพิ่ม: ข้อความต้อนรับบอทมาจาก `chatSettings` (DB) ซึ่ง override DEFAULTS ในโค้ด — แก้ข้อความต้องผ่านหน้า admin/seed ไม่ใช่แก้แค่ `settings.ts`

---

## 2. Tranches

### T0 — Console setup (งานมือ นอกโค้ด) — บล็อกทุกอย่าง

LINE Developers Console → provider **เดียวกับ** Messaging API channel ปัจจุบัน:
1. สร้าง **LINE Login channel** → จด Channel ID
2. สร้าง LIFF app: Size **Full** (D3), Scope `openid` + `profile`, Endpoint URL `https://huangua-works.vercel.app` (**root ของโดเมน** — path ที่ต่อท้าย `liff.line.me/<id>` จะถูกนำไปต่อท้าย path ของ Endpoint URL ตาม spec ของ LINE; ถ้าตั้งเป็น `/intake` ปุ่ม "ติดตาม" (`<id>/track`) จะเปิด `/intake/track` = 404)
3. (D4) LIFF app ที่สอง: Endpoint `https://huangua-works-staging...` หรือ preview URL ถาวรของ staging
4. ผลลัพธ์ที่ต้องได้: ค่า `LIFF_ID` (prod) + `LIFF_ID_STAGING` + `LINE_LOGIN_CHANNEL_ID`

### T1 — Env contract

- **แก้** `.env.local.example`, `.env.example`: เพิ่ม `NEXT_PUBLIC_LIFF_ID`, `NEXT_PUBLIC_LIFF_ID_STAGING` (optional), `LINE_LOGIN_CHANNEL_ID`
- **แก้** `scripts/verify-env.ts`: เพิ่มเป็น **optional เชิงเตือน** (fail เฉพาะเมื่อมีค่าตั้งแต่หนึ่งตัวในชุดแต่ขาดอีกตัว — กัน deploy เดิมพังก่อน T0 เสร็จ)
- Test: unit ใน `scripts/verify-env` (ถ้ามี harness อยู่ / ไม่งั้นรัน manual ผ่าน `npm run verify-env`)

### T2 — Server: session infrastructure (แกนความปลอดภัย) — บล็อก T3–T5

- **สร้าง** `src/lib/liff/verify-line-id-token.ts` — เรียก LINE verify endpoint, zod ตรวจ response, assert `aud === LINE_LOGIN_CHANNEL_ID`, คืน `{ lineUserId, displayName?, pictureUrl? }`; timeout + ไม่ leak error detail ออก log
- **สร้าง** `src/lib/liff/session.ts` — sign/verify session cookie ค่า `lineUserId|exp` ด้วย derived key `HMAC(CID_HMAC_KEY, 'liff-session')`, อายุ 7 วัน, HttpOnly + Secure + SameSite=Lax
- **สร้าง** `src/app/api/liff/session/route.ts` — POST `{ idToken }` → verify → upsert `lineUsers` + ensure `users` row + **เขียน `linkedUserId`** (แก้บั๊กข้อ 2 ใน §1) → `logAudit(LIFF_LOGIN)` → set cookie; rate limit 5 req/5 นาที **`failOpen: false`**; DELETE = ล้าง cookie
- **แก้** `src/lib/audit.ts` — เพิ่ม `LIFF_LOGIN` ใน `AUDIT_ACTIONS` (closed map)
- **แก้** `src/lib/cases/intake.ts` — `resolveSubmitter` สาย line: ถ้ายังไม่มี `linkedUserId` ให้ create user **แล้วเขียนกลับ** `lineUsers.linkedUserId` (กันชน unique email ซ้ำ)
- **สร้าง (optional แยก PR ได้)** `scripts/backfill-line-links.ts` — จับคู่ `users.email LIKE 'line-%@placeholder.local'` ที่มีอยู่กับ `lineUsers.lineUserId` แล้วเติม `linkedUserId`
- Tests: unit (verify response shapes, cookie sign/verify, tamper ปฏิเสธ) + integration (session route กับ stub HTTP ต่อ LINE)

### T3 — Client: LIFF provider

- **สร้าง** `src/components/liff/liff-provider.tsx` — โหลด SDK ผ่าน CDN (ไม่เพิ่ม npm dep), `liff.init({ liffId })`, จัดการ 3 สถานะ: in-LIFF / external browser (เสนอเข้าสู่ระบบผ่าน `liff.login()`) / init ล้มเหลว (fallback ฟอร์มเดิม), expose `useLiff()` context (`isInClient`, `lineUserId`, `displayName`, `getIdToken()`)
- **สร้าง** `src/lib/liff/config.ts` — เลือก LIFF ID ตาม env (prod/staging) + `isLiffMockEnabled` (อ่าน env เท่านั้น)
- Test: unit กับ mock `window.liff`; RTL ของ provider ทั้ง 3 สถานะ

### T4 — Intake เดินใน LIFF (พึ่ง T2 + T3)

- **แก้** `src/lib/validation.ts` — เพิ่ม `submitCaseLineSchema`: ตัด `cid` บังคับ (D1), `fullName` optional (มีจากโปรไฟล์)
- **แก้** `src/app/api/cases/submit/route.ts` — อ่าน liff session จาก cookie (server เท่านั้น ไม่รับจาก body) → ถ้า valid ใช้ `submitCaseLineSchema` + `channel: 'line'` + `lineUserId` จาก cookie; ถ้าไม่มี ใช้ path เดิมทุกอย่าง
- **แก้** `src/lib/cases/intake.ts` — บันทึก consent เมื่อ channel line จาก LIFF (`metadata.source: 'liff'`) + dedup สาย LINE: reuse `generateDedupHash('line:' + lineUserId, title, description)`
- **แก้** `src/app/intake/intake-form.tsx` — รับ context จาก `useLiff()`: ซ่อนช่อง CID (D1), autofill ชื่อ, ยกเลิกการแนบ `cid` ใน payload; หน้าเดิมในเบราว์เซอร์ปกติไม่เปลี่ยนพฤติกรรม
- **แก้** `src/app/api/consent/withdraw/route.ts` — รับ path ที่สอง: ยืนยันด้วย liff session cookie (ไม่ต้องมี CID)
- Tests: unit schema; integration: submit ผ่าน cookie จริง + duplicate 409 + consent record; e2e แยกดู T6

### T5 — Track "เรื่องของฉัน" (พึ่ง T2 + T3, ทำขนานกับ T4 ได้)

- **แก้** `src/app/track/page.tsx` — server component อ่าน liff cookie → ถ้ามี session ดึงเคสของ `linkedUserId` (เฉพาะ field ที่ไม่ใช่ PII: รหัส, สถานะ, หัวข้อ, updatedAt) แสดงเป็นรายการ + คงช่องพิมพ์รหัสไว้
- **สร้าง** `src/lib/cases/my-cases.ts` — query + mapping (unit-testable แยกจาก page)
- Tests: integration query; unit mapping

### T6 — ทางเข้า, เอกสาร, e2e (พึ่ง T4 + T5)

- **แก้** `src/lib/line/messages/rich-menu.ts` — เพิ่ม area ปุ่ม `type: 'uri'` ชี้ `https://liff.line.me/<LIFF_ID>` (ปัจจุบันเป็น `type: 'message'` ล้วน) + รัน `scripts/upload-rich-menu.ts` / publish ผ่าน admin
- **แก้ข้อความต้อนรับ + fallback ของบอท** ชี้ทางเข้าใหม่ — **ผ่าน admin settings/seed** (ไม่ใช่แก้ DEFAULTS ในโค้ด เพราะ DB row ที่มีอยู่ override) + `invalidateSettingsCache`
- **แก้** `/privacy`, `/terms`, ข้อความ consent ในฟอร์ม — เพิ่ม "ข้อมูลโปรไฟล์ LINE (ชื่อที่แสดง, รหัสผู้ใช้)" ตาม PDPA
- **สร้าง** `e2e/intake-liff.spec.ts`, `e2e/track-liff.spec.ts` — รันด้วย `LIFF_E2E_MOCK=1` (provider ส่ง idToken จำลอง; session route ยอมรับเฉพาะเมื่อ env นี้ตั้งเท่านั้น)
- **ทำ manual test บนมือถือจริง 1 รอบ** — e2e อัตโนมัติจำลอง LIFF ได้ไม่เต็มรูปแบบ (ตามข้อจำกัดที่ระบุไว้)

---

## 3. Dependency order

```
T0 (console) ──► T1 (env) ──► T2 (session infra) ──┬─► T4 (intake)  ──┐
                                                   └─► T5 (track)   ──┼─► T6 (entrances/docs/e2e)
T3 (provider, พึ่งแค่ T1) ──────────────────────────────┘ (T4/T5 พึ่ง T3)
```

T4 กับ T5 ทำขนานกันได้ (คนละไฟล์ไม่ทับกัน) · T6 ปิดท้ายเสมอ

## 4. ความเสี่ยง & การบรรเทา

| ความเสี่ยง | บรรเทา |
|---|---|
| Login channel อยู่คนละ provider กับ Messaging → userId ไม่ตรงกัน | T0 กำหนดชัด + ตรวจด้วยการส่งข้อความทดสอบเทียบ userId ก่อนใช้จริง |
| Cookie ปลอม/หมดอายุ | ค่า cookie เป็น `lineUserId|exp` + HMAC derived key; ตรวจทุก request ที่ใช้ |
| ผู้ใช้เก่าที่แจ้งผ่านบอทมาก่อน (placeholder users ไม่มี link) | backfill script ใน T2 + link อัตโนมัติตอน login ครั้งแรก |
| `NEXT_PUBLIC_LIFF_ID` ลืม redeploy | เพิ่ม health check แสดงสถานะ LIFF config ใน `/admin/health` |
| แจ้งซ้ำผ่านช่องทาง bot (ไม่ผ่าน LIFF) | dedup สาย LINE ใน T4 ครอบทั้ง bot และ LIFF (key เดียวกันคือ lineUserId) |
| e2e จำลองไม่ครบพฤติกรรม LINE จริง | กำหนด manual test checklist มือถือ 1 รอบก่อน announce |
| § บั๊กที่พบหลังทดสอบมือถือจริง (post-T0): `LiffStateRedirect` เดิม replace ออกจาก landing ก่อน `liff.init()` → token ของ SDK หลุด → หน้าปลายทาง auto-login กลับ landing ซ้ำ = ลูปหน้าโฮม ↔ `/intake`,`/track` ไม่รู้จบ | แก้แล้ว: init SDK ที่ landing ก่อนแล้วค่อย replace (ตาม spec "process URL changes after `liff.init()` completes") — e2e mock ข้าม SDK จึงตรวจไม่จับ (เหมือนบั๊ก CSP ก่อนหน้า) ต้องพิสูจน์ด้วยมือถือจริงอีกครั้ง |

## 5. ประมาณการขนาดงาน

| Tranche | ขนาดโดยประมาณ |
|---|---|
| T0 | งานมือ ~30 นาที |
| T1 | S |
| T2 | M (มีบั๊กเดิมที่ต้องแก้ร่วม) |
| T3 | S–M |
| T4 | M |
| T5 | S–M |
| T6 | M (รวม e2e + เอกสาร + ทดสอบมือ) |
