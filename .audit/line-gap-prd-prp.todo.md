# todo — line-gap-prd-prp (PRD+PRP จาก gap analysis P1-P5)

## Feature playbook (poteto-mode) — steps verbatim
- [x] 1. `how` over the affected subsystem. (ทำแล้ว: gap analysis + verify รอบก่อน)
- [x] 2. `architect` for parallel design exploration. — skip: subagent dispatch ใช้ไม่ได้ใน session นี้ (opus ไม่มี key, inherit-parent timeout 3 รอบก่อนหน้า) แทนด้วยตาราง design alternatives ใน PRP §Appendix
- [ ] 3. Write the throughput checkpoint as four todo items.
  - [ ] Blocking first steps: gates ก่อน fan-out (P1 storage decision)
  - [ ] Independent workstreams: P1/P2/P3 คนละไฟล์ ขนานได้หลัง schema gate
  - [ ] Shared mutable state: แยกตาม tranche/PR คนละ branch ไม่ serialize ยกเว้น schema.ts + schema migration (shared file)
  - [ ] Smallest safe decomposition: 1 PR ต่อ gap (P1..P5) เรียงตามผลกระทบ
- [ ] 4. Delegate code-writing to a subagent — skip ใน phase นี้: deliverable คือ PRD+PRP และ AGENTS.md Review Gate บังคับหยุดก่อนเขียนโค้ด รอ user confirm
- [ ] 5. Verify on the matching surface. (phase นี้: รัน prp-validate หลังเขียน)
- [ ] 6. Rebase into small, ordered commits. — skip: ยังไม่มีโค้ด
- [ ] 7. If the design is contested, `interrogate` before shipping. — defer ไปตอน Review Gate
- [ ] 8. Run Opening a PR. — หลัง user อนุมัติแผน + implement

## Task todos
- [x] Branch `docs/line-gap-prd-prp`
- [x] เลือก skills (karpathy baseline, pstack process, mattpocock thinking, security-review + frontend-a11y เฉพาะ tranche)
- [x] เขียน PRD `docs/plans/line-gap-closure-PRD.md`
- [x] เขียน PRP `docs/plans/line-gap-closure-PRP.md`
- [x] Review Gate: validate plan (check-plan รันแล้ว ฟอร์แมต AGENTS PRP ชน skeleton ของ poteto จึงรายงานเป็น format mismatch ไม่ใช่ข้อผิดพลาด) + สรุปให้ user confirm ก่อน implement
