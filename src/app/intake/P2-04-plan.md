# P2-04 — การเข้าถึงฟอร์มสำหรับผู้สูงอายุ

## PRD

ปัญหา: ผู้ใช้ที่ลดการเคลื่อนไหวยังพบ animation/delay และผู้ใช้ screen reader ไม่ได้รับข้อความผิดพลาดที่ผูกกับช่องกรอก เมื่อกลับมาฟอร์มต้องเลือกข้อมูลใหม่

ขอบเขต: ฟอร์ม intake/track, CSS motion, ตัวช่วย draft สำหรับฟอร์ม, tests เฉพาะงานนี้ และ story ใหม่ ไม่แก้ validation, backend, env, สี, checkout อื่น และไม่เพิ่ม OTP ตามเอกสารเก่าซึ่งอยู่นอกคำขอ

เกณฑ์รับ: ลด motion ตามการตั้งค่าระบบทั้ง animation/transition/delay/scroll; input, textarea, select และ consent ที่ผิดพลาดเชื่อม aria-describedby กับ error role=alert; draft บันทึก/คืนค่า/ล้างได้; ไม่มีชื่อ CID โทรศัพท์ หรือข้อความอิสระใน localStorage; storage ล้มเหลวไม่ทำให้ส่งฟอร์มไม่ได้; มี Storybook error pattern

ข้อจำกัด: intake draft เก็บเฉพาะ categoryId ที่อยู่ในรายการจาก server; track draft เก็บเฉพาะ HG/HN ตามด้วยตัวเลข 9 หลักที่ normalize แล้ว ตาม src/lib/case-tracking.ts ไม่เก็บผลค้นหา ข้อมูลผู้แจ้ง consent หรือข้อความอิสระ ข้อมูลจาก URL ของ track มีลำดับก่อน draft และการคืนค่า draft ไม่เรียกค้นหาเอง

ตัวชี้วัด: typecheck/lint ผ่าน, tests ความเป็นส่วนตัว/คืนค่า/ล้าง/error ผ่านทั้งหมด และ contrast gate ผ่าน ไม่มีการเปลี่ยนคู่สี

## PRP-Plan

1. เพิ่ม src/components/forms/non-pii-draft.ts และ .test.ts: allowlist payload/version, ตรวจรูปแบบและรายการ category, กันข้อมูลเก่าหรือเสียและ storage ที่ใช้ไม่ได้ ตรวจไม่มี PII ทั้งเขียนและอ่าน
2. แก้ src/app/intake/intake-form.tsx และ src/app/track/track-form.tsx: คืน draft หลัง mount เพื่อไม่เกิด hydration mismatch, บันทึกเมื่อเปลี่ยน, ล้างเมื่อกดปุ่มและหลังส่ง intake สำเร็จ; เชื่อมทุก validation error กับ control รวม hint; ปิด spinner เมื่อ reduced motion
3. แก้ src/styles/tokens.css: เพิ่ม delay และ scroll guard ในกฎ reduced motion เดิม; เพิ่ม src/styles/reduced-motion.test.ts ตรวจ CSS contract
4. เพิ่ม src/components/ui/form-errors.stories.tsx ตาม Meta/StoryObj + primitives เดิม: input, textarea, select, checkbox และ hint/error
5. เพิ่ม src/app/intake/intake-form.test.tsx และ src/app/track/track-form.test.tsx ด้วย jsdom/testing-library: error association ทุก control, privacy เมื่อกรอก PII, restore/clear/success และ storage failure ใช้ fetch/LIFF mocks ไม่ใช้ DB
6. รัน npx tsc --noEmit; npx eslint ทุกไฟล์ TS/TSX ที่เปลี่ยน รวม story ด้วยการ override ignore; npx vitest run เฉพาะ tests เพิ่มใหม่ และ npx tsx scripts/check-contrast.ts ตรวจ contrast โดยตรง ตรวจ diff แล้ว commit เฉพาะขอบเขต ไม่มี push/merge

ลำดับทำงาน: ตัวช่วย draft → ฟอร์ม → CSS/story → gates/commit ทำลำดับเดียวไม่มี sub-agent

ความเสี่ยง: free text อาจมี PII จึงไม่ persist; payload แปลกปลอมต้องทิ้ง; localStorage ต้องอ่านหลัง mount และ catch ทุก operation; draft เก่าต้องไม่ชนะ URL; reset/success ต้องไม่เขียน draft กลับ; tests ไม่เรียก DB

## Review gate

ตรวจ PRD กับคำขอทั้ง 4 ข้อและ PRP กับ source จริงแล้ว: FieldError มี role=alert อยู่แล้ว แต่ขาด id/aria-describedby; SelectTrigger ส่ง ARIA props ได้; scoped forms ไม่มี framer-motion และ primitives ลด transition แล้ว; tokens.css มีกฎ global reduced motion ที่ยังไม่ลด delay; Storybook มี field pattern และ a11y addon เดิม ใช้รูปแบบ HG/HN ที่ตรวจจาก source ไม่มีแก้ไฟล์นอกขอบเขต (BLOCKED.md เป็นข้อยกเว้นที่ผู้ใช้สั่ง)

ผู้ใช้อนุญาต npm install --offline=false --legacy-peer-deps และอนุญาตทำต่อโดยใช้ skills ที่มี/อ่าน source แทน Graft แล้ว

## ผลตรวจ — 2026-10-09

- npx tsc --noEmit: ผ่าน (exit 0)
- npx eslint --no-ignore --no-warn-ignored กับไฟล์งานทั้งหมด: ผ่าน (exit 0); TS/TSX รวม story ถูกตรวจ ส่วน CSS/Markdown ไม่มี parser ใน ESLint config เดิมและ CSS ตรวจด้วย motion/contrast tests
- npx vitest run src/components/forms/non-pii-draft.test.ts src/app/intake/intake-form.test.tsx src/app/track/track-form.test.tsx src/styles/reduced-motion.test.ts: 4 ไฟล์ / 38 tests ผ่าน ไม่มี integration tests
- npx tsx scripts/check-contrast.ts: 19 คู่ × 2 ธีม ผ่านทั้งหมด ไม่มีเปลี่ยนคู่สี
- ไม่ได้เปิด dev server หรือรัน Playwright E2E/axe ในเบราว์เซอร์; Storybook patterns ตรวจ typecheck/lint แล้ว ให้ตรวจเบราว์เซอร์ตอนรวมตามขอบเขตผู้ใช้
- ลบ BLOCKED.md ที่อุปสรรคแก้แล้วและ package-lock.json ที่การติดตั้งสร้าง ไม่รวมไฟล์นอกขอบเขตใน commit
