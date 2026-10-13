# PRD: แก้ผล interrogate #109/#110/#111 (Act On 4 + Consider คุ้มค่า)

ต่อจาก verdict interrogate 4 สาย (A–D) — งานนี้ทำเฉพาะที่ verdict สั่ง ไฟล์แผนนี้อยู่บน
branch `fix/interrogate-act-on` (worktree แยก `D:/toppublic/fix-interrogate`)

## ปัญหา (จาก verdict, เรียงตาม consensus)

1. Tick แสดงเมนูลำดับผิด (4/4) — expire เขียน DB ก่อนยกเลิก default บน LINE
   (cancel ล้ม = default ค้างตลอดกาล), tick ที่ activate+expire พร้อมกันล้าง default
   ที่เพิ่งตั้ง, เมนูมีแค่ end date โดน publish อัตโนมัติ
2. Feedback ตอบ 409 ทุก DB error (4/4) — outage กลายเป็น "ให้คะแนนแล้ว" ทั้งที่ไม่ได้ให้
3. Feedback ไม่ normalize tracking code (3/4) — ดูเคสได้แต่ให้ดาวได้ 404
4. แถว tier เก่าก่อน #111 ล็อก superadmin แบบกู้ในแอปไม่ได้ (2/4 critical)

## ขอบเขต

**ในขอบเขต (F1–F6):**
- F1 tick: cancel default บน LINE **ก่อน** flip DB inactive; ข้าม cancel เมื่อมี activate
  ใน tick เดียวกัน; activate ต้องมี start ที่ถึงเวลาแล้วเท่านั้น; overlap เลือก
  `displayStartAt` ล่าสุดชนะตัวเดียว (deterministic, ไม่ flip-flop)
- F2 feedback: `normalizeTrackingCode` ก่อน lookup (null → not_found);
  เช็ค `isUniqueViolation` (`src/lib/db/errors.ts` มีแล้ว) ก่อนค่อย 409 ที่เหลือโยน 500;
  ใส่ `formatReset` ใน feedback route ด้วย (ปิดจ็อบ #110 ตกหล่นในตัว)
- F3 tier stale rows: union superadmin ตอนอ่าน (`pickTierRoles`/`loadTierMap`)
  + backfill migration หนึ่งบรรทัด (defense in depth ทั้งคู่)
- F4 alias: เช็ค local ก่อนยิง LINE; insert ล้มหลัง LINE สร้างแล้ว → ลบชดเชย
  (best-effort); PUT/DELETE ตรวจ `isValidAliasId` + `encodeURIComponent`;
  404 เมื่อ alias/menu ไม่มีตัวตน (แยกจาก 422); repoint อัป `updatedAt`;
  DB write ทุกตัวใน try/catch คืน `{ok:false}` ไม่โยน 500
- F5 tier hardening: dispatch ด้วยค่าที่ sort+join (เลิก identity);
  validate ครบทุก tier ก่อนเขียน (ห้าม half-apply); audit ค่า `forced` ที่เก็บจริง;
  fail-open ต้อง `console.warn`; กรอง roles ตอนอ่านด้วย `ALL_ROLES`;
  derive `EDITABLE` + `TIER_ROLE_OPTIONS` จาก `ALL_ROLES`; กัน head ล็อกตัวเอง
  (actor ถูกตัดออกจาก admin โดยไม่ใช่ superadmin → ปฏิเสธ); UI: superadmin เป็น
  checked+disabled พร้อมป้ายบังคับ + แก้ copy ว่าง; ส่ง cache invalidate ตอนเขียน
  (export จาก versioned-cache หรือ wrapper)
- F6 schedule แก้ไขได้: `PATCH [id]` แก้/ล้าง window (validate เดิม) + `DELETE [id]`
  (ติด alias อยู่ลบไม่ได้); FeedbackCard ผูก `key={trackingCode}` + ส่ง code ที่ trim แล้ว;
  cron test เพิ่มเคส 502; `formatReset` clamp; `rating` CHECK 1-5; CSAT reader
  ขั้นต่ำ (avg/count ต่อหมวดใน reports — ไม่ทำ reader ใหญ่)

**นอกขอบเขต (พร้อมเหตุผล):**
- Oracle 404/422/409 ของ feedback — คงแยก code ไว้ (UX ต้องบอกละเอียด + code เดายาก
  + rate limit อยู่) ขัด convention ข้างบ้านแต่ trade-off นี้เอกสารไว้ตรงนี้แล้ว
- CSAT รวมเคส rejected — product decision รอเจ้าของ (noted ใน verdict)
- #110 merge — ของ session อื่น ได้แค่ทัก (feedback route เราแก้ฝั่งเราเองใน F2)

## เกณฑ์ยอมรับ (ตรวจได้)

- F1: test tick รวม (expire-as-default + activate พร้อมกัน → default ลงตัวใหม่,
  cancel ไม่ถูกเรียก); end-only draft ไม่ activate; overlap ชนะตัวเดียว deterministic
- F2: ดาวด้วย code ตัวเล็กมีช่องว่าง → 201; DB ล้ม → 500 ไม่ใช่ 409 (mock throw);
  feedback 429 แสดงนาที
- F3: seed แถว admin=['head'] (สภาพก่อน #111) → superadmin ผ่านด่าน admin ได้
- F4: สร้าง alias ชื่อซ้ำ → retry สำเร็จ (ไม่มี orphan); PUT/DELETE ชื่อผิด → 400;
  ลบของไม่มี → 404 ไม่มี audit ผี
- F5: spread `[...ADMIN_ROLES]` เข้า matrix เหมือน const; validate ล้มตั้งแต่ก่อนเขียน
  (matrix ไม่ขยับ); audit ตรง DB; head ตัดตัวเองออกโดนปฏิเสธ
- F6: PATCH แก้/ล้าง window ได้; DELETE ติด alias โดนบล็อก; สลับเคสค้นหาแล้วฟอร์มรีเซ็ต

## ข้อจำกัด

- กฎ `AGENTS.md` เดิมทุกข้อ (TDD, gates, conventional commits, `npx`)
- ไม่แตะโค้ด #110 (ของ session อื่น) นอกจากไฟล์เราเอง
- migration ใหม่ทีละไฟล์ผ่าน generate + ตรวจ snapshot สะอาดก่อน commit

## ตัวชี้วัด

- test ใหม่ทุกข้อเขียว + tsc + eslint ไฟล์ที่แตะ
- ไม่มี test เก่าแดงเพราะการแก้นี้ (whitelist รอบข้างต้องรัน)
