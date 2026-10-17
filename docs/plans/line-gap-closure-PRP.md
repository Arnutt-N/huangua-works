# PRP-Plan — ปิดช่องว่างระบบ LINE (P1–P5)

> คู่กับ `docs/plans/line-gap-closure-PRD.md` · ตาม `AGENTS.md` §3 (PRP-Plan) + §4 (Review Gate)
> Skills: karpathy (surgical) · pstack poteto Feature playbook (throughput checkpoint + verifiable units) · mattpocock codebase-design (data shape ก่อน logic) · `security-review` เฉพาะ T5 · `frontend-a11y` เฉพาะ T1 UI
> ⚠️ **Review Gate:** ไฟล์นี้หยุดก่อนเขียนโค้ด รอผู้ใช้ confirm โดยเฉพาะ decision ที่ flag ไว้

## Throughput checkpoint (poteto Feature step 3)

- **Blocking first steps.** T1 ต้องตัดสิน storage/serve path ก่อน (ใช้ S3 เดิมผ่าน `src/lib/storage.ts` + ตาราง `media_files` ที่มีอยู่) เพราะ T3 targeted broadcast และ T4 media reply object จะใช้ path เดียวกัน ห้ามสร้างที่เก็บแยกซ้ำ
- **Independent workstreams.** หลัง gate นั้น T1, T2, T4 ขนานกันได้ (คนละไฟล์หลัก) T3 แตะ broadcast service ร่วมกับ T1 เฉพาะ client จึงเริ่มหลัง T1 merge หรือ branch จาก T1
- **Shared mutable state.** ไฟล์ร่วมที่ชนกันมีสองไฟล์คือ `src/lib/db/schema.ts` และ migration ใหม่ แต่ละ tranche ต้องสร้าง migration ของตัวเองและ rebase ตามลำดับ ไม่ merge migration จากหลาย branch พร้อมกัน (separate-before-serializing เฉพาะจุดนี้ที่ต้อง serialize จริง)
- **Smallest safe decomposition.** 1 PR ต่อ tranche ตาม PRD ไม่รวม P1+P2 ใน PR เดียว เพราะ T1 มีผลผู้ใช้สูงสุดและต้องพิสูจน์ก่อน ส่วน T5 แยกเดี่ยวเสมอเพราะเป็น migration หลายขั้น

## Data shapes ก่อน logic (model-the-domain)

- **สื่อเข้า:** ใช้คอลัมน์ `chat_messages.mediaUrl` ที่มีอยู่แล้ว + `metadata` เก็บ `{ lineMessageId, contentType, sizeBytes, skipped?: 'too_large'|'unsupported'|'download_failed' }` ไม่เพิ่ม boolean กระจัดกระจาย
- **CSAT:** ตารางใหม่ `chat_csat_responses (id, conversationId unique, score 1..5, createdAt)` ค่า unique ต่อห้องทำให้การกดซ้ำไม่บิดสถิติ สถานะไม่ต้องมี enum เพิ่ม
- **SLA:** ไม่สร้าง state ใหม่ คำนวณจาก timestamp ที่มีและที่จะบันทึกตอนเปลี่ยนโหมด (`waitingSince` ใน `metadata` ของ conversation ผ่าน `changeMode` ทางเดียว) ค่า threshold อยู่ใน `chat_settings` คีย์ `chat_sla`
- **Friend events:** ตาราง `line_friend_events (id, lineUserId, event, createdAt)` + `refollowCount` คำนวณจาก event ไม่เก็บตัวเลขซ้ำที่ต้อง sync
- **Broadcast target:** ใช้ fields เดิมใน `chat_broadcasts` (`target`, `totalRecipients`, `successCount`, `failedCount`) ค่า `target` เป็น discriminated shape ใน JSON (`{ kind: 'all' } | { kind: 'user_ids', ids: string[] }`) เก็บ failed เป็น SHA-256 hash ของ line user id เท่านั้น
- **Pseudonym:** `line_users` เพิ่ม `lineUserIdHash` (unique index) และ `lineUserIdEncrypted`; lookup ทุกจุดผ่าน helper เดียวในโมดูล identity ใหม่ ไม่ให้โค้ดอื่นสร้าง hash เอง

