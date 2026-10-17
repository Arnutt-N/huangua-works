# PRD — ปิดช่องว่างระบบ LINE (จาก Gap Analysis P1–P5)

> อ้างอิง: `secrets/docs/jsk-app/huangua-works-line-gap-analysis.md` (verify กับโค้ดจริงแล้ว 17 ต.ค. 2569)
> Skills ที่ใช้: karpathy-guidelines (baseline) · pstack/poteto-mode (process + sequence-verifiable-units, model-the-domain, boundary-discipline) · mattpocock (codebase-design สำหรับ tranche decomposition) · security-review (เฉพาะ T5) · frontend-a11y (เฉพาะ T1 UI)
> สถานะ: **รอ Review Gate** — ยังไม่เขียนโค้ดจนกว่าจะ confirm

## ปัญหา / ความต้องการผู้ใช้

ระบบรับเรื่องร้องเรียน อบต.หัวงัวมีท่อ LINE ครบ แต่ช่องว่าง 5 จุดกระทบผู้ใช้จริง:

1. **ประชาชนส่งรูป/ไฟล์แล้วเจ้าหน้าที่ไม่เห็น** — `handleMessageEvent` (`src/lib/line/bot/engine.ts`) บันทึกแค่ `messageType: 'image'` ไม่ดึง content จาก LINE และ `MessageBubble` ไม่มี branch แสดงรูป หัวใจของระบบแจ้งเหตุคือหลักฐานภาพ จุดนี้เสียหายหนักสุด
2. **วัดคุณภาพบริการไม่ได้** — ปิดเคส/ปิดห้องแชทแล้วไม่มี CSAT และไม่มี SLA ฝั่งแชท (FRT, เวลารอคิว, เวลาดำเนินการ) คิว `waiting_handoff` ค้างไม่มีใครรู้ (หมายเหตุ: case SLA breach KPI จาก `dueDate` มีอยู่แล้วที่ dashboard คนละตัวกัน ไม่นับซ้ำ)
3. **ไม่รู้พฤติกรรมเพื่อน LINE** — `case 'unfollow': break` ทิ้งเงียบ ไม่มี friend event table จึงไม่รู้อัตรา unfollow/refollow และ broadcast ส่งได้เฉพาะทุกคน ไม่มีกลุ่มเป้าหมายและไม่ track รายที่ส่งล้ม (fields `target/totalRecipients/successCount/failedCount` มีใน schema แล้วแต่ service ไม่ใช้)
4. **คลังข้อความตอบกลับจำกัด** — reply object มี 4 type (`flex/template/text/image`) ขาด sticker/video/audio/location/imagemap/text_v2 + quickReply และ welcome ดึงจาก setting ได้แต่ไม่มีการแทนค่า `{display_name}`/`{follow_count}`
5. **LINE user id เก็บ plaintext** — ทั้ง `lineUsers.lineUserId` และ `chatConversations.lineUserId` ขณะที่ฝั่งเลขบัตรประชาชนเข้ารหัสแบบ HMAC แล้ว (`src/lib/cid-hmac.ts`) ช่องว่างนี้จะโผล่ตอน PDPA audit

## ขอบเขต

### ในขอบเขต (5 tranche, 1 PR ต่อ tranche)

| Tranche | เรื่อง | Gap |
| --- | --- | --- |
| T1 | ดึงและเก็บสื่อจาก LINE (image/file/video/audio) + แสดงใน `MessageBubble` | P1 |
| T2 | CSAT หลังปิดห้องแชท + SLA timer ฝั่งแชท (FRT/queue wait/resolution) | P2 |
| T3 | Friend event table + follow/unfollow handler + targeted broadcast พร้อม failed-recipient tracking | P3 |
| T4 | Reply object เพิ่ม type + quickReply + welcome placeholders | P4 |
| T5 | Pseudonymize LINE user id (HMAC lookup + เข้ารหัส raw) แบบ expand-contract | P5 |

### นอกขอบเขต

- Booking / LIFF booking wizard / ไกล่เกลี่ยหนี้ / Thai date picker ของ jsk-app (domain สำนักงานยุติธรรม ไม่ใช่ของ อบต.)
- เปลี่ยน SSE เป็น WebSocket (SSE + Redis pub/sub เพียงพอสำหรับขนาดปัจจุบัน)
- Webhook dedup lock token (tri-state) — อัตราเกิดซ้ำต่ำ รับได้ ยังไม่ทำ
- Telegram แจ้ง handoff เป็นงานแยกเล็ก ๆ (โครง `src/lib/notify` มีอยู่แล้ว wire เข้า `triggerHandoff` ได้) ใส่เป็น optional ใน T2 ไม่ผูก acceptance

## เกณฑ์ยอมรับ (ตรวจได้)

