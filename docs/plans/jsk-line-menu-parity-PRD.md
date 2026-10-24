# PRD — เทียบเมนู LINE ให้เหมือน jsk-app 100%

## ปัญหา

หน้าเมนู LINE ทั้ง 9 หน้าใน `/admin` ถูก refactor รอบก่อนให้ "เหมือน jsk" แต่ผลจริงไม่เหมือน — รอบนั้นไม่ได้เทียบ screenshot และโค้ดต้นฉบับ จึงหลุดทั้งโครงหน้า ฟิลด์ คอลัมน์ และฟีเจอร์

หลักฐานอ้างอิง (ตรวจแล้ว 2026-10-23):

- screenshot 19 ใบ: `secrets/jsk-app/screenshot/line/`
- โค้ดต้นฉบับ: `D:\genAI\jsk-app` @ `8d4c979` (main สะอาด, PR #288-#291 รวมแล้ว)
- ผลเทียบรายหน้า: gap list ด้านล่าง (ตรวจถึงระดับ JSX + file:line ทุกข้อ)

## เป้าหมาย

โครงหน้า + เนื้อหา + ฟิลด์ + คอลัมน์ + ฟีเจอร์ เหมือน jsk ทุกจุดที่ gap list ระบุ โดยคง design token ของหัวงัว (`src/styles/tokens.css` oklch น้ำเงิน 255° + ทอง) และ component kit ของหัวงัว (AdminCard/Dialog/field) — ไม่เอาธีม navy HSL ของ jsk

**ข้อความป้าย/หัวหน้าหน้า: ตรง jsk ตัวอักษรจริง** (EN/TH ปนตามต้นฉบับ เช่น `Intent Categories` + subtitle ไทย) — เพราะ screenshot คือ spec ของงาน

## ขอบเขต

### เข้า (gap list ปิดให้ครบ)

1. **โครงเมนู sidebar** — ลำดับ ป้าย กลุ่ม ตาม `jsk layout.tsx:193-201` (ดู gap ข้อ 0)
2. **Chatbot Overview** — เปลี่ยนเนื้อหน้าทั้งหมดเป็น StatsCard 3 ใบ + Recent Templates + Active Intents (เดิมเป็น KPI สถิติคนละเรื่อง)
3. **Live Chat** — full-screen shell, Live Chat Console header + Connected badge, ตัวเลข Waiting/Active, footer status bar, filter All/Waiting/Active, ปุ่ม "โอน"/"คืนให้ทีม", CUSTOMER INFO (LINE ID/Session/ACTIVITY/EXPORT CSV PDF)
4. **Chat Histories** — subtitle, placeholder ค้นหา, เวลา "N นาทีที่แล้ว", mask ดอกจัน, ผลค้นหาจับกลุ่มต่อคน, หน้ารายละเอียด export CSV/TXT
5. **Friend Histories** — คอลัมน์ Chat Mode + Since, หัว "ประวัติเพื่อน", ปุ่ม "ประวัติ", DateRangePicker + ล้างตัวกรอง, สถานะ BLOCKED, หน้า `friends/history` ทั้งหน้า (stat cards + timeline)
6. **Broadcast** — footer + pagination, การ์ด Reply Object ใบที่ 4, ชื่อแคมเปญ, ตัวนับ 5000, dry-run "ทดลองส่ง", ปุ่ม "บันทึกแบบร่าง"/"ส่งเลย", `DateTimePickerTH`
7. **Auto-Replies** — คอลัมน์สถานะ + toggle switch, dialog "สร้างและตั้งค่าต่อ"/"สร้างอย่างเดียว", หน้า [id] ฟอร์มแก้ match types 4 / reply types 9, banner `?created=1`
8. **Canned Responses** — คอลัมน์หมวดหมู่/สถานะ/ใช้ไป, model `category`/`is_active`/`usage_count`, label "(พิมพ์ / คำ เพื่อเรียก)", ปุ่มยกเลิกแบบ ghost, DetailModal
9. **Reply Objects** — Internal Name + Grouping Category, LIVE PREVIEW คู่ CONTENT, QuickReplyEditor, Universal ID label/placeholder, หน้า new เต็ม, DetailModal
10. **Rich Menus** — thumbnail รูปจริง, ปุ่มลบ, pill 8 สถานะ, เกต canPublish, หน้า new 3 การ์ด (Basic/Template/Design & Sync) + Change Template + กล่องเหลือง + แสดงผล 3 radio, หน้า edit ฟอร์มเต็ม + Area Actions, aliases ตาราง 4 คอลัมน์, insights
11. **SessionTimeoutWarning** — modal เตือนเซสชันหมดอายุ inactivity 30 นาที เตือนก่อน 5 นาที (`SessionTimeoutWarning.tsx` + `useSessionTimeout.ts`)
12. **LIFF SDK** — ตรวจแล้ว: หัวงัวโหลด CDN `edge/2` ลอย ไม่มี npm `@line/liff` ซึ่งตรงกับทางแก้ของ jsk (PR #288 ปลด npm 2.27.3 แล้วใช้ CDN นี้) — **ไม่ต้องทำอะไร**

### ออก (ไม่ทำในรอบนี้)

- design token / ธีม jsk (คง oklch หัวงัว)
- backend Python ของ jsk — แปลงเฉพาะส่วนที่หน้าต้องใช้ (soft-delete, fields ใหม่)
- `request-v2` LIFF ปุ่มออก (jsk ก็ค้าง follow-up)
- กวาดคอมเมนต์เก่าของ jsk (~145 จุด) — คนละงาน
- เทสต์ flake ของ jsk

## เกณฑ์ยอมรับ (รายหน้า — เทียบ screenshot + โค้ด jsk ทุกข้อ)

- [ ] sidebar: ลำดับ/ป้าย/กลุ่ม ตรง `layout.tsx:193-201`
- [ ] ทุกหน้ามี PageHeader (h1 + subtitle + ปุ่มขวาบน) แบบ `PageHeader.tsx`
- [ ] ทุกข้อใน gap list ทั้ง 10 ข้อปิด — ตรวจแบบ side-by-side กับ screenshot
- [ ] SessionTimeoutWarning ทำงานคู่ `token.expiresAt` — ต่อเวลาได้แค่ตัวเตือน ไม่หลอกว่าต่อ JWT
- [ ] LIFF pin เวอร์ชันตายตัว
- [ ] `npx tsc --noEmit` / `npx eslint .` / `npx vitest run` ผ่าน
- [ ] contrast gate ไม่พัง (`npx tsx scripts/check-contrast.ts`)
- [ ] แก้ stale test: `friends-client.bulk.test.tsx:56` ชื่อ test อ้างคอลัมน์ Chat Mode/Since — ต้อง assert จริงหรือแก้ชื่อ

## เงื่อนไข

- PDPA: CID hash, audit log, rate limit ที่มีอยู่ไม่ถูกลดทอน
- auth: `requireStaff`/`requireStaffApi` ทุกหน้าคงเดิม
- soft-delete (นโยบาย PR #291): `DELETE` = ตั้ง `is_active=false` กู้ด้วย PUT — ใช้กับ canned/reply-objects/auto-replies ที่ port มา
- ข้อความ UI ตรง jsk ตัวอักษร — คอมเมนต์โค้ดยังไทยตาม convention หัวงัว (§ prefix คงไว้)
- TDD: test ก่อนทุก logic ใหม่ (soft-delete, session timeout, fields ใหม่)

## ตัวชี้วัด

- gap list 10 ข้อปิดครบ + ผ่าน review gate เทียบภาพ
- ไม่มีข้อ "เหมือนแล้ว" ที่พิสูจน์ด้วยภาพไม่ได้