## Dependency graph

```text
Gate A: storage decision (T1 ออกแบบ) ──► T1 media ──► T3 broadcast (ใช้ client/storage ร่วม)
                                      ├─► T2 CSAT+SLA (อิสระ ใช้แค่ postback/mode)
                                      └─► T4 reply types (อิสระ ใช้แค่ parser/UI)
T5 pseudonym: แยกเดี่ยว expand ──► backfill ──► contract (3 PR ย่อย ห้ามรวม)
```

## T1 — สื่อจาก LINE เข้า + แสดงผล (P1)

**Branch:** `feat/line-inbound-media`

| Action | Path | รายละเอียด |
| --- | --- | --- |
| CREATE | `src/lib/line/media-ingest.ts` | ดึง content จาก `LINE_DATA_BASE/message/{id}/content` ผ่าน circuit breaker เดิม, stream พร้อมเพดานขนาด, ตรวจ magic bytes, อัปโหลดผ่าน `uploadFile` (`src/lib/storage.ts`), คืน `{ url, contentType, sizeBytes }` หรือ skipped reason |
| MODIFY | `src/lib/line/client.ts` | เพิ่ม `getMessageContent(messageId)` เป็น boundary เดียวของ LINE data API ไม่ให้ engine ยิง fetch เอง |
| MODIFY | `src/lib/line/conversation/message-service.ts` | `recordInboundMessage` รับ `mediaUrl` + metadata เพิ่มเติม (คอลัมน์มีอยู่แล้ว ไม่ต้อง migration) และ broadcast payload มี `mediaUrl` |
| MODIFY | `src/lib/line/bot/engine.ts` | สาขา image/file/video/audio เรียก media-ingest ก่อนบันทึก ล้มเหลวต้องบันทึก placeholder ต่อ ไม่ throw ออก webhook |
| MODIFY | `src/app/admin/chat/_components/message-bubble.tsx` | branch image แสดงรูปพร้อม alt text และลิงก์เปิดต้นฉบับ, file/video/audio แสดงลิงก์ดาวน์โหลดพร้อมชื่อชนิดไฟล์ รองรับ keyboard และ screen reader ตาม frontend-a11y |
| CREATE/MODIFY | tests ข้างเคียง | unit: ingest สำเร็จ/เกินขนาด/ชนิดไม่ตรง/download ล้ม; bubble render รูปและ fallback |

**Dependency order:** client boundary → ingest → record → engine → UI
**Test strategy:** `npx vitest run src/lib/line/media-ingest src/app/admin/chat` + integration ข้อความรูปเข้าแล้วมี mediaUrl (Docker stack)
**Risks:** S3 ไม่ได้ตั้งค่าใน dev (`isStorageConfigured()` false) ต้อง fallback เป็น skipped พร้อม log ไม่ใช่ล้มทั้งข้อความ; รูปที่ LINE ให้เป็นชั่วคราว ต้องดึงทันทีใน webhook ห้าม deferred ข้ามวัน

## T2 — CSAT + SLA ฝั่งแชท (P2)

**Branch:** `feat/line-chat-csat-sla`

| Action | Path | รายละเอียด |
| --- | --- | --- |
| MODIFY | `src/lib/db/schema.ts` + migration ใหม่ | ตาราง `chat_csat_responses` (unique ต่อ conversation) |
| CREATE | `src/lib/line/chat/csat.ts` | สร้าง Flex สำรวจ + บันทึกคะแนน (validate 1..5 ที่ boundary, ซ้ำห้องเดิมคืนผลเดิม) |
| MODIFY | `src/lib/line/conversation/mode-service.ts` | ตอนเปลี่ยนเป็น `resolved` สำเร็จให้ต่อ CSAT send เข้า outbox/announce หลัง commit เท่านั้น |
| MODIFY | `src/lib/line/bot/engine.ts` | postback branch `csat|<conversationId>|<score>` ก่อน confirm protocol เดิม ข้อมูลผิดรูป log แล้วจบ ไม่ตอบซ้ำ |
| CREATE | `src/lib/line/chat/sla.ts` | คำนวณ queue wait จาก `waitingSince` ที่ `changeMode` ประทับตอนเข้า `waiting_handoff`, FRT จากข้อความ admin แรก, resolution จาก `resolvedAt` |
| MODIFY | admin chat dashboard/queue component ที่เกี่ยวข้อง | แสดงห้องเกิน SLA พร้อม threshold จาก `chat_settings.chat_sla` |
| OPTIONAL | `src/lib/line/bot/handoff.ts` | wire `sendNotification` (Telegram) ตอน handoff สำเร็จ ไม่ผูก acceptance |