- **T1:** ส่งรูปเข้า LINE OA → แถว `chat_messages` มี `mediaUrl` ชี้ไฟล์ที่เปิดได้, เจ้าหน้าที่เห็นรูปในห้องแชท, ไฟล์เกินเพดานขนาด/ชนิดไม่รองรับ → ข้อความถูกบันทึกเป็น placeholder พร้อม metadata `skipped` ไม่ทำให้ webhook ล้ม; แถวเดิมที่ไม่มีรูปแสดงผลเหมือนเดิมทุกอย่าง
- **T2:** ปิดห้องแชท (`resolved`) → ประชาชนได้รับ Flex สำรวจความพอใจ, กดคะแนน → postback `csat|<conversationId>|<score>` ถูกบันทึกและคะแนนซ้ำจากห้องเดิมไม่เพิ่มซ้ำ; ห้องที่รอเกิน SLA ที่ตั้งไว้ → มีรายการเตือนใน admin (หรือ audit/notification ตามที่ PRP กำหนด) โดยคำนวณจากเวลารอจริง
- **T3:** follow/unfollow/refollow → มีแถวใน friend events พร้อมนับ `refollow_count`; broadcast แบบระบุกลุ่ม → ส่งด้วย multicast เป็นชุด, รายที่ล้มครบ retry ถูกบันทึกแบบ hash (ไม่เก็บ raw id ในตาราง failed), ตัวเลข success/failed ตรงกับที่ส่งจริง
- **T4:** สร้าง reply object type ใหม่ได้จาก admin และบอทส่งออกได้จริงทาง LINE; welcome ที่มี `{display_name}` แสดงชื่อผู้ใช้จริง, ไม่มีชื่อ → ไม่เหลือข้อความ `{display_name}` ค้างในข้อความที่ส่ง
- **T5:** lookup ผู้ใช้จาก LINE id ทำงานผ่าน HMAC hash, raw id อ่านได้เฉพาะผ่าน decrypt helper, migration แบบ expand-contract ไม่ทำลายข้อมูลเดิมและ rollback ได้โดยไม่เสียข้อมูล (ห้าม drop คอลัมน์ plaintext ใน PR เดียวกับที่เริ่มเขียน hash)

ทุก tranche: `npx tsc --noEmit` + `npx eslint .` + `npx vitest run` เขียว และมี test พฤติกรรม (ไม่ใช่ implementation) ต่อหน่วยตาม AGENTS.md

## ข้อจำกัดและสิ่งที่ต้องยึด

- ทำงานบน branch แยกต่อ tranche ห้ามแตะ `main` ตรง; migration ใช้ `npx drizzle-kit generate` เท่านั้น
- เพดานขนาดไฟล์ **10 MB** (ตัดสินแล้วตาม pattern admin media ของ repo) และต้อง validate ที่ boundary (ชนิดไฟล์จาก magic bytes ไม่เชื่อ header อย่างเดียว)
- สื่อที่เก็บต้องเสิร์ฟผ่าน path ที่เจ้าหน้าที่ auth แล้วเปิดได้ ห้าม public URL เดาสุ่มโดยไม่มีการตรวจสิทธิ์ เว้นแต่พิสูจน์ได้ว่า LINE ต้องดึงโดยไม่มี credential (กรณีนั้นต้องใช้ unguessable id + จำกัดชนิดไฟล์ตาม pattern `src/app/api/line/admin/media`)
- การเปลี่ยนแปลงสี/class ใหม่ใน chat UI ต้องเพิ่มคู่ใน `src/lib/design/contrast-pairs.ts`
- T5 ต้องมี `LINE_ID_HMAC_KEY` แยกเฉพาะ (ตัดสินแล้ว ไม่ใช้ร่วมกับ `CID_HMAC_KEY`) ใน env contract (`scripts/verify-env.ts`) และ fail-closed เมื่อไม่มี key ใน production ห้าม fallback เป็น hash เปลือยแบบเงียบ

## ตัวชี้วัดความสำเร็จ

- สัดส่วนข้อความรูปที่มี `mediaUrl` เปิดได้ ≥ 99% ของข้อความรูปที่ LINE ส่งสำเร็จ (วัดจาก log/metadata ช่วง 7 วันแรก)
- มีคะแนน CSAT เข้าระบบจากห้องที่ปิดจริง และรายงาน SLA ฝั่งแชทคำนวณจากข้อมูลจริง (ไม่ใช่ค่าประมาณ hardcode)
- broadcast เป้าหมายเฉพาะกลุ่มครั้งแรกส่งสำเร็จพร้อมตัวเลข success/failed ตรวจสอบย้อนหลังได้
- PDPA: ไม่มี query ใดในโค้ดใหม่ที่เทียบ `lineUserId` ตรงกับคอลัมน์ plaintext อีกหลัง T5 contract เสร็จ
