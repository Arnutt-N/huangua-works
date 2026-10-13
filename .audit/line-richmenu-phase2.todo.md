# todo — R1 อัปรูปเมนู (Feature playbook, owner: main session)

Steps verbatim จาก playbooks/feature.md:

- [x] 1. `how` over the affected subsystem. (done: rich-menu-service.ts, rich-menus-client.tsx, sync/publish routes, admin-api.ts, audit.ts อ่านแล้วในสโคป PRP)
- [x] 2. `architect` for parallel design exploration. (done light: ทรงล็อกตาม sync route ข้างกัน + กฎ validate จาก jsk-app — ไม่มี design space คู่แข่งที่คุ้ม fan-out, documented below)
- [ ] 3. Throughput checkpoint:
  - Blocking first steps: อ่าน sync route + client.ts exports + admin-api helper ก่อนเขียน (gate ก่อนลงมือ)
  - Independent workstreams: n/a — งานก้อนเดียว 5 ไฟล์ผูกกัน (route→service มีแล้ว→admin-api→UI→audit) แยกคนทำไม่ได้โดยไม่ชน
  - Shared mutable state: n/a — ไม่มี state แชร์ระหว่าง worker (single owner)
  - Smallest safe decomposition: single owner คือ main session — เหตุผล: ไฟล์เล็ก ผูกกันหมด context อยู่ในหัวแล้ว ส่ง subagent ต้องถ่าย context ใหญ่กว่า gain; review separation ได้จาก gates + user review
- [x] 4. Delegate code-writing → single owner (main session) with scope: `src/lib/audit.ts` (+1 action), `[id]/upload/route.ts` (ใหม่, mirror sync route), `admin-api.ts` (+1 method), `rich-menus-client.tsx` (+ปุ่ม), `route.test.ts` (ใหม่, TDD red ก่อน). Data shape: multipart FormData {file} → Buffer → uploadMenuImage(id, buffer) → {ok, error?}. Success criteria ตาม PRD R1.
- [x] 5. Verify on matching surface: vitest 6/6 + tsc clean + eslint clean (แก้ a11y input 1 จุด)
- [x] 6. Rebase into small ordered commits: 2b3d9fa (R1 เดียว + docs Phase 2)
- [x] 7. Interrogate: skip — design ไม่ contested (mirror ของเดิม + กฎจาก jsk-app report)
- [x] R1 DONE (`2b3d9fa`) · R2 DONE (`6ed0d1c`)
- [ ] 8. Opening a PR: skip รอบนี้ — เปิด PR รวมหลัง R3 (R1+R2 commit ค้างบน branch)