**Dependency order:** schema → csat service → mode hook → postback → sla calc → UI
**Test strategy:** unit csat validate/dedup, sla คำนวณเวลาจาก fixture เวลา, integration ปิดห้องแล้วมีแถว CSAT เมื่อกดคะแนน
**Risks:** ห้องที่ปิดก่อน feature นี้ไม่มี `waitingSince` ต้องแสดงเป็นไม่มีข้อมูล ไม่ใช่ 0; การส่ง CSAT ห้ามทำให้ close ล้ม (best-effort หลัง commit)

## T3 — Friend events + targeted broadcast (P3)

**Branch:** `feat/line-friend-broadcast-target` (เริ่มหลัง T1 merge)

| Action | Path | รายละเอียด |
| --- | --- | --- |
| MODIFY | `src/lib/db/schema.ts` + migration ใหม่ | ตาราง `line_friend_events` + ตาราง `chat_broadcast_failed_recipients (broadcastId, recipientHash, attempts, lastError)` |
| MODIFY | `src/lib/line/bot/engine.ts` | follow/unfollow/refollow บันทึก event (follow เดิมยังส่ง welcome เหมือนเดิมทุกอย่าง) |
| MODIFY | `src/lib/line/broadcast-service.ts` | ใช้ `target` เดิมใน schema: all → broadcast API, user_ids → `multicast()` ชุดละไม่เกินเพดาน LINE, retry 3 ครั้งระดับชุด, บันทึก failed hash และอัปเดต success/failed/total ให้ตรง |
| MODIFY | admin broadcasts route/UI ที่เกี่ยวข้อง | เลือกกลุ่มเป้าหมายได้, dry-run นับเฉพาะกลุ่ม, หน้า detail เห็นตัวเลขและจำนวน failed |
| CREATE/MODIFY | `src/lib/line/broadcast-service.test.ts` | ชุดล้มบางส่วน, retry ครบ, hash ไม่เก็บ raw id |

**Dependency order:** schema → friend events → delivery → UI
**Test strategy:** `npx vitest run src/lib/line/broadcast-service` + integration follow/unfollow บันทึก event
**Risks:** ห้ามเก็บ raw line user id ในตาราง failed (ใช้ hash เท่านั้นสอดคล้อง T5); multicast ล้มเป็นรายชุดไม่ใช่รายคน ข้อความใน UI ต้องบอกระดับชุดตามจริง

## T4 — Reply object types + welcome placeholders (P4)

**Branch:** `feat/line-reply-objects-extended`

| Action | Path | รายละเอียด |
| --- | --- | --- |
| MODIFY | `src/lib/db/schema.ts` | ขยาย `replyObjectTypeEnum` เพิ่ม `sticker, video, audio, location, imagemap, text_v2` (migration enum ต้องตรวจว่า Postgres เพิ่มค่าได้โดยไม่ rewrite ตาราง) |
| MODIFY | `src/lib/line/bot/response-parser.ts` | `resolveObjectRef` รองรับ type ใหม่ + `quickReply` เป็น modifier ท้ายข้อความ (derive จาก payload ไม่สร้าง state แยก) |
| MODIFY | admin reply-objects UI/schema validation ที่เกี่ยวข้อง | สร้าง/แก้ type ใหม่ได้พร้อม validate payload ที่ boundary |
| MODIFY | `src/lib/line/bot/welcome.ts` | แทนค่า `{display_name}` และ `{follow_count}` ด้วยการ replace ธรรมดา (ไม่ใช่ format string) ไม่มีข้อมูลให้แทนด้วยค่าว่าง |

**Dependency order:** enum → parser → UI → welcome
**Test strategy:** unit parser ต่อ type, welcome มี/ไม่มี display name, migration generate ได้
**Risks:** ชนิดที่ LINE API ไม่รับ payload รูปที่ admin สร้าง ต้อง fail ตอน save ไม่ใช่ตอนบอทส่ง

## T5 — Pseudonymize LINE user id (P5) — 3 PR ย่อย

**Branches:** `feat/line-id-pseudonym-expand` → `-backfill` → `-contract`

1. **Expand:** เพิ่ม `lineUserIdHash` + `lineUserIdEncrypted` ใน `line_users` (และตัวชี้ใน `chat_conversations` ตาม design ที่เลือก), helper `src/lib/line/identity.ts` (HMAC lookup + encrypt/decrypt) ใช้ `CID_HMAC_KEY` pattern เดิมหรือ key แยก `LINE_ID_HMAC_KEY` พร้อมลงทะเบียนใน `scripts/verify-env.ts` แบบ fail-closed
2. **Backfill:** script idempotent ใน `scripts/` เติม hash/encrypted จาก plaintext เดิมเป็นชุด ตรวจจำนวนครบก่อนไปขั้นต่อไป หยุดและรายงานเมื่อเจอแถวที่แปลงไม่ได้
3. **Contract:** เปลี่ยน lookup ทุกจุดให้ใช้ hash, อ่าน raw ผ่าน decrypt helper เท่านั้น, จึงค่อย drop คอลัมน์ plaintext ใน migration แยก (ห้ามอยู่ใน PR เดียวกับ expand)

**Test strategy:** contract test แบบเดียวกับกลุ่ม `*-contract` เดิม (import โมดูลจริง), integration lookup หลัง backfill, test ว่าไม่มี key ใน production-like env แล้ว fail-closed
**Risks:** จุดที่เทียบ `lineUserId` ตรงมีหลายไฟล์ ต้องค้น exhaustive ด้วย `grep -rn "lineUserId"` ก่อนเริ่ม ไม่ใช่ดูจาก graft อย่างเดียว; การ drop คอลัมน์เป็น irreversible ต้องมี backup/rollback plan ใน PR description

## Appendix — Design alternatives ที่ตัดสินแล้ว

| ประเด็น | ทางที่เลือก | ทางที่ตัดทิ้ง |
| --- | --- | --- |
| เก็บไฟล์สื่อ | S3 เดิมผ่าน `src/lib/storage.ts` + `media_files` | เก็บ binary ใน Postgres (jsk-app ทำ แต่ขัด pattern repo นี้และบวม DB) |
| SLA state | คำนวณจาก timestamp + `waitingSince` ใน metadata | ตาราง SLA แยก (state ซ้ำซ้อน sync ยาก) |
| Broadcast failed | เก็บ hash ของผู้รับ | เก็บ raw id (ชน T5) |
| T5 migration | expand → backfill → contract 3 PR | เปลี่ยนคอลัมน์ใน PR เดียว (rollback ไม่ได้) |

## Review Gate checklist

- [ ] PRD ตรงคำขอเดิม ไม่ scope creep (ไม่รวม booking/WS/dedup lock)
- [ ] PRP ทุก path มีอยู่จริงใน codebase (ตรวจแล้วตอนเขียน ยกเว้นไฟล์ CREATE ที่ระบุชัด)
- [x] Decision ที่ confirm แล้ว: (1) เพดานไฟล์ T1 = **10 MB** ตาม repo (2) เตือน SLA ของ T2 = **เฉพาะ admin UI** ไม่ยิง notification (3) T5 ใช้ **key แยก `LINE_ID_HMAC_KEY`**
- [x] ผู้ใช้ confirm แล้ว เริ่ม T1 ได้
