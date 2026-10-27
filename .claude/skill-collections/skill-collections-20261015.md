# Agent Skill Collections และเครื่องมือเสริม — ฉบับคัดเลือกใช้งาน

> เอกสารอ้างอิงข้ามโปรเจกต์และข้ามแพลตฟอร์ม
> แพลตฟอร์มเป้าหมาย: Claude Code · Codex (App/CLI) · Cursor · Antigravity · Gemini CLI · GitHub Copilot CLI · Grok Build CLI · Factory Droid · Devin CLI · Kimi Code · OpenCode · Pi · Hermes · Zed · Qwen · Cline · Kilo · Qoder · Mistral Vibe · DeepSeek Harness · MiMo CLI และ MCP clients — ระดับการรองรับจริงดู §12
> อัปเดต: 16 ตุลาคม 2026 (เขียนใหม่ 15 ต.ค. ต่อจากฉบับ 2026-08-15 · ตรวจ repo 38 ตัว: ใหม่ 35 + ตรวจซ้ำ 3 → รับเข้า 27 (skill/pack 23 + companion 4) · ตัดออก 8 · เพิ่มภายหลังอีก 4: CLI-Anything · aidlc-workflows · ReMe · awesome-selfhosted · ดู §22)
>
> 📄 **โฟลเดอร์นี้ standalone** — 3 ไฟล์ในโฟลเดอร์ใช้ประกอบกันได้ครบ คัดลอกทั้งโฟลเดอร์ไปใช้ที่ไหนก็ได้ ทุกลิงก์ชี้ URL ภายนอก
> ไฟล์อ้างอิงเพิ่มเติม (อยู่นอกโฟลเดอร์นี้ — ไม่จำเป็นต่อการใช้ไฟล์ในนี้):
> `skill-collections-changelog.md` (ประวัติทุกรอบ) · `skill-collections-20260815.md` (ฉบับก่อน)

> ⚠️ **ก่อนใช้งาน:** ตัวเลข ⭐ และวันที่ push อยู่ที่ **§3.0 ที่เดียว** พร้อมวันที่ตรวจ ส่วนอื่นอ้างวันที่/license เฉพาะเมื่อจำเป็นต่อการตัดสินใจ (เช่น เงียบนาน, AGPL) และต้องตรงกับ §3.0 · ระบบเหล่านี้อัปเดตบ่อย **ให้เช็ค repo ต้นทาง (§20) ก่อนติดตั้งจริงเสมอ**

---

## 1. TL;DR

Skill ecosystem ควรจัดเป็นหลายชั้น ไม่ควรติดตั้งทุก repository เป็น skill collection พร้อมกัน

```text
Layer 0 — Behavioral baseline (เลือก 1 ตัวเป็น global)
  karpathy (default)  OR  caveman / ponytail (Pilot — mode ค้างทั้ง session + hooks · caveman มีกลุ่ม Cloud ที่ส่งข้อมูลออก)

Layer 1 — Process discipline (เลือก 1 เป็นหลัก)
  superpowers  OR  pstack (หยิบราย skill)

Layer 2 — SDLC collection หลัก (เลือก 1)
  mattpocock OR addyosmani OR ecc OR orchestkit OR aidlc-workflows (Pilot — แทน Layer 1+2 ทั้งคู่)

Layer 3 — Agent-workflow engineering เฉพาะเมื่อจำเป็น (เลือก 1)
  maestro OR ruflo

Domain verticals — เปิดตามชนิดงาน
  founder-skills                     business / GTM / pricing / SOP
  ui-skills | ux-ui-agent-skills     product UI / a11y / design system      (เลือก 1)
  taste-skill | Hallmark             landing / portfolio / redesign         (เลือก 1)
  anti-slop | no-ai-slop             anti-slop ราย surface (UI·code / text)
  Infographic                        data storytelling
  archify | fireworks | diagram-design   technical diagram                  (เลือก 1)
  security-audit-skill               defensive security audit
  reverse-skill | rea                authorized reverse engineering         (restricted, เลือก 1)
  Privacy-Data-Protection-Skills     compliance ราย jurisdiction
  ffmpeg-skill                       media processing
  Atlas · claude-code-best-practice  methodology reference (อ่านเป็นแนวทาง — ไม่ติดตั้ง)

Product-specific packs — เฉพาะ runtime/โปรเจกต์ที่ใช้
  Codex Security · Trigger.dev · typesafe-ai/skills · Unity-MCP

Skill infrastructure — จัดการ collection ไม่ใช่ content
  autoskills · SkillHub · book-to-skill

Hybrid integrations — มี skill adapter แต่ตัวตนหลักเป็น tool
  Graphify | Graft | Understand-Anything   (เลือก 1)
  rtk · witr · WeKnora · claude-ops (pilot) · CLI-Anything (ราย CLI) · ReMe (pilot, memory)

Pure tool/MCP companions — ไม่มี router-facing skill
  headroom, world-intel-mcp, claude-context, TencentDB-Agent-Memory, PageIndex,
  MarkPDFdown, Morphik, olmocr, pdfcraft, pdf-mcp, Scrapy, Promptflow, TEN,
  paperless-gpt, Unstract
```

### 1.1 กรอบความคิด — "2 แกน + verticals"

Layer model บอก *ลำดับการติดตั้ง* ส่วนกรอบนี้บอก *ทำไมบางชุดทับซ้อนกันน้อย* — ชุดที่อยู่คนละแกนมักใช้ร่วมกันได้เพราะเนื้อหาไม่ซ้ำ **แต่ยังต้องตรวจ routing/trigger, context budget, hooks และ project instructions ก่อนเปิดพร้อมกัน**

**แกน A — สร้างซอฟต์แวร์ (SDLC):** จัดชั้นตาม altitude จากพฤติกรรมพื้นฐาน → กระบวนการ → playbook ครบวงจร

```text
ระดับสูง  ┌──────────────────────────────────────────────────┐
(กว้าง)   │  ecc | orchestkit — ทุกอย่าง + domain/hooks         │  หลักร้อย skill
          ├──────────────────────────────────────────────────┤
          │  addyosmani   — full-SDLC playbook (spec→ship)      │  24 skills
          │  mattpocock   — เครื่องมือคิด/engineering            │  ~35 skills
          ├──────────────────────────────────────────────────┤
          │  superpowers | pstack — วินัยกระบวนการ               │  ~14 / ~50
          ├──────────────────────────────────────────────────┤
ระดับล่าง  │  karpathy | caveman | ponytail — พฤติกรรมพื้นฐาน     │  always-on
(แคบ/ลึก)  └──────────────────────────────────────────────────┘
```

**แกน B — วิศวกรรมเวิร์กโฟลว์ของ AI agent เอง (meta-layer):** ทำงาน *บนตัว agent* ไม่ใช่บนโค้ดแอป

```text
          ┌─────────────────────────────────────────────┐
          │  maestro  — audit→fix เวิร์กโฟลว์ AI agent    │  1 core + 24 cmd
          │  + memory / audit log / cost / scorecard     │  + MCP + VS Code ext
          ├─────────────────────────────────────────────┤
          │  ruflo    — orchestration/swarm platform      │  ทางเลือกแทน
          └─────────────────────────────────────────────┘
   ↑ ecc แตะแกนนี้บางส่วน (skill กระจัดกระจาย) · pstack แตะผ่าน `reflect`
   ↑ headroom / rtk เป็น "เครื่องจักร" ลด token ตอน runtime — เสริมแกน B ไม่ใช่ skill
```

**Verticals — เจาะ domain เดียว เสียบข้าง stack ไหนก็ได้:** design · UI · anti-slop · infographic · diagram · business · security · compliance · media

### 1.2 Stack แนะนำทั่วไป

```text
baseline 1 ตัว + process 1 ตัว + SDLC 1 ชุด
                                + vertical เฉพาะงานไม่เกิน 1-2 ชุด
                                + maestro เมื่อเป็น AI/agent workflow
```

### 1.3 กฎสำคัญ

- Layer 0 เปิด global ได้ **ตัวเดียว** — karpathy / caveman / ponytail ต่างสั่งพฤติกรรมพื้นฐานของ agent ซ้อนกันแล้วคำสั่งชนกันเอง
- อย่า stack `addyosmani + ecc` หรือ `orchestkit + ecc` — full-SDLC ทับซ้อนสูง (routing noise)
- อย่าเปิด `superpowers + pstack` เต็มชุดพร้อมกัน — process skill ซ้ำ (tdd, planning, review)
- `aidlc-workflows` เป็น workflow engine ที่คุม process + SDLC ทั้งวงจร — ใช้ **แทน** superpowers/pstack และ SDLC collection ไม่ซ้อน (ติด hook ทุก tool call และตั้ง `Edit(/**)` ในโปรเจกต์ที่ติดตั้ง)
- memory ของ agent เลือกชั้นเดียวต่อโปรเจกต์ (ดู §14.9)
- อย่าเปิด `maestro + ruflo + ECC orchestration` พร้อมกันเป็น baseline
- design direction เลือกตัวเดียว: `taste-skill` หรือ `Hallmark` · product UI เลือกตัวเดียว: `ui-skills` หรือ `ux-ui-agent-skills`
- ถ้าโปรเจกต์/ผู้ใช้มี design-quality rules หรือ frontend-design skill อยู่แล้ว (เช่น `rules/web/design-quality.md`) ให้เลือกฝั่งเดียวเป็นหลัก — อย่าเปิดซ้อนกับ taste-skill / Hallmark / anti-slop
- diagram เลือกตัวเดียวต่อโปรเจกต์ · codebase knowledge layer (Graphify / Graft / Understand-Anything) เลือกตัวเดียว
- `reverse-skill` และ `rea` ต้องมี authorization gate + allowlist + sandbox และเลือกตัวเดียว · งาน defensive ทั่วไปใช้ `security-audit-skill` ก่อน
- MCP/framework/template ไม่ใช่ skill collection แม้ใช้ร่วมกับ agent ได้

**หลักการรวม:** เลือกชุดที่อยู่ **คนละ layer/แกน** ดีกว่าหลายชุดใน layer เดียวกัน — skill ที่ description ซ้ำกันทำให้ router เลือกยากและเปลือง context

---

## 2. เกณฑ์ว่าอะไรนับเป็น Skill Collection

Repository นับเป็น skill collection เมื่อ:

1. มีหนึ่งหรือหลาย `SKILL.md`
2. มี frontmatter อย่างน้อย `name` และ `description`
3. ติดตั้งแล้ว router เลือกโหลดเพื่อเปลี่ยนพฤติกรรม agent ได้
4. มีขอบเขตและ trigger ที่ชัดเจน
5. ไม่ใช่เพียง README, prompt reference, application, framework หรือ MCP server

> จำนวนไฟล์ `SKILL.md` ใน repo **ไม่เท่ากับจำนวน skill** — หลาย repo มี mirror ราย harness (`plugins/` + `skills/`), dev-workflow skill ของ repo เอง หรือ test fixture ปนอยู่ เช่น `ffmpeg-skill` มี 14 ไฟล์แต่ media skill จริงมี 1 ตัว
>
> **ขนาดทั้ง repo ก็ไม่เท่ากับขนาด skill** — สแกน 37 repo (2026-10-16): ตัวที่ `SKILL.md` น้อยกว่า ~3% ของไฟล์ทั้งหมดมีสองแบบ คือ **(ก) product/runtime ขนาดใหญ่** เช่น caveman (1,785 ไฟล์ / 28 `SKILL.md`) · rea (4,057 / 4 — แอป TypeScript) · orchestkit (9,006 / 243) และ **(ข) skill เดี่ยวที่มีตัวอย่าง/asset ปนมาก** เช่น diagram-design (681 / 1) — ห้าตัวนี้จัดจากการเปิดดูองค์ประกอบจริง · WeKnora (5,083 / 5) · Unity-MCP (2,547 / 25) · headroom (2,641 / 0) น่าจะเป็นแบบ (ก) และ Hallmark (286 / 1) น่าจะเป็นแบบ (ข) แต่จัดจากตัวตนที่รู้อยู่ ยังไม่ได้เปิดดู · ตัวเลขอย่างเดียวแยกสองแบบนี้ไม่ได้ — เปิดดูองค์ประกอบแล้วเฉพาะ 5 repo (ตารางเต็มใน `skill-collections-repo-analysis-20261015.md` §8) · **ติดตั้งแบบ skill-only (`npx skills add` หรือ copy เฉพาะโฟลเดอร์ skill) อย่า clone ทั้ง repo เข้า environment ที่มี credential**

### ประเภท

| ประเภท | ความหมาย | การจัดการ |
|---|---|---|
| Core collection | ชุดทั่วไปที่ใช้เป็นฐาน (Layer 0–3) | เลือกอย่างระมัดระวังและ pin version |
| Domain vertical | ชุดเฉพาะชนิดงาน | เปิดเฉพาะเมื่อ task ตรง domain |
| Single skill | skill เดี่ยว | ใช้ได้ แต่ไม่เรียก collection |
| Hybrid pack | skill + CLI/plugin/MCP/framework | ใช้ผ่าน runtime ของผู้ผลิตหรือ pilot แยก |
| Product-specific pack | skill ผูกกับผลิตภัณฑ์/SDK เดียว | ติดตั้งรายโปรเจกต์ |
| Infrastructure | registry/installer/generator | ใช้บริหาร collections ไม่ใช่ content |
| Tool companion | CLI/MCP/service/application | ทำ wrapper skill เมื่อมี use case |
| Reference | ตัวอย่างหรือความรู้ | ไม่ติดตั้งเข้า router โดยตรง |

### คำตัดสิน (ใช้ทั้งเอกสาร)

`Keep` · `Choose one` · `Add selective` (หยิบบาง skill) · `Add opt-in` (เปิดเมื่อสั่ง) · `Restricted` (allowlist + gate) · `Pilot` (ทดลองแยก environment) · `Per-project` · `Companion` · `Reference` · `Excluded`

---

## 3. ตารางเปรียบเทียบหลัก

### 3.0 ตัวเลขและสถานะการ verify (แหล่งเดียวของตัวเลขในเอกสาร)

**ตรวจผ่าน GitHub API** — คอลัมน์ "ตรวจ" คือวันที่ของตัวเลขแถวนั้น

| Repository | ⭐ | License | pushed ล่าสุด | ตรวจ |
|---|---:|---|---|---|
| awesome-selfhosted/awesome-selfhosted | 327,102 | CC-BY-SA-3.0 (ไฟล์ LICENSE — API ตอบ NOASSERTION) | 2026-10-15 | 10-16 |
| obra/superpowers | 300,059 | MIT | 2026-10-10 | 10-16 |
| mattpocock/skills | 293,079 | MIT | 2026-10-13 | 10-16 |
| affaan-m/ECC | 280,555 | MIT | 2026-10-15 | 10-16 |
| morluto/rea | 259,256 | MIT | 2026-10-15 | 10-15 |
| multica-ai/andrej-karpathy-skills | 220,125 | MIT ตาม README (**ไม่มีไฟล์ LICENSE**) | **2026-04-20** | 10-16 |
| DietrichGebert/ponytail | 164,048 | MIT | 2026-10-15 | 10-15 |
| JuliusBrussee/caveman | 112,117 | Apache-2.0 (เฉพาะ ≥ 3.0.0 — ก่อนหน้านั้น MIT + BSL 1.1) | 2026-10-15 | 10-15 |
| addyosmani/agent-skills | 107,098 | MIT | 2026-10-13 | 10-16 |
| Leonxlnx/taste-skill | 97,462 | MIT | 2026-10-14 | 10-16 |
| tt-a1i/archify | 83,903 | MIT | 2026-10-15 | 10-15 |
| rtk-ai/rtk | 83,442 | Apache-2.0 | 2026-10-15 | 10-15 |
| headroomlabs-ai/headroom | 75,466 | Apache-2.0 | 2026-10-16 | 10-16 |
| ruvnet/ruflo | 75,230 | MIT | 2026-10-15 | 10-16 |
| shanraisshan/claude-code-best-practice | 67,578 | MIT | 2026-10-15 | 10-15 |
| cathrynlavery/diagram-design | 55,678 | MIT | 2026-10-14 | 10-15 |
| HKUDS/CLI-Anything | 53,161 | Apache-2.0 | 2026-09-22 | 10-16 |
| zhaoxuya520/reverse-skill | 42,186 | MIT | 2026-09-22 | 10-16 |
| VectifyAI/PageIndex | 39,135 | MIT | 2026-10-15 | 10-15 |
| virgiliojr94/book-to-skill | 34,934 | MIT | 2026-10-12 | 10-15 |
| Tencent/WeKnora | 34,146 | **other** | 2026-10-15 | 10-15 |
| Nutlope/hallmark | 30,164 | MIT | 2026-08-06 | 10-16 |
| cloudflare/security-audit-skill | 29,744 | MIT | 2026-09-14 | 10-15 |
| pranshuparmar/witr | 22,700 | Apache-2.0 | 2026-10-04 | 10-15 |
| allenai/olmocr | 19,747 | Apache-2.0 | 2026-03-25 | 10-15 |
| petergyang/no-ai-slop | 12,388 | MIT | 2026-09-02 | 10-15 |
| yizhiyanhua-ai/fireworks-tech-graph | 11,736 | MIT | 2026-09-05 | 10-15 |
| cursor/plugins (pstack) | 11,510 | MIT (Lauren Tan) | 2026-10-15 | 10-15 |
| ibelick/ui-skills | 9,781 | MIT | 2026-10-15 | 10-16 |
| PDFCraftTool/pdfcraft | 9,294 | **AGPL-3.0** | 2026-10-14 | 10-15 |
| antvis/Infographic | 7,001 | MIT | 2026-08-21 | 10-16 |
| miqdadbadjuber/anti-slop | 6,148 | MIT | 2026-10-13 | 10-15 |
| awslabs/aidlc-workflows | 5,336 | MIT-0 | 2026-10-16 | 10-16 |
| IvanMurzak/Unity-MCP | 4,463 | Apache-2.0 | 2026-10-15 | 10-15 |
| agentscope-ai/ReMe | 3,625 | Apache-2.0 | 2026-10-16 | 10-16 |
| typesafe-ai/skills | 2,704 | MIT | 2026-09-12 | 10-15 |
| michael-denyer/pstack-claude | 2,118 | MIT | 2026-10-14 | 10-15 |
| kajisho5/ffmpeg-skill | 1,952 | MIT | 2026-10-15 | 10-15 |
| plugin87/ux-ui-agent-skills | 1,823 | MIT | 2026-10-10 | 10-15 |
| sharpdeveye/maestro | 591 | MIT | **2026-04-29** | 10-16 |
| Lifecycle-Innovations-Limited/claude-ops | 545 | MIT | 2026-10-14 | 10-15 |
| ognjengt/founder-skills | 530 | MIT | 2026-05-18 | 10-16 |
| syahiidkamil/Software-Engineer-AI-Agent-Atlas | 401 | **ไม่มี** | 2026-06-25 | 10-15 |
| mukul975/Privacy-Data-Protection-Skills | 307 | Apache-2.0 | **2026-03-16** | 10-15 |
| yonatangross/orchestkit | 293 | MIT | 2026-10-15 | 10-15 |
| I-CAN-hack/pdf-mcp | 79 | MIT | 2026-07-30 | 10-15 |

> ⚠️ **maintenance cadence ต้องเข้าไปอยู่ในการตัดสิน choose-one** ไม่ใช่ดูเนื้อหาอย่างเดียว:
> - เงียบนาน: `maestro` (~5.5 เดือน) · `karpathy-skills` (~6 เดือน) · `Privacy-Data-Protection-Skills` (~7 เดือน) · `olmocr` (~6.5 เดือน) · `founder-skills` (~5 เดือน) · `Atlas` (~3.5 เดือน)
> - community เล็ก (⭐ ต่ำกว่า ~600): `maestro` · `claude-ops` · `founder-skills` · `Atlas` · `Privacy-Data-Protection-Skills` · `orchestkit`
> - ดาวไม่ใช่ตัวชี้วัดคุณภาพ — moat ของ maestro (memory/audit/cost/scorecard) ยังไม่มีใครแทน แต่ควรรู้ว่าเสี่ยงหยุดพัฒนา

**ยังไม่ verify:**

| ข้อมูล | สถานะ |
|---|---|
| จำนวน skill ของ 7 core collections เดิม | นับครั้งล่าสุด 2026-07-12 — ใช้เป็นตัวเลขโดยประมาณ |
| License ของ companions เดิม 18 รายการ | ยังเป็น `ต้องตรวจ` |
| Commit hash ของ candidate ทุกตัว | ยังไม่ pin |
| frontmatter นอก 13 ไฟล์ + caveman 22 + ponytail 6 ที่ audit แล้ว | ยังไม่ audit |
| hooks ของ caveman บน Codex/Cursor (`.codex/hooks.json`, `hooks/hooks-cursor.json`) | มีไฟล์แต่ยังไม่ได้อ่านเนื้อหา |
| ค่าเริ่มต้นแน่ชัดของ routing ใน `caveman setup` · payload ของ **routing** จริง (`proxy/internal/gateway/route.go`, `cloudlink/link.go`) ว่าส่งตรงกับข้อความที่ CLI ประกาศหรือไม่ · `provider-logins.ts` | ยังไม่ได้อ่าน (telemetry ฝั่ง `events.go` ตรวจแล้ว — ตรงกับที่ประกาศ) |
| hooks ของ ponytail บน Copilot/Cursor/Qoder | ยังไม่ได้อ่าน (อ่านเฉพาะ `ponytail-activate.js` ฝั่ง Claude/Codex) |
| aidlc-workflows: ไฟล์ที่ติดตั้งจริงต่างจาก template ใน repo หรือไม่ (`bun` vs `aidlc`) · เนื้อ native binary · `engine hook *` ทำอะไรกับข้อมูล `record-human-turn` | อ่านแค่ README · install guide (คีย์เวิร์ด) · `harness/claude/settings.json` + `.mcp.json` · SKILL.md 2 ตัวบางส่วน |
| CLI-Anything: คุณภาพ/ความปลอดภัยรายตัวของ harness จากชุมชน · สคริปต์ของ `cli-hub` | อ่านแค่ README ส่วนต้น + sample `blender` SKILL.md |
| ReMe: โค้ด `auto_memory.py` (hook ที่จับบทสนทนา) · `mcp_bridge.py` · ข้อมูลที่ส่งออกจริงเมื่อเปิด `auto_memory` | อ่านแค่ README ส่วนต้น + `skills/reme_memory/SKILL.md` + รายการไฟล์ integration |
| path ที่ hooks ของ orchestkit เขียนจริง (`mkdirSync` ใน `first-run-setup.ts` ฯลฯ) และต้นทางของการเขียน "rules file" ที่เห็นใน bundle | ยังไม่ได้ตรวจ (อ่านแค่ 5 ไฟล์จาก 7 ใน `src/hooks/src/setup/`) |
| เนื้อ `archify.zip` (5 MB) ใน repo archify | ยังไม่ได้เปิดดู |
| องค์ประกอบของ repo ที่ `SKILL.md` < 3% อีก ~11 ตัว | เปิดดูแล้วเฉพาะ caveman · rea · orchestkit · diagram-design · archify (repo-analysis §8) |

### 3.1 ตารางเปรียบเทียบ 7 core collections เดิม

| มิติ | karpathy | superpowers | mattpocock | addyosmani | ecc | maestro | taste-skill |
|------|----------|-------------|------------|------------|-----|---------|-------------|
| **แกน** | A (baseline) | A (process) | A | A | A (+แตะ B) | **B** | **A (vertical: frontend design)** |
| **จำนวน** | 1 skill | ~14 | ~35 | 24 | หลายร้อย (skills+agents+commands) | 1 core + 24 cmd + MCP (10 tools) + VS Code ext | 13 (1 หลัก + 12 เสริม) |
| **ตัวตน** | กฎลด LLM mistakes | วินัยกระบวนการ | เครื่องมือคิดวิศวกรรม | playbook ครบ SDLC | framework/marketplace ครบจักรวาล | toolkit วิศวกรรมเวิร์กโฟลว์ของ AI agent | anti-slop design taste |
| **ปรัชญา** | think→simple→surgical→verify | skill-first, rigid | small/composable, anti-vibe-coding | production-grade | ครอบคลุม + เฉพาะทาง | structure > improvisation · measure don't assume | Design Read → 3 Dials · anti-default |
| **จุดเด่น** | surgical changes, goal-driven | systematic-debugging, plans, worktrees | grilling, codebase-design, PRD→issues | doubt-driven, source-driven | domain packs, ภาษา, orchestration | diagnose→fix, memory/audit/cost, `/reflect` | 3 Dials + preset, style variants, imagegen→code |
| **จุดอ่อน** | แคบ | ไม่มี domain/ภาษา | เอน TS | ทับ ecc เกือบหมด | ใหญ่จนเลือกยาก | ไม่แตะ SDLC/โค้ดแอป; ต้อง `/teach-maestro` | ตัวหลัก ~87KB; เฉพาะ marketing pages |
| **เหมาะเมื่อ** | ทุกโปรเจกต์ | งาน eng จริงจัง | อยากคุมกระบวนการคิด | อยากได้ playbook สำเร็จรูป | โปรเจกต์ใหญ่/หลายภาษา | สร้างหรือจูน agent workflow | landing/portfolio/redesign |

### 3.2 ตารางเปรียบเทียบ core candidates ใหม่ (รอบ 2026-10-15)

| มิติ | caveman | ponytail | pstack | orchestkit |
|---|---|---|---|---|
| **Layer** | 0 (baseline) | 0 (baseline) | 1 (process) + แตะแกน B | 2 (SDLC) |
| **แข่งกับ** | karpathy · ponytail | karpathy · caveman | superpowers (+ maestro เฉพาะ `reflect`) | ecc · addyosmani |
| **ขนาด** | 22 skills ไม่ซ้ำ (28 ไฟล์) ใน monorepo ~1,785 ไฟล์ | 6 skills ไม่ซ้ำ (13 ไฟล์) | ~50 dirs (Cursor) · 61 ไฟล์ (port) | 106 skills · 171 hooks ตาม README |
| **องค์ประกอบเสริม** | `commands/*.toml` · `agents/` · plugin Claude/Cursor/Codex/Gemini · hooks 3 ตัว · installer แก้ `settings.json` · proxy/engine (Go) | hooks (Claude/Codex · Copilot · Cursor · Qoder) · plugin v5.2.0 · ฉีด codebase map | playbooks · principles · scripts | hooks จำนวนมาก · plugin ราย harness |
| **สถานะ** | Pilot (baseline ทางเลือก) | Pilot (baseline ทางเลือก) | Choose one กับ superpowers · หยิบราย skill | Choose one กับ ecc |
| **ความเสี่ยงหลัก** | เสียงตอบสั้นแบบ persistent ทับ instruction โปรเจกต์ · กลุ่ม Caveman Cloud ส่ง LLM request ผ่าน gateway | hooks รันทุก session/prompt · ฉีด codebase map · ทิ้ง comment `shortcut:` ในโค้ด | 50 skills ชน process skill เดิม | hooks side effects · community เล็ก |

### 3.3 ตารางเปรียบเทียบ verticals

| Vertical | Domain | รูปแบบ | สถานะ | ชนกับ | ความเสี่ยงหลัก |
|---|---|---|---|---|---|
| founder-skills | business / GTM / pricing / SOP | collection ~9 กลุ่ม | Add selective (3-6 skills) | ECC business · taste-skill (CRO/copy) | claims ต้อง verify · `FOUNDER_CONTEXT.md` อ่อนไหว |
| ui-skills | product UI / a11y / motion | collection + CLI (~7–9 skills) | Add opt-in | **ux-ui-agent-skills** · taste-skill | rules `MUST`/`NEVER` ชน design system |
| ux-ui-agent-skills | design system / a11y / Figma / QA gate | collection 26 ไฟล์ | Choose one กับ ui-skills | ui-skills · taste-skill | ยังไม่ตรวจ adapter |
| taste-skill · Hallmark | landing / portfolio / redesign | collection 13 · single | Choose one | anti-slop (UI) · ux-ui | taste-skill ตัวหลัก ~87KB |
| anti-slop | anti-slop UI / code / copy | collection 6 | Add selective | taste-skill/Hallmark (UI) · no-ai-slop (text) | `copywriting`/`human` ทับ no-ai-slop |
| no-ai-slop | anti-slop text | single | Add selective | anti-slop (text skills) | — |
| Infographic | data storytelling | renderer + skill pack ~5 | Add selective | diagram (ต่ำ) · taste-skill | ผูก DSL/renderer version |
| archify · fireworks · diagram-design | technical diagram | hybrid · hybrid · single | Choose one | Infographic (ต่ำ) | ดู §5.5 |
| security-audit-skill | defensive audit | single (Cloudflare) | Add selective | ECC security · Addy hardening | — |
| reverse-skill · rea | reverse engineering / pentest | router pack · 1 skill + dev skills | Restricted · choose one | ECC security | dual-use · tool bootstrap |
| Privacy-Data-Protection-Skills | GDPR / CCPA / EU AI Act / HIPAA ฯลฯ | collection 824 ไฟล์ | Add selective ราย jurisdiction | ECC `hipaa-compliance` `healthcare-phi-compliance` | ใหญ่มาก · เงียบ ~7 เดือน |
| ffmpeg-skill | media / video | single + 42 scripts + MCP | Add selective | — | — |

---

## 4. Core Collections

> ⭐ / license / วันที่ push ของทุกชุดดู §3.0

### 4.1 karpathy — `multica-ai/andrej-karpathy-skills` · Layer 0

- 1 skill (`karpathy-guidelines`) ~2.5KB · **4 หลักการ:**
  1. **Think Before Coding** — บอก assumption, ถามเมื่อไม่ชัด
  2. **Simplicity First** — โค้ดน้อยสุดที่แก้ปัญหา ไม่เก็งอนาคต
  3. **Surgical Changes** — แตะเฉพาะที่จำเป็น
  4. **Goal-Driven** — นิยาม success criteria ที่ verify ได้ แล้ว loop
- เหมาะกับทุกโปรเจกต์ — **leverage ต่อ token สูงสุดในกลุ่ม** · ให้ user/project instructions มีลำดับสูงกว่าเสมอ
- ข้อควรรู้: README ระบุ MIT แต่ **repo ไม่มีไฟล์ LICENSE** และ push ล่าสุดเมื่อ ~6 เดือนก่อน (§3.0) — ไฟล์เล็กและเป็นพฤติกรรมล้วน ผลกระทบต่ำ แต่ถ้าจะฝังในผลิตภัณฑ์หรือแจกจ่ายให้ทีม ควรขอ license ที่ชัดเจนจากเจ้าของก่อน

### 4.2 caveman — `JuliusBrussee/caveman` · Layer 0 (ทางเลือก — Pilot)

- 22 skills ไม่ซ้ำ (28 ไฟล์ = mirror 6) — **ไม่ใช่แค่ "ตอบสั้น"** (audit frontmatter แล้ว 2026-10-16) แบ่งเป็น 4 กลุ่ม (จัดกลุ่มโดยผู้จัดทำจาก `description` — upstream ไม่ได้แบ่งแบบนี้):
  - **เสียงตอบสั้น (persistent):** `caveman` · `ultracave` · `megacave` (文言文) · `caveman-commit` · `caveman-review` · `caveman-help` · `caveman-stats` — เปิดแล้ว "stays on until stop caveman / normal mode" · trigger กว้าง เช่น "be brief" "less tokens"
  - **ย่อ input / มอบงาน subagent:** `caveman-compress` (ย่อ CLAUDE.md/todo เป็นรูปแบบ caveman — **ส่งข้อความไฟล์ไปยัง model provider**) · `cavecrew` + `caveman-explore` (ให้ subagent investigator/builder/reviewer ทำงานแทน เพื่อให้ context หลักยาวขึ้น)
  - **วินัยงานวิศวกรรม:** `investigate-first` · `lean-build` · `migration` · `safe-refactor` · `surgical-patch` · `verify-and-stop` — ทับกับ karpathy / superpowers / addyosmani
  - **Caveman Cloud (บริการภายนอก):** `caveman-setup` (ต่อ repo ผ่าน **gateway เพื่อวัดทุก LLM request**) · `caveman-discover` · `caveman-evidence-review` · `caveman-manage` · `caveman-optimize` · `caveman-learn` — เป็น observability/experiment ที่มี data egress ไม่ใช่ baseline
- **repo นี้เป็น product monorepo (~1,785 ไฟล์) ไม่ใช่ skill collection ล้วน** (ตรวจ 2026-10-16): skills เป็นแค่ 1 surface · ที่เหลือคือ `proxy/` + `engine/` (Go — runtime/gateway) · `packages/` (CLI/SDK) · `extension/` · `mcp/` · `mem/` · `shrink/` · `browse/` · `installer/` · `supabase/`
- **plugin/commands/agents (ตรวจจากไฟล์ใน repo):** manifest ของ Claude (`.claude-plugin/` + marketplace) · Cursor · Codex (`plugins/caveman/.codex-plugin/`) · Gemini (`gemini-extension.json`) · `commands/*.toml` 5 ตัว · `agents/cavecrew-{investigator,builder,reviewer}.md` + profiles ราย harness (aider · claude · codex · gemini · hermes · kilo · openclaw · opencode · pi · qwen)
- **hooks (อ่าน `src/hooks/README.md`):** `SessionStart` (ทุก source) ฉีด skill ของ mode ที่ active เข้า context และฉีดซ้ำหลัง compaction · `SubagentStart` ส่ง mode ให้ subagent · `UserPromptSubmit` ตรวจ "/caveman" "talk like caveman" "stop caveman" แล้วฉีด reminder ทุก turn · เก็บ mode ต่อ session ที่ `~/.claude/.caveman-sessions/<session_id>.mode` + mirror `.caveman-active` · ลบไฟล์ session ที่เก่ากว่า 14 วัน · session headless (`claude -p`, Agent SDK) เริ่มแบบปิด · Codex และ Cursor มีไฟล์ hooks ของตัวเอง (`.codex/hooks.json`, `hooks/hooks-cursor.json`) แต่ยังไม่ได้อ่านเนื้อหา
- **installer (อ่านโค้ด 2026-10-16 — รายละเอียดเต็มใน `skill-collections-repo-analysis-20261015.md` §10.1):** ติดตั้งให้ทุก host ที่ตรวจเจอในเครื่อง · แก้ `settings.json` แบบ atomic/idempotent และลบเฉพาะ hook ของตัวเอง แต่ comment ในไฟล์ไม่รอด · curl-pipe ดึง git tag (`v4.0.1`) ที่ย้ายได้ — **ควร pin SHA** · หลังติดตั้งรัน `@caveman-ai/cli setup` ต่อ · สแกนไม่พบโค้ด telemetry/credentials ใน installer · **รัน `--dry-run --non-interactive` และ `--only claude` ก่อน** หรือใช้ plugin marketplace แทน
- **Caveman Cloud (อ่าน CLI + `proxy/internal/cloudlink/events.go` — รายละเอียดเต็มใน repo-analysis §10.2):** **routing** (Auto) ส่งคำสั่งล่าสุด + ก่อนหน้า + ท้ายคำตอบของ agent + ข้อมูล request ไปยัง `api.caveman.so` และ **Free plan อาจเก็บไว้** (ตามที่ upstream ประกาศ — payload จริงยังไม่ได้ตรวจจากโค้ด) · ปิดด้วย `caveman off routing` · **runtime telemetry** ส่งเฉพาะเมื่อ sign-in แล้ว เป็น opt-out (`telemetry.enabled=false` / `DO_NOT_TRACK` / `CAVEMAN_TELEMETRY=0`) และ struct ไม่มีฟิลด์ข้อความ prompt (ยืนยันจากโค้ด) · ค่าเริ่มต้นตอน `setup` ยังยืนยันไม่ได้ → ใช้ `caveman setup --dry-run` · environment ที่มีโค้ด/prompt ลับ: อย่าเปิด routing บน Free plan และตั้ง telemetry เป็น off
- **license:** Apache-2.0 สำหรับ **v3.0.0 ขึ้นไป** (ก่อนหน้านั้นแยก MIT + BSL 1.1 ในส่วน engine/proxy/mcp ฯลฯ) · **Caveman Cloud เป็นบริการเชิงพาณิชย์แยก ซอร์สไม่อยู่ใน repo** → pin เวอร์ชัน ≥ 3.0.0
- คำแนะนำ: **Pilot — ติดตั้งเฉพาะกลุ่ม "เสียงตอบสั้น" (+ `cavecrew` ถ้าต้องการ)** · **อย่าเปิดกลุ่ม Caveman Cloud** จนกว่าจะรีวิว data policy ของ gateway · อย่าเปิดคู่ karpathy/ponytail · เสียงตอบสั้นแบบ persistent จะชนกับ project instructions ที่กำหนดภาษา/รูปแบบคำตอบ (เช่น ให้ตอบเป็นภาษาไทยพร้อมอธิบายละเอียด)

### 4.3 ponytail — `DietrichGebert/ponytail` · Layer 0 (ทางเลือก — Pilot)

- 6 skills ไม่ซ้ำ (13 ไฟล์ = `skills/` 6 + mirror `.openclaw/skills/` 6 + benchmark fixture `benchmarks/arms/caveman-SKILL.md` 1 ซึ่งเป็นสำเนาของ caveman) · plugin v5.2.0
- **ปรัชญา** (audit frontmatter 2026-10-16): "Lazy senior dev mode" — การเปลี่ยนที่เล็กที่สุดที่แก้ปัญหาได้ครบ + คำตอบที่คนยุ่งอ่านรอบเดียวเข้าใจ · plugin ระบุ "YAGNI, stdlib first, no unrequested abstractions" · trigger กว้าง: ทุกงาน coding (เขียน แก้ refactor review เลือก dependency) และคำว่า "be lazy" · ใกล้เคียง karpathy ข้อ Simplicity/Surgical มาก
- skills: `ponytail` (mode) · `ponytail-review` (review change — อ่านโค้ดที่เชื่อมกัน ไม่ใช่แค่ diff) · `ponytail-audit` (audit ทั้ง repo — one-shot ไม่แก้ไฟล์) · `ponytail-debt` (รวบรวม comment `shortcut:` เป็น debt ledger) · `ponytail-gain` (แสดงผล benchmark) · `ponytail-help`
- **พฤติกรรมที่ mode บังคับ (อ่าน `SKILL.md`):** active ทั้ง session จนกว่าจะพิมพ์ "stop ponytail" / "normal mode" · มี 3 ระดับ (`lite` / `full` ค่าเริ่มต้น / `ultra` ที่ตั้งคำถามกับคำขอก่อนสร้าง) · ตอบจบด้วย 1–2 บรรทัดว่าข้ามอะไรและมีความเสี่ยงอะไร · เพิ่ม logic ที่ไม่ trivial ต้องทิ้ง test หรือ assert เล็ก ๆ · **ทิ้ง comment รูปแบบ `shortcut: <ข้อจำกัด>, <เมื่อไรต้องอัปเกรด>` ในโค้ดเมื่อเลือกทางลัด** (ยืนยันแล้ว — `ponytail-debt` เป็นตัวรวบรวม และเขียนไฟล์ `PONYTAIL-DEBT.md` เฉพาะเมื่อสั่ง)
- **hooks (อ่านสคริปต์ฝั่ง Claude/Codex):** `SessionStart` (startup · resume · clear · compact) + `SubagentStart` + `UserPromptSubmit` รัน node script (timeout 5s) · `ponytail-activate.js` เขียนไฟล์ flag `~/.claude/.ponytail-active` และ `.ponytail-statusline-nudged` · **อ่าน** `settings.json` เพื่อตรวจ statusline แล้ว nudge ให้ Claude ช่วยตั้งค่า (ไม่ได้แก้เอง) · ฉีด **codebase map** (รายชื่อ function/class/export ต่อโฟลเดอร์ ~2,000 ตัวอักษร สร้างจาก `git ls-files` ในเครื่อง ไม่มี network, timeout 1s, ปิดด้วย `PONYTAIL_MAP=0`) · มี adapter แยกสำหรับ Copilot · Cursor · Qoder (ยังไม่ได้อ่าน)
- คำแนะนำ: **Pilot ก่อน** — ซ้อนกับ karpathy สูง (เลือกหนึ่งตัว) · ส่วนที่ต่างและน่าสนใจคือ `ponytail-review` / `ponytail-audit` ซึ่งหยิบใช้แยกเดี่ยวได้ · ข้อควรระวัง: mode เปิดทั้ง session, ฉีดรายชื่อ symbol ของ repo เข้า context ทุก session start และทิ้ง comment `shortcut:` ในโค้ด — ขัดกับทีมที่ห้ามหรือไม่ใช้ comment รูปแบบนี้

### 4.4 superpowers — `obra/superpowers` · Layer 1

- ~14 skills · เจ้าของ obra (Jesse Vincent)
- skill เด่น: `brainstorming` · `systematic-debugging` · `test-driven-development` · `writing-plans` · `executing-plans` · `subagent-driven-development` · `using-git-worktrees` · `requesting/receiving-code-review` · `verification-before-completion` · `using-superpowers` (meta-router)
- rigid — ทำตามเป๊ะ · ทับซ้อนกลางกับ Addy/ECC แต่เสริม Matt Pocock ได้ดี
- ติดตั้ง: marketplace `obra/superpowers-marketplace` → `plugin install superpowers` (Claude Code) หรือ `npx skills add` (ได้เนื้อ skill แต่ไม่ได้ hooks/meta-router)

### 4.5 pstack — `cursor/plugins` (`pstack/`) + `michael-denyer/pstack-claude` · Layer 1 (ทางเลือก)

- สไตล์การทำงานของ agent ตามแบบ poteto (Lauren Tan): ตอบกระชับ · prose ไม่ slop · ใช้ subagent อย่างตั้งใจ · verify งานก่อนส่ง
- ~50 dirs: `poteto-mode` (20KB + playbooks/references/scripts) · `how` `why` `interrogate` `architect` `arena` `swarm` `reflect` `tdd` `teach` `technical-writing` `unslop` `blast-radius` `figure-it-out` ฯลฯ + กลุ่ม `principle-*` (เช่น `principle-laziness-protocol`)
- `pstack-claude` = port สู่ Claude Code / Codex / Copilot / Pi / OpenCode / Gemini — **อยู่นอก Cursor ใช้ตัวนี้**
- ทับ superpowers สูง (tdd / planning / review) · ทับ maestro เฉพาะ `reflect`
- คำแนะนำ: หยิบราย skill (`how` · `why` · `interrogate` · `principle-laziness-protocol`) ไม่ติดตั้งทั้งชุดคู่ superpowers

### 4.6 mattpocock — `mattpocock/skills` · Layer 2

- ~35 skills "Skills for Real Engineers" · small + composable · catalog 6 หมวด:
  - **engineering:** `tdd` `implement` `diagnosing-bugs` `codebase-design` `domain-modeling` `improve-codebase-architecture` `prototype` `to-prd` `to-issues` `triage` `grill-with-docs` `resolving-merge-conflicts` `ask-matt` (router) `setup-matt-pocock-skills`
  - **productivity:** `grilling`/`grill-me` `handoff` `teach` `writing-great-skills`
  - **misc:** `git-guardrails-claude-code` `setup-pre-commit` `migrate-to-shoehorn` `scaffold-exercises`
  - **personal:** `edit-article` `obsidian-vault`
  - **in-progress:** `review` `decision-mapping` `loop-me` `writing-beats/fragments/shape`
  - **deprecated:** `design-an-interface` `qa` `request-refactor-plan` `ubiquitous-language`
- เหมาะกับ engineer ที่อยากคุม reasoning/process โดยเฉพาะ TS/JS · ทับต่ำกับ superpowers, กลางกับ ECC

### 4.7 addyosmani — `addyosmani/agent-skills` · Layer 2

- 24 flat skills "Production-grade engineering skills":
  - **กระบวนการ:** `spec-driven-development` `planning-and-task-breakdown` `incremental-implementation` `test-driven-development` `source-driven-development` `doubt-driven-development`
  - **คุณภาพ:** `code-review-and-quality` `code-simplification` `debugging-and-error-recovery` `security-and-hardening`
  - **Frontend/Perf:** `frontend-ui-engineering` `performance-optimization` `browser-testing-with-devtools`
  - **Ops:** `ci-cd-and-automation` `shipping-and-launch` `observability-and-instrumentation` `deprecation-and-migration`
  - **ออกแบบ/เอกสาร:** `api-and-interface-design` `documentation-and-adrs`
  - **บริบท:** `context-engineering` `interview-me` `idea-refine` `using-agent-skills` (meta)
- เด่น: `doubt-driven-development` (adversarial review) · `source-driven-development` (อ้าง docs ทางการ)
- **ทับ ECC สูงมาก — เลือกตัวเดียว**

### 4.8 ECC — `affaan-m/ECC` · Layer 2

- หลายร้อย skills + agents + commands ใน namespace `ecc:*` · เจ้าของ affaan-m
- ครอบคลุม full SDLC + **domain packs** (healthcare, network, finance, crypto/DeFi, logistics, trade) + **ภาษา/เฟรมเวิร์ก** (python, go, rust, kotlin, swift, php, java, react, vue, django, laravel, springboot ...) + **orchestration**
- เด่น: ของเฉพาะทางที่ไม่มีในชุดอื่น เช่น `ecc:healthcare-phi-compliance` `ecc:network-bgp-diagnostics` `ecc:security-bounty-hunter`
- แตะแกน B แบบกระจัดกระจาย (`agentic-engineering` `context-budget` `mcp-server-patterns` `eval-harness` `prompt-optimizer` `agent-harness-construction` `cost-aware-llm-pipeline` `agent-introspection-debugging`) — ไม่มี memory/audit/cost layer แบบ maestro
- คำแนะนำ: อย่าติดตั้งทุก skill; ใช้ selective profile เฉพาะ namespace/domain ที่ต้องการ · capability ต่อแพลตฟอร์มดู §12.1.1

### 4.9 orchestkit — `yonatangross/orchestkit` · Layer 2 (ทางเลือก)

- README ระบุ **106 skills · 171 hooks** · โครงสร้าง `plugins/ork-*/skills/ork-*` ราย harness (นับไฟล์ได้ 236 / 119 dirs เพราะมี mirror — ใช้เลข README เป็นค่าอ้างอิง)
- repo ใหญ่มาก (9,006 ไฟล์ — `docs/` 2,530 · `src/` 2,504 · `plugins/` 1,872 · `.html` 1,067)
- **สคริปต์ติดตั้ง (อ่านเนื้อหาแล้ว 2026-10-16):**
  - `bin/install-git-hooks.sh` / `bin/install-hooks.sh` = **เครื่องมือของ contributor ที่พัฒนา orchestkit เอง** (symlink pre-commit/pre-push เข้า `.git/hooks` ของ clone นั้น พร้อมสำรองไฟล์เดิมเป็น `.backup`) — **ไม่ใช่ขั้นตอนติดตั้งของผู้ใช้** (ฉบับก่อนหน้าของเอกสารนี้สรุปจากชื่อไฟล์ว่า "แตะ git hooks ของ repo" ซึ่งทำให้เข้าใจผิด)
  - `plugins/ork-codex/scripts/install-codex-profile.sh` คัดลอก `ork-mech.config.toml` ไปที่ `$CODEX_HOME` (สร้างไฟล์ใหม่เท่านั้น ปฏิเสธการเขียนทับ ไม่แก้ `config.toml`) · `install-codex-roles.sh` คัดลอก role `.toml` 4 ตัวไปโฟลเดอร์ปลายทางที่ระบุ ปฏิเสธการเขียนทับ
  - **profile `ork-mech` ตั้ง `approval_policy = "never"` + `sandbox_mode = "workspace-write"` + `network_access = true`** — มีผลเฉพาะเมื่อสั่ง `--profile ork-mech` (เจ้าของระบุว่าตั้งใจไม่ใช้ `--dangerously-bypass-approvals-and-sandbox`) · เปิดเมื่อเข้าใจว่า agent จะรันคำสั่งในโฟลเดอร์งานและออกเน็ตได้โดยไม่ถามอนุมัติ
  - hooks ฝั่ง Claude (`src/hooks/src/setup/*.ts`): ตรวจ environment (python3 · node · git · docker · sqlite3 · jq) · สร้างโฟลเดอร์และย้าย config เก่าเป็น backup · หมุน log (rename + gzip) · **ลบแถวใน sqlite `file_locks` ที่เก่ากว่า 24 ชม.** · **spawn กระบวนการ background แบบ detached** (maintenance/repair) · ไม่พบ network call ในไฟล์ที่สแกน · path ที่เขียนจริงยังไม่ได้ตรวจ
- ขอบเขตใกล้ ECC (full SDLC + hooks หนัก) · community เล็ก · push ล่าสุดตาม §3.0 (ตรวจจุดเดียว — ยังไม่รู้ cadence ระยะยาว)
- คำแนะนำ: **Choose one กับ ECC** — ห้ามซ้อน · ถ้าจะ pilot ให้ตรวจ hooks ทั้ง 171 ตัวว่าแก้ไฟล์/config อะไรบ้าง

### 4.10 maestro — `sharpdeveye/maestro` · Layer 3

- v2.0.0 · 37 unit tests · npm + VS Code Marketplace
- **1 core skill `agent-workflow`** (auto-load, `user-invocable: false`) + **7 domain references:** `prompt-engineering` · `context-management` · `tool-orchestration` · `agent-architecture` · `feedback-loops` · `knowledge-systems` · `guardrails-safety`
- **24 command-skills:**
  - **Analysis:** `/diagnose` (audit 5 มิติ ให้คะแนน 1-5) · `/evaluate` · `/reflect` (scorecard จาก audit log)
  - **Fix & Improve:** `/refine` `/streamline` `/calibrate` `/fortify` `/zero-defect`
  - **Enhancement:** `/amplify` `/compose` `/enrich` `/accelerate` `/chain` `/guard` `/iterate` `/temper` `/turbocharge`
  - **Utility:** `/extract-pattern` `/adapt-workflow` `/onboard-agent` `/specialize` `/teach-maestro` `/capture` `/recap`
- **moat:** persistent memory `.maestro/` (`context.md` · `decisions.jsonl` · `audit.jsonl` · `sessions/`) · cost estimation ต่อ command (Claude/GPT-4/Gemini/o3, ±20%) · "Workflow Slop Test" (symptom → command) · delivery 3 แบบ (skills · MCP server `maestro-workflow-mcp` 10 tools/25 prompts/8 resources · VS Code ext) · 10 providers (Cursor · Claude Code · Gemini · Codex · Copilot/Antigravity · Kiro · Trae · Trae-CN · OpenCode · Pi)
- **ปรัชญา:** structure over improvisation · constraints are features · measure don't assume · appropriate complexity · graceful degradation
- ใช้งาน: ทุก command แนะนำ next step เสมอ (ไม่มีทางตัน) · เรียกต่อกันได้ เช่น `/diagnose /calibrate /refine`
- จุดอ่อน: ไม่แตะ SDLC/โค้ดแอป · ต้อง `/teach-maestro` ก่อน (เก็บ context ลง `.maestro.md`) · **เงียบตั้งแต่ 2026-04-29** (§3.0)

### 4.11 taste-skill — `Leonxlnx/taste-skill` · Vertical (frontend design)

- 13 skills · sponsor: Vercel OSS Program + Emil Kowalski · เว็บ tasteskill.dev
- ขอบเขตที่ประกาศเอง: "Landing pages, portfolios, and redesigns. **Not** dashboards, not data tables, not multi-step product UI"
- โครงสร้าง (⚠️ **ชื่อ skill ใน frontmatter ≠ ชื่อโฟลเดอร์**):
  - **ตัวหลัก:** `design-taste-frontend` (โฟลเดอร์ `taste-skill`, ~87KB) — "Design Read" 1 บรรทัดก่อนเขียนโค้ด → **3 Dials** (`DESIGN_VARIANCE` / `MOTION_INTENSITY` / `VISUAL_DENSITY`) + preset ต่อ use-case + Anti-Default Discipline (แบน AI-purple gradient · hero กลางจอบน dark mesh · การ์ด 3 ใบเท่ากัน · Inter + slate-900)
  - `design-taste-frontend-v1` (~21KB) — รุ่นเก่า **อย่าติดตั้งคู่ตัวหลัก**
  - **Style variants (8–16KB):** `industrial-brutalist-ui` · `minimalist-ui` · `high-end-visual-design` · `stitch-design-taste` · `redesign-existing-projects` · `brandkit`
  - **Image pipeline (36–40KB):** `imagegen-frontend-web` · `imagegen-frontend-mobile` · `image-to-code`
  - **อื่น:** `full-output-enforcement` · `gpt-taste` · โบนัส `research/laziness/`
- ผ่าน vet 2026-07-12: design guidance ล้วน ไม่มี shell/network/credential
- คำแนะนำ: โหลดเฉพาะตัวหลักหรือ variant ที่ใช้จริง — **อย่าเปิดทั้ง 13 ตัว**

### 4.12 aidlc-workflows — `awslabs/aidlc-workflows` · Layer 1–2 (Pilot — แทน ไม่ซ้อน)

- **AI-DLC (AI-Driven Development Life Cycle)** ของ AWS Labs · v2.11.0 · MIT-0 · "one core, many harnesses": Claude Code · Kiro CLI/IDE · Codex CLI · Cursor · opencode · GitHub Copilot · repo 1,857 ไฟล์ (1,233 เป็น `tests/`) · `SKILL.md` 14 ไฟล์ (สำเนาราย harness)
- **ตัวตน:** workflow engine ครบวงจร ไม่ใช่ชุดเคล็ดลับ — 33 stage ใน 5 phase (Initialization · Ideation · Inception · Construction · Operation) + **11 scope** (`enterprise` `feature` `mvp` `poc` `bugfix` `refactor` `infra` `security-patch` `classic` `workshop` `express`) · `/aidlc` เป็น "conductor" ที่วนถาม engine ว่าทำอะไรต่อ (`aidlc engine orchestrate next`) และมี approval gate ทุก stage · skill อื่น: `aidlc-knowledge` `aidlc-outcomes-pack` `aidlc-replay` `aidlc-session-cost` (read-only)
- **หนักมาก:** `SKILL.md` ของ `/aidlc` เพียงตัวเดียว ~49 KB (หนักรองจาก taste-skill ตัวหลัก ~87 KB ที่หนักสุดในเอกสาร)
- **ติดตั้ง (อ่านเอกสาร + `docs/guide/18-install-and-lifecycle.md` 2026-10-16):** `curl -fsSL …/releases/latest/download/install.sh | sh` (Windows: `irm … | iex`) ติดตั้ง **native binary `aidlc`** + runtime ของทุก harness · **บังคับตรวจ SHA-256** (ต้องมี `sha256sum`/`shasum`) · ตรวจ attestation ผ่าน GitHub CLI **เฉพาะเมื่อมี `gh`** (ไม่มีก็ข้าม — ผ่านด้วย checksum อย่างเดียว) · **pin ได้ด้วย `--version x.y.z`** · Windows แก้ User PATH · เส้นทาง manual-copy ต้องใช้ Bun
- **สิ่งที่ `aidlc config --harness claude` เขียนลงโปรเจกต์ (อ่าน template `harness/claude/settings.json` + `.mcp.json`):**
  - `permissions.allow`: **`Edit(/**)`** = แก้ไฟล์ทุกไฟล์ในโปรเจกต์โดยไม่ถาม (ยืนยันจาก [เอกสาร permissions ของ Claude Code](https://code.claude.com/docs/en/permissions) 2026-10-16: `/path` ใน project settings `.claude/settings.json` หมายถึง `<primary working directory>/path`) · `Bash(bun .claude/tools/aidlc.ts engine *)` · `Task` · `WebSearch`
  - **hooks ผูกกับเกือบทุกเหตุการณ์:** `PreToolUse` ทุก tool (`fold-usage`) + `guard-tool-call` บน Read/Edit/Write/Bash/Task/Agent ฯลฯ · `UserPromptSubmit` → `record-human-turn` (**บันทึกคำที่ผู้ใช้พิมพ์**) · SessionStart/SessionEnd · PostToolUse บน Write/Edit · timeout สูงสุด **1,800 วินาที** ต่อ hook · template เรียกผ่าน `bun` ขณะที่ README ว่า native install เรียกผ่าน `aidlc` (ยังไม่ได้เทียบว่าไฟล์ที่ติดตั้งจริงต่างกันอย่างไร)
  - **`.mcp.json` เพิ่ม MCP 5 ตัว แบบ `uvx …@latest` (ไม่ pin):** `context7` (HTTP + `CONTEXT7_API_KEY` จาก env) · `aws-mcp` (`mcp-proxy-for-aws` → `aws-mcp.us-east-1.api.aws`) · `aws-pricing` · `aws-iac` · `aws-serverless` — รันแพ็กเกจ PyPI เวอร์ชันล่าสุดทุกครั้ง
  - `companyAnnouncements` ใส่แบนเนอร์ยาว (ตาราง stage/scope) ทุก session
- **ทับซ้อน:** สูงมากกับ process (superpowers · pstack) และ SDLC (mattpocock · addyosmani · ECC · orchestkit) — ใช้ **แทน** ไม่ใช่ซ้อน · เหมาะกับ org ที่ใช้ AWS/Kiro และอยากได้ workflow มี gate/ตรวจสอบย้อนหลัง
- **คำแนะนำ:** **Pilot ในโปรเจกต์แยกเท่านั้น** · pin `--version` · อ่าน `settings.json` และ `.mcp.json` ที่ถูกเขียนลงโปรเจกต์ก่อนใช้ · ถ้าไม่ต้องการ MCP ของ AWS/context7 ให้ลบออกจาก `.mcp.json` หลังติดตั้ง · อย่าเปิดคู่กับ superpowers/pstack/ECC

---

## 5. Domain Verticals

### 5.1 founder-skills — Business/Founder

- <https://github.com/ognjengt/founder-skills> · **Add selective** · โครงสร้าง `skills/*/SKILL.md` + references
- ขอบเขต: strategic planning · GTM · pricing · competitor intelligence · CRO · outreach · PRD · SOP · brand/content writing
- เลือก 3-6 skills ตามงาน · ตรวจ claims/ข้อมูลตลาดจากแหล่งปัจจุบัน · ปกป้อง `FOUNDER_CONTEXT.md`

### 5.2 Product UI — ui-skills หรือ ux-ui-agent-skills (เลือก 1)

| | ui-skills | ux-ui-agent-skills |
|---|---|---|
| Repository | <https://github.com/ibelick/ui-skills> | <https://github.com/plugin87/ux-ui-agent-skills> |
| ขอบเขต | baseline UI · a11y fixes · metadata · motion performance · UI improvement | design tokens · design QA/review (6 มิติ + Nielsen) · Figma integration · a11y audit · quality `gate` · governance (README อ้าง 52 components / WCAG) |
| รูปแบบ | collection + CLI (`npx ui-skills`) | collection ใน `.claude/skills/` |
| เหมาะเมื่อ | audit/แก้ product UI ที่มีอยู่ | ทีมที่มี design system/Figma และต้องการ gate คุณภาพ |
| สถานะ | Add opt-in | Choose one กับ ui-skills |

- Routing: product UI → กลุ่มนี้ · marketing/landing → taste-skill หรือ Hallmark
- ตรวจว่า rules (`MUST`/`NEVER`, bias ต่อ Tailwind/React/motion) เข้ากับ stack ของโปรเจกต์

### 5.3 Anti-slop — anti-slop / no-ai-slop

- `anti-slop` (<https://github.com/miqdadbadjuber/anti-slop>): `antislop` `antislop-code` `antislop-ui` `antislop-layoutmobile` + **text:** `antislop-copywriting` `antislop-human`
- `no-ai-slop` (<https://github.com/petergyang/no-ai-slop>): text อย่างเดียว · 20+ patterns
- **กฎ:** surface UI/code ใช้ anti-slop ได้ · surface text เลือก **no-ai-slop หรือ text skills ของ anti-slop อย่างใดอย่างหนึ่ง** — ห้ามเปิด global ทั้งคู่
- `antislop-ui` ทับ taste-skill/Hallmark — ถ้ามี design direction หลักแล้วไม่ต้องเปิด

### 5.4 AntV Infographic — Data Storytelling

- <https://github.com/antvis/Infographic> · **Add selective**
- rendering framework + skill pack ~5 ตัว: creation · syntax/structure · item generation · template authoring
- runtime use = creator + syntax skills · template updater เฉพาะผู้ดูแล renderer
- ต้อง render และตรวจ visual, SVG, responsive, accessibility จริง

### 5.5 Diagram — archify / fireworks-tech-graph / diagram-design (เลือก 1)

ผล benchmark รันจริง 2026-10-15 (รายละเอียดเต็มใน `skill-collections-repo-analysis-20261015.md` §5):

| | archify | fireworks-tech-graph | diagram-design |
|---|---|---|---|
| Repository | <https://github.com/tt-a1i/archify> | <https://github.com/yizhiyanhua-ai/fireworks-tech-graph> | <https://github.com/cathrynlavery/diagram-design> |
| กลไก | CLI 4 gates (`validate` / `deliver` / `check` / `browser-check`) | CLI `validate` → `render` → `check` → `export-html` | ไม่มี renderer — วาดตาม SKILL แล้วรัน `self_check.py` |
| Brief เดียวกัน (6 nodes / 5 edges) | ✅ ผ่าน ~15s | ❌ ติด composition gate — ผ่านเมื่อลดเหลือ 3 nodes | — |
| Output | explorable HTML ~813KB (ฝัง viewer) + export SVG/WebM | SVG ~27KB / HTML ~36KB / PNG / GIF | HTML/SVG/PNG ~12KB · import drawio/Mermaid/excalidraw |
| Coverage | architecture | technical graph | 44–45 types (Wardley / Sankey / journey ฯลฯ) |
| จุดเด่น | pipeline ครบที่สุด | fail ดีกว่าวาดผิด | ชนิด diagram กว้างที่สุด |
| จุดอ่อน | output ใหญ่ | authoring ยาก — ลอก geometry จาก fixture | คุณภาพขึ้นกับคนวาด |

- **ใช้เมื่อ:** architecture จาก codebase → archify · SVG เนี้ยบมี gate → fireworks · diagram ชนิดพิเศษ → diagram-design
- **ขนาด repo:** archify 1,017 ไฟล์ และมี **`archify.zip` 5 MB commit อยู่ใน repo** (ตรวจเนื้อ zip ไม่ได้ — ติดตั้งจาก source อย่าใช้ zip; ยังไม่ได้เปิดดูเนื้อ) · diagram-design 681 ไฟล์ แต่เป็น skill เดี่ยว + ตัวอย่าง/asset (`.html` 218 · `.png` 92 · `.svg` 88) หยิบเฉพาะ `SKILL.md` + references ได้

### 5.6 Security — security-audit-skill · reverse-skill · rea

| | security-audit-skill | reverse-skill | rea |
|---|---|---|---|
| Repository | <https://github.com/cloudflare/security-audit-skill> | <https://github.com/zhaoxuya520/reverse-skill> | <https://github.com/morluto/rea> |
| ขอบเขต | audit codebase / API / CLI / daemon · findings แบบ machine-readable | reverse engineering · pentest · CTF · security research | reverse-engineer-anything (native / managed / Electron / firmware) |
| รูปแบบ | single skill (official Cloudflare) | router pack + modules + scripts + tool bootstrap | 1 skill + dev skills ของ repo 3 ตัว |
| สถานะ | **Add selective** — ใช้ก่อนสำหรับงาน defensive | **Restricted** | **Restricted** — choose one กับ reverse-skill |

- `security-audit-skill` รัน full workflow เฉพาะเมื่อสั่ง audit ชัดเจน — ไม่ auto-trigger
- **`rea` ไม่ใช่ pack ของ markdown:** repo 4,057 ไฟล์ เป็นแอป TypeScript (`src/` 1,978 · `tests/` 1,240 · `scripts/` 399 · `.ts` ~3,000 ไฟล์) พร้อม `install.sh` และ `bridge/` — พื้นผิวที่ต้อง review ใหญ่กว่าที่ "4 `SKILL.md`" บอกมาก · `reverse-skill` มี 89 ไฟล์ `SKILL.md` ใน 599 ไฟล์
- **ข้อบังคับก่อนใช้ reverse-skill หรือ rea:**
  1. ระบุ owner, target และ authorization scope
  2. allowlist เฉพาะโมดูลที่ต้องการ
  3. pin commit และ dependency
  4. review scripts / network / tool installation
  5. ใช้ sandbox และ audit log
  6. ห้าม global auto-trigger
- ไม่รับ: modules ที่เน้น bypass, malware, credential abuse หรือ uncontrolled exploitation

### 5.7 Compliance — Privacy-Data-Protection-Skills

- <https://github.com/mukul975/Privacy-Data-Protection-Skills> · **Add selective ราย jurisdiction**
- `plugins/ai-privacy-governance-skills/skills/*` 824 ไฟล์ · GDPR · CCPA · EU AI Act · HIPAA · LGPD · PIPL · DPDP · มี `ai-dpia` ตาม EDPB 04/2025
- ใหญ่ที่สุดในเอกสาร — หยิบเฉพาะ jurisdiction ที่ใช้ · เงียบตั้งแต่ 2026-03-16 → ตรวจว่ากฎหมายไม่เปลี่ยนหลังจากนั้น
- ผลลัพธ์เป็นร่างให้ฝ่ายกฎหมายตรวจ ไม่ใช่คำปรึกษากฎหมาย

### 5.8 Media — ffmpeg-skill

- <https://github.com/kajisho5/ffmpeg-skill> · **Add selective**
- **ใช้ root `SKILL.md`** (`name: ffmpeg-skill`): 42 scripts + MCP (12 core / 42 เต็ม) · Python 3.9 stdlib · ไม่ใช้ cloud/keys
- `.claude/skills/` 13 ตัวเป็น dev-workflow ของ repo (`code-review` `release-management` ฯลฯ) — **ไม่ต้องติดตั้ง**

### 5.9 Methodology reference — Atlas · claude-code-best-practice

- **Atlas** (<https://github.com/syahiidkamil/Software-Engineer-AI-Agent-Atlas>) · Reference + selective
  - 20 skills (`adversarial-review` `abstraction-power` `learning-from-mistakes` `super-product-owner` `postgresql-*` ฯลฯ) · ปรัชญา KISS/YAGNI/DRY · wireframe → HTML spec → native plan loop
  - ⚠️ **ไม่มี license** — ใช้เชิงพาณิชย์ต้องขอเจ้าของก่อน
  - ⚠️ `pdf` `skill-creator` `mcp-builder` `theme-factory` `algorithmic-art` `frontend-design` ชื่อตรงกับ skill ของ `anthropics/skills` — ถ้าเป็นสำเนาจะติด license ต้นฉบับซ้อน และซ้ำกับ skill ที่ harness หลายตัวมีอยู่แล้ว
  - หยิบได้: `adversarial-review` (hostile second opinion ที่รัน target จริง)
- **claude-code-best-practice** (<https://github.com/shanraisshan/claude-code-best-practice>) · Reference — ตัวอย่างการจัด `.claude/` (skills `agent-browser` `presentation/*` `time-skill` `weather-*`) อ่านเป็นแนวทาง ไม่ติดตั้ง

---

## 6. Hybrid และ Product-Specific Packs

| Package | รูปแบบ | ใช้เมื่อ | สถานะ |
|---|---|---|---|
| [Ruflo](https://github.com/ruvnet/ruflo) | meta-harness + MCP + plugins + skill catalog | ต้องการ swarm/orchestration platform | Pilot — ห้ามเป็น baseline · choose one กับ maestro |
| [claude-code-guide](https://github.com/zebbern/claude-code-guide) | skill/agent catalog ขนาดใหญ่ | หา specialist skills | Reference — allowlist รายตัว |
| [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) | plugin + skills + agents + knowledge graph | persistent codebase understanding | Choose one กับ Graphify/Graft |
| [rtk](https://github.com/rtk-ai/rtk) | CLI proxy ลด token + 12 skills (`rtk-tdd` `rtk-triage` `security-guardian` `ship` ฯลฯ) | ลด token ของ command output | Companion — ใช้คู่ headroom ได้ · skill ชุดนี้ไม่จำเป็นต้องเปิด |
| [witr](https://github.com/pranshuparmar/witr) | diagnostic CLI + 1 skill | ตรวจ process/port/container | Companion (ดู §11) |
| [WeKnora](https://github.com/Tencent/WeKnora) | RAG framework + CLI skills (`weknora-rag-search` `weknora-shared`) | ทีมที่ใช้ WeKnora เป็น RAG backend | Companion — **license other อ่านก่อนใช้** |
| [claude-ops](https://github.com/Lifecycle-Innovations-Limited/claude-ops) | 69 skills (`ops-*` AWS/deploy/monitoring/revenue + `boss` `flow` `ledger`) + daemon | ops automation | Pilot ใน environment แยก — มี daemon และ credentials |
| [OpenAI Codex Security](https://github.com/openai/codex-security) | security CLI/SDK + bundled skills | ใช้ official Codex Security runtime | Per-project — ติดตั้งผ่าน workflow ทางการ |
| [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | durable workflow + versioned skills | โปรเจกต์ใช้ Trigger.dev | Per-project — ให้ตรง SDK version |
| [typesafe-ai/skills](https://github.com/typesafe-ai/skills) | product pack 1 skill | โปรเจกต์ใช้ผลิตภัณฑ์นั้น | Per-project |
| [Unity-MCP](https://github.com/IvanMurzak/Unity-MCP) | Unity plugin + MCP + 25 skills | งาน Unity | Per-project |
| [CLI-Anything](https://github.com/HKUDS/CLI-Anything) | framework + registry (CLI-Hub) ของ CLI harness ต่อซอฟต์แวร์จริง (Blender · QGIS · Audacity · Calibre · FreeCAD ฯลฯ) — แพ็กเกจ pip `cli-anything-*` + `SKILL.md` รายตัว (151 ไฟล์) | ให้ agent ใช้ซอฟต์แวร์ที่ไม่มี API ผ่าน CLI | Add selective ราย CLI — ดูหัวข้อด้านล่าง |
| [ReMe](https://github.com/agentscope-ai/ReMe) | local-first memory ของ agent (Markdown + wikilink) · pip `reme-ai` · plugin Claude Code/Codex (มี hooks + MCP) · 7 `SKILL.md` | memory ข้าม session แบบไฟล์ที่ผู้ใช้คุมเอง | Pilot — ดูหัวข้อด้านล่าง + §14.9 |

- **Ruflo:** technically เป็น collection แต่ operationally เป็น platform choice · risk: tool discovery overload, hook/config mutation
- **claude-code-guide:** คุณภาพและ provenance ต่างกันราย skill · มี security content แบบ dual-use — **never import all**
- **Understand-Anything:** สร้าง `.ua/` knowledge graph · มี hook และ multi-agent assumptions
- **claude-ops:** จำกัด scope credential และอย่ารัน daemon บนเครื่องที่มี production access จนกว่าจะ audit
- **CLI-Anything** (Apache-2.0 · 1,872 ไฟล์ / 151 `SKILL.md` — อ่าน README + sample `blender/…/SKILL.md` 2026-10-16):
  - แนวคิด: สร้าง/เก็บ "harness" เป็น CLI แบบ stateful (JSON output สำหรับ agent + REPL) ต่อซอฟต์แวร์จริง · ติดตั้งได้สองทาง: **CLI-Hub** (`pip install cli-anything-hub` → `cli-hub install <name>` ติดตั้งแพ็กเกจจาก **pip / npm / brew** รวมถึง "Public CLIs" ของบุคคลที่สาม) หรือเฉพาะ skill ผ่าน `npx skills add HKUDS/CLI-Anything --skill <name> -g -y`
  - **ข้อควรระวัง:** `-g -y` ติดตั้ง global โดยไม่ถาม · harness ส่วนใหญ่ **รับ PR จากชุมชน** (README บันทึกการแก้ path traversal/symlink และ XML parsing ย้อนหลัง จึงมีคุณภาพ/ความปลอดภัยต่างกันรายตัว) · แต่ละ CLI ต้องมีซอฟต์แวร์ต้นทางในเครื่อง (เช่น Blender ≥ 4.2) · ตัวเลข "2,461 tests passing" เป็นของ upstream ไม่ได้ตรวจ · `SKILL.md` รายตัวเป็นเอกสารคำสั่ง frontmatter สั้น (name + description ทั่วไป)
  - **คำแนะนำ:** เลือกติดตั้งราย CLI ที่ใช้จริงเท่านั้น (ไม่ใช่ทั้ง registry) · ครั้งแรกไม่ใส่ `-g -y` · ติดตั้ง pip ใน venv แยก · ทับกับ `ffmpeg-skill` / เครื่องมือ diagram / Unity-MCP เฉพาะงานซอฟต์แวร์เดียวกัน
- **ReMe** (Apache-2.0 · 888 ไฟล์ / 7 `SKILL.md` — อ่าน README + `skills/reme_memory/SKILL.md` + รายการไฟล์ integration 2026-10-16):
  - แนวคิด: memory เป็นไฟล์ Markdown (frontmatter + wikilink) ใน workspace ที่ผู้ใช้คุมเอง ค้นด้วย BM25 + embeddings (ไม่บังคับ) + wikilink · integration: Claude Code · Codex · Hermes · OpenClaw · QwenPaw · DeepSeek Harness · เข้าถึงได้ทาง CLI/HTTP/MCP/Python
  - **plugin ฝั่ง Claude Code/Codex มี hooks (`hooks.json` + `auto_memory.py`) และ MCP bridge** — hook จับบทสนทนาเข้า memory อัตโนมัติ (ยังไม่ได้อ่านโค้ด `auto_memory.py`)
  - **ข้อมูลออกนอกเครื่อง:** งานที่ใช้ LLM (`auto_memory` `auto_resource` `auto_dream`) ต้องตั้ง `LLM_API_KEY` + `LLM_BASE_URL` และ **ส่งเนื้อหาไปยัง endpoint ที่ตั้ง** (ตัวอย่างใน `SKILL.md` ชี้ไป DashScope ของ Alibaba Cloud ค่าเริ่มต้นโมเดล `qwen3.7-plus`) · ส่วนที่ไม่ใช้โมเดล (ไฟล์ · BM25 · wikilink) ทำงานได้โดยไม่ต้องมี credential · `SKILL.md` ระบุให้ถามผู้ใช้ก่อนติดตั้ง pip และไม่ยัดตัวเองลง environment เงียบ ๆ (พฤติกรรมที่ดี) · persist source record โดยตัด tool result ที่ recall มาและ base64
  - **คำแนะนำ:** Pilot · เริ่มด้วยโหมดไม่ใช้ LLM · ชี้ `LLM_BASE_URL` ไปยัง endpoint ที่ยอมให้เห็นบทสนทนาเท่านั้น · memory ของ agent ต้องมี retention/ACL ตามข้อควรระวังใน §9 · เลือกหนึ่งตัวต่อโปรเจกต์ (§14.9)

---

## 7. Single Skills และ Specialist Integrations

| Skill | Repository | ประเภท | สถานะ |
|---|---|---|---|
| Hallmark | <https://github.com/Nutlope/hallmark> | anti-slop frontend (Claude Code / Cursor / Codex) | Choose one กับ taste-skill — benchmark ด้วย brief เดียวกัน |
| claude-code-prompt-improver | <https://github.com/severity1/claude-code-prompt-improver> | Claude hooks + skill | A/B test only — hooks ไม่ portable |
| Graphify | <https://github.com/Graphify-Labs/graphify> | graph CLI + integration skill | Choose one (codebase knowledge) |
| Graft | <https://github.com/NanoNets/Graft> | code graph CLI + MCP + skill adapter | Choose one — ตรวจ config changes และ data egress |
| Claude Code Sub-agents | <https://github.com/lst97/claude-code-sub-agents> | agent definitions (ไม่มี `SKILL.md`) | Reference — port contract เอง |
| CCPlugins | <https://github.com/notlikeDev/CCPlugins> | legacy slash commands | Reference — ตรวจ Git side effects |

---

## 8. Skill Infrastructure และ Governance

### 8.1 autoskills — Discovery/Installer

- <https://github.com/midudev/autoskills> · scan tech stack → เลือก curated skills → verify hash → เขียน lockfile

```bash
npx autoskills --dry-run
```

- ตรวจผลเลือก, source, hash และ file diff ก่อนยืนยัน · เก็บ `skills-lock.json` ใน version control
- สถานะ: **Useful local installer with mandatory review gate**

### 8.2 SkillHub — Team Registry

- <https://github.com/iflytek/skillhub> · publish · version · search · RBAC · audit · self-hosted
- pilot: isolated environment → เปลี่ยน default credentials → กำหนด publisher/reviewer → บังคับ hash/signature/provenance → scan prompt injection ก่อน publish
- สถานะ: **Governance pilot — operationally heavier**

### 8.3 book-to-skill — Skill Generator

- <https://github.com/virgiliojr94/book-to-skill> · `SKILL.md` ไฟล์เดียว · แปลง PDF / EPUB / DOCX / HTML / MD / RTF / MOBI เป็น skill
- เสริม autoskills (สร้าง skill จากเอกสารภายใน) · skill ที่ได้ต้องผ่าน acceptance gate §17 เหมือน skill ภายนอก และระวังลิขสิทธิ์ของหนังสือต้นทาง
- สถานะ: **Add selective**

---

## 9. MCP, Memory และ Context Companions

| Tool | Capability | ใช้เมื่อ | ความเสี่ยงหลัก |
|---|---|---|---|
| [headroom](https://github.com/headroomlabs-ai/headroom) | runtime context compression (tool outputs/logs/files/RAG chunks) ลด token 60–95% · library + proxy + MCP + hooks | ลด token ตอน runtime — เสริม maestro ไม่ทับ | compression loss, เพิ่มชั้นใน pipeline |
| [rtk](https://github.com/rtk-ai/rtk) | CLI proxy ลด token ของ command output | ลด token จาก shell/tool output | ผลลัพธ์ถูกตัดก่อนถึง agent |
| [PageIndex](https://github.com/VectifyAI/PageIndex) | reasoning-based document index | RAG แบบไม่ใช้ vector | ต้นทุน model call ตอน index |
| [world-intel-mcp](https://github.com/marc-shade/world-intel-mcp) | global intelligence MCP | research, markets, cyber intel | tool noise, freshness, provenance |
| [TencentDB-Agent-Memory](https://github.com/TencentCloud/TencentDB-Agent-Memory) | shared memory (chat/skill/wiki/code-graph) | team-level persistent memory | ACL, poisoning, stale memory |
| [ReMe](https://github.com/agentscope-ai/ReMe) | local-first memory เป็นไฟล์ Markdown + wikilink · BM25/embeddings · plugin Claude Code/Codex | memory ส่วนตัวที่ผู้ใช้คุมไฟล์เอง | hook จับบทสนทนาอัตโนมัติ · งาน LLM ส่งเนื้อหาไป endpoint ที่ตั้ง · poisoning/stale memory |
| [claude-context](https://github.com/zilliztech/claude-context) | semantic code search MCP | large-codebase retrieval | embedding cost, code egress |
| [Graphify](https://github.com/Graphify-Labs/graphify) | code/knowledge graph | architecture traversal | hooks/config mutation |
| [Graft](https://github.com/NanoNets/Graft) | repository code graph | navigation, context compression | stale index, data egress |
| [Understand-Anything](https://github.com/Egonex-AI/Understand-Anything) | multi-agent codebase graph | onboarding/architecture | token cost, post-commit hooks |

### Choose-one: Codebase Knowledge Layer

```text
Graphify             เน้น graph traversal และหลาย input types
Graft                เน้น CLI/MCP repository context
Understand-Anything  ยอมรับ plugin/multi-agent workflow และ persistent artifacts
```

benchmark ด้วย repository เดียวกัน: setup time · files/configs modified · indexing time · query precision/recall · stale-update behavior · token/API cost · data ที่ออกนอกเครื่อง · uninstall/rollback

---

## 10. Document, RAG และ Extraction Tools

| Tool | Capability | คำแนะนำ |
|---|---|---|
| [MarkPDFdown](https://github.com/MarkPDFdown/markpdfdown) | PDF/image → Markdown ผ่าน multimodal LLM | thin wrapper; benchmark ภาษาไทย ตาราง สูตร และ PII policy |
| [olmocr](https://github.com/allenai/olmocr) | PDF → text ด้วย VLM (Apache-2.0) | ทางเลือก local OCR · เงียบตั้งแต่ 2026-03-25 |
| [pdfcraft](https://github.com/PDFCraftTool/pdfcraft) | PDF toolkit | ตรวจ **AGPL-3.0** ก่อนฝังในผลิตภัณฑ์ |
| [pdf-mcp](https://github.com/I-CAN-hack/pdf-mcp) | PDF MCP server ขนาดเล็ก | ทดลองได้ · community เล็กมาก |
| [WeKnora](https://github.com/Tencent/WeKnora) | document understanding + RAG framework | ตรวจ license (other) |
| [Morphik Core](https://github.com/morphik-org/morphik-core) | multimodal ingestion/retrieval | ตรวจ **BSL 1.1** |
| [Unstract](https://github.com/Zipstack/unstract) | document → JSON platform/MCP | schema-specific wrapper; ตรวจ **AGPL** |
| [paperless-gpt](https://github.com/icereed/paperless-gpt) | OCR/metadata สำหรับ paperless-ngx | วางหลัง reverse-proxy auth + human approval |
| [knowledge_graph](https://github.com/rahulnyk/knowledge_graph) | corpus → concept graph | reference implementation |
| [Local_Knowledge_Graph](https://github.com/punnerud/Local_Knowledge_Graph) | local Ollama RDF graph | legal review ของ **custom license** ก่อน |

### Wrapper Skill Contract สำหรับ Document Tools

1. input types และ maximum size/page count
2. local vs external model path
3. PII/confidential-document policy
4. prompt-injection handling
5. output schema และ validation
6. checksum/provenance ของ source document
7. human approval ก่อน ingest/publish/replace
8. retry, timeout, cost และ partial-failure behavior

---

## 11. Engineering และ Domain Tool Companions

| Tool | ประเภท | ใช้ร่วมกับ | หมายเหตุ |
|---|---|---|---|
| [witr](https://github.com/pranshuparmar/witr) | process/port/container diagnostic CLI (+1 skill) | diagnose, production-ops | sanitize paths/env · ขอสิทธิ์เมื่อจำเป็น |
| [Scrapy](https://github.com/scrapy/scrapy) | web crawling framework | scraping/research | domain allowlist · robots/ToS · rate limit |
| [CodeVibes](https://github.com/danish296/codevibes) | AI code-review application | review/evaluation | benchmark false positives และ privacy ก่อน |
| [Promptflow](https://github.com/microsoft/promptflow) | LLM flow/evaluation | maestro/ECC eval | เฉพาะทีมที่มี dependency อยู่แล้ว |
| [TEN Framework](https://github.com/TEN-framework/ten-framework) | realtime voice/multimodal | voice-agent | audio privacy, consent, latency |
| [full-stack-ai-agent-template](https://github.com/vstorm-co/full-stack-ai-agent-template) | FastAPI/Next.js template | prototype | output ไม่ production-ready โดยอัตโนมัติ |
| [Dive](https://github.com/OpenAgentPlatform/Dive) | desktop MCP/skills host | portability testing | delivery platform ไม่ใช่ skill source |
| [prompt-forge](https://github.com/insaaniManav/prompt-forge) | prompt workbench | prompt QA | **GPL** · provider keys |

---

## 12. การใช้ข้ามแพลตฟอร์ม (Portability)

ตัว skill เป็น markdown จึงพกไปได้เกือบทุกแพลตฟอร์ม — สิ่งที่ต่างคือ **กลไกโหลด** (plugin / `npx skills add` / rules file / MCP) และของแถมที่ผูกแพลตฟอร์ม (hooks · agents · commands · meta-router)

### 12.1 ตาราง Portability

**นิยามสัญลักษณ์:**
- **Documented** (upstream ระบุ): `✓✓` coverage กว้าง · `✓` จำกัด/เฉพาะจุด · `△` มีแต่ upstream ยอมรับข้อจำกัด · `✗` ระบุว่าไม่มี
- **Unknown:** `?` ยังไม่พบเอกสาร — ไม่ใช่ documented absence
- **N/A:** `—` ไม่มีแกนนี้ให้ประเมิน
- **Evidence:** `T` = runtime-tested โดยผู้จัดทำ (มีเฉพาะกลุ่ม diagram ที่รัน CLI จริง 2026-10-15)

> การมี adapter directory **ไม่เท่ากับ feature parity** — `✓` แปลว่า "เอกสารบอกว่ามี" ไม่ใช่ "เห็นมันทำงาน"

| ชุด | Content | Plugin | Hooks | Commands | สรุป |
|---|:-:|:-:|:-:|:-:|---|
| karpathy | ✓✓ | — | — | — | 1 ไฟล์ copy เป็น `.cursorrules` / `.clinerules` / `AGENTS.md` ได้ตรงๆ |
| caveman | ✓✓ | ✓✓ Claude · Cursor · Codex · Gemini | ✓ | ✓ `commands/*.toml` | ตรวจจากไฟล์ใน repo 2026-10-16 · hooks อ่านเนื้อหาเฉพาะฝั่ง Claude (README) · Codex/Cursor มีไฟล์ hooks แต่ยังไม่ได้อ่าน |
| ponytail | ✓✓ | ✓ | ✓ | ? | hooks adapter: Claude/Codex · Copilot · Cursor · Qoder (ตรวจ 10-16) · plugin v5.2.0 |
| superpowers | ✓✓ 14 install targets | ✓✓ | △ | ✗ | hooks: Antigravity รัน session-start ได้ · Hermes ไม่มี post-compaction · ที่เหลือยังไม่ยืนยัน |
| pstack | ✓✓ | ✓ Cursor plugin | ? | ✓ | นอก Cursor ใช้ `pstack-claude` (Claude Code/Codex/Copilot/Pi/OpenCode/Gemini) |
| mattpocock | ✓✓ | — | — | — | `npx skills add` / copy เป็น rules |
| addyosmani | ✓✓ | ✓ | ✗ | — | README รองรับ Gemini CLI / opencode |
| ecc | ✓✓ | ✓✓ CC · Codex · OpenCode (beta) | △ | △ | ระดับต่างกันมาก — §12.1.1 |
| orchestkit | ✓ | ✓ ราย harness | ✓ (171 ตาม README) | ✓ | hooks เยอะที่สุด — ระวัง side effects |
| maestro | ✓✓ 10 providers | ✓ + MCP server | — | ✓ | MCP ใช้กับทุก client ที่รองรับ MCP |
| taste-skill | ✓✓ | ✓ | — | — | มี skill เจาะปลายทาง (§12.2) |
| founder-skills | ✓✓ | — | — | — | business guidance ล้วน |
| ui-skills | ? | CLI ของตัวเอง | ? | ? | ยังไม่ตรวจว่ารองรับ agent ใด |
| ux-ui-agent-skills | ✓ | ? | ? | ? | ยังไม่ตรวจ adapter |
| anti-slop · no-ai-slop | ✓ | — | — | — | markdown ล้วน copy เป็น rules ได้ |
| Infographic | △ | — | — | — | ต้องมี renderer ปลายทาง |
| archify | ✓ | ? | — | ✓ **T** | CLI `bin/archify.mjs` รันผ่าน |
| fireworks-tech-graph | ✓ | ? | — | ✓ **T** | CLI `scripts/fireworks.py` รันผ่าน |
| diagram-design | ✓ | ✓✓ `.claude-plugin` `.codex-plugin` `.factory-plugin` | — | ✓ | `self_check.py` รันผ่าน (**T**) · ไม่มี renderer |
| security-audit-skill | ✓ | ? | — | — | ใช้ผ่านเนื้อหา |
| reverse-skill | △ (governed) | ✗ | ✗ | — | scripts ผูก OS มากกว่าผูก agent |
| rea | ✓ | — | — | — | `.agents/skills/` · gated |
| Privacy-Data-Protection-Skills | ✓ | ✓ | ? | ? | selective ราย jurisdiction |
| ffmpeg-skill | ✓ | ? | — | — | root `SKILL.md` + MCP |
| book-to-skill | ✓ | — | — | — | ไฟล์เดียว |
| Atlas | ✓✓ | — | — | — | markdown ล้วน — ตรวจ frontmatter ก่อน |
| Ruflo | ✓ | ✓ + MCP | △ | ✓ | hooks/config mutation ผูกแพลตฟอร์ม |
| claude-ops | ✓ | — | ✓ daemon | ✓ | pilot isolated |
| aidlc-workflows | ✓✓ 7 harness (Claude · Kiro CLI/IDE · Codex · Cursor · opencode · Copilot) | ✓ `plugins/` | ✓✓ ทุก tool call (Claude) | ✓ `/aidlc` + flags | native binary `aidlc` · hooks หนัก (ดู §4.12) · ตรวจจากไฟล์ใน repo ยังไม่ได้ทดสอบทุก harness |
| CLI-Anything | ✓ (ราย CLI) | ? | — | ✓ CLI `cli-anything-*` | README อ้าง Pi · OpenClaw · nanobot · Cursor · Claude Code · มี Hermes skill (เสนอ) — ยังไม่ได้ตรวจ adapter |
| ReMe | ✓ (7 `SKILL.md`) | ✓ Claude Code · Codex (marketplace) | ✓ `hooks.json` + `auto_memory.py` | — | MCP + CLI + HTTP + Python · integration Hermes/OpenClaw/QwenPaw/DeepSeek Harness ตาม README |
| Unity-MCP · WeKnora | ✓ | ✓ / — | — | — / ✓ CLI | companion |
| Hallmark | ✓✓ | — | — | — | Claude Code / Cursor / Codex |
| prompt-improver | ✓ | Claude only | ✗ | — | hooks ไม่ portable |

**superpowers — 14 install targets (13 harness families; Codex App/CLI นับแยก):** Claude Code · Antigravity · Codex App · Codex CLI · Cursor · Devin CLI · Factory Droid · Gemini CLI · Copilot CLI · Grok Build CLI · Kimi Code · OpenCode · Pi · Hermes

#### 12.1.1 ECC — capability ต่อแพลตฟอร์ม (README + `.codex-plugin/README.md`, ตรวจ 2026-08-15)

> **แหล่งข้อมูล:** สังเคราะห์จากหลายส่วนของ README ECC (`Install ECC` · `Codex App and CLI` · `Platform Support` · `Cross-tool capability map` · `Codex macOS app + CLI support in depth`) และ `.codex-plugin/README.md` — ไม่ใช้ matrix ส่วนเดียว เพราะส่วน Codex ใน matrix อธิบาย legacy sync ขณะที่ native-plugin docs ใหม่กว่า · **ไม่ระบุจำนวน platform รวมโดยเจตนา** เพราะ README จัดกลุ่มไม่คงที่และมี directory ที่ไม่มี guide กำกับ

| Status ตาม upstream | Platform | ติดตั้ง | ได้อะไร | ข้อจำกัด |
|---|---|---|---|---|
| Stable primary | Claude Code | plugin / selective installer | skills · agents · commands · hooks · rules · `/ecc:` | ใช้ selective profile เมื่อ context สำคัญ |
| Native plugin *(ทางหลัก)* | Codex App/CLI | `codex plugin marketplace add affaan-m/ECC` → `codex plugin add ecc@ecc` · ใน Codex เรียก `$configure-ecc` | 281 skills · 1 default MCP (Chrome DevTools) · lifecycle-hook projection · scripts · assets | hooks ต้อง trust ผ่าน `/hooks` · verified เฉพาะ synchronous `SessionStart` (Codex 0.146) · handlers ที่ block tools/async/ผิด protocol ถูกตัดออก · plugin state เดียวใน `CODEX_HOME` |
| Sync *(deprecated)* | Codex App/CLI | `scripts/sync-ecc-to-codex.sh` | config 1 · `AGENTS.md` 2 · skills 32 · MCP 6 (7 เมื่อเพิ่ม Supabase) · profiles 2 · roles 3 · copied/merged config ใน `~/.codex` | ไม่มี native-plugin hook runtime |
| Beta project adapter | Cursor | `install.sh --target cursor <lang>` (full) หรือ `--profile minimal` (ย่อ) | 15 hook events (ที่ ECC adapter รองรับ · Cursor platform เปิดให้ 20 · Claude Code ที่ใช้เทียบ 8) · 16 scripts · 34 rules · 48 agents · skills · commands · MCP ผ่าน `.cursor/hooks/adapter.js` | hook set ยังไม่เท่ากัน ([#2419](https://github.com/affaan-m/ECC/issues/2419)) |
| Beta plugin | OpenCode | build plugin | subset ของ catalog | pin Anthropic models ([#2617](https://github.com/affaan-m/ECC/issues/2617)) |
| Instruction-only | GitHub Copilot | instructions + prompt files | instructions เท่านั้น | ไม่มี hooks / agents / skill discovery |
| Experimental | Gemini · Zed · Antigravity · Qwen · Hermes · OpenClaw · Kimi · CodeBuddy · JoyCode | selective target | file placement | ไม่เคลม parity |
| Directory only | Trae · Kiro · Pi | — | มี `.trae/` `.kiro/` `.pi/` ใน repo แต่ไม่มี guide กำกับ | ยังไม่ยืนยัน |

**อ่านอย่างไร:** Cursor ไม่ใช่ "skills + rules เท่านั้น" — เป็น adapter เกือบครบ แต่ upstream ระบุ Beta และ hook set ยังไม่เท่ากัน (`--profile minimal` เป็นตัวเลือกติดตั้ง ไม่ใช่เพดานความสามารถ) · Codex ต้องดูเป็นราย distribution path ไม่ใช่ราย platform · Kimi อยู่กลุ่ม experimental · `/ecc:` namespace ใช้ได้เฉพาะ Claude Code

> README ของ ECC ปนข้อมูล Codex สอง generation — matrix ที่เขียนว่า "No ECC hook runtime" อธิบาย sync path และล้าหลัง native-plugin docs · **อย่าเอาตัวเลขหรือข้อจำกัดของสอง path มารวมกัน** · ตารางเทียบ 4 แหล่งฉบับเต็มอยู่ใน `skill-collections-20260815.md` §12.1.1

### 12.2 taste-skill — จับคู่ skill กับปลายทาง

| ปลายทาง | ตัวที่เกี่ยวข้อง |
|---|---|
| ทุก coding agent | `design-taste-frontend` · style variants · `redesign-existing-projects` · `full-output-enforcement` |
| Codex (เพิ่ม) | `image-to-code` (generate ภาพ design ก่อนแล้ว implement ตามภาพ) |
| ChatGPT / GPT models | `gpt-taste` |
| Google Stitch | `stitch-design-taste` |
| เครื่องมือ generate ภาพ | `imagegen-frontend-web` / `imagegen-frontend-mobile` / `brandkit` |

### 12.3 ข้อสรุปเชิงเลือกใช้

- **ใช้เนื้อหาเดียวกันข้ามแพลตฟอร์มได้ดี:** karpathy · mattpocock · maestro · taste-skill · founder-skills · Hallmark · anti-slop · no-ai-slop · book-to-skill — แต่ **ต้องติดตั้งและตรวจ integration แยกต่อ harness เสมอ**
- **พึ่ง hooks/agents/commands:** superpowers · ecc · orchestkit · caveman · ponytail · aidlc-workflows · ReMe · Ruflo · claude-ops · prompt-improver — ได้เนื้อ skill ทุกที่ ส่วน automation ต้องดูราย harness
- superpowers ยืนยัน hook parity เฉพาะ Antigravity · ECC ต้องอ่านราย distribution path (§12.1.1)
- `--profile minimal` เป็น **ตัวเลือกตอนติดตั้ง** ไม่ใช่เพดานของแพลตฟอร์ม
- **prune skill ต้องตัดสินต่อแพลตฟอร์ม** — เช่น `image-to-code` ไร้ประโยชน์บน Claude Code แต่เป็นตัวหลักบน Codex

### 12.4 Harness ที่อ่าน SKILL.md ได้เอง (ฝั่งผู้บริโภค)

> §12.1 ตอบว่า "upstream ประกาศรองรับ harness ไหน" — ตารางนี้ตอบว่า "harness ไหนอ่าน `SKILL.md` ได้เอง" · อ่านไฟล์ได้ ≠ ใช้งานได้ครบ ต้องตรวจ frontmatter, tool names, scripts, paths, permissions และ smoke test · documented ไม่ใช่ tested (ตรวจ 2026-08-15)

| Harness | อ่าน `SKILL.md` | หลักฐาน | หมายเหตุ |
|---|:-:|---|---|
| Qoder (IDE + CLI) | ✓ native | [extensions/skills](https://docs.qoder.com/extensions/skills) · [cloud-agents/skills](https://docs.qoder.com/cloud-agents/skills) — แต่ละ skill เป็น `SKILL.md` + auxiliary files · model เลือกโหลดจาก description | user-level และ project-level · ทำงานเหมือนกันทั้ง IDE และ CLI |
| Mistral Vibe | ✓ native | [mistralai/mistral-vibe](https://github.com/mistralai/mistral-vibe) — `SkillManager` crawl หา `SKILL.md` | MCP · hooks · permissions · saved sessions · community catalog [agentskill.sh/vibe](https://agentskill.sh/vibe) (ไม่ใช่ upstream evidence) |
| DeepSeek Harness | ✓ compatible | [deepseek.com/harness](https://deepseek.com/harness/en/) · [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — "everything is a plugin" (models · tools · skills · sessions · sandboxes · loops) · repo ใช้ `SKILL.md` ผ่าน `.agents/skills/` | developer preview · `dsh` launcher |
| Grok Build CLI | ✓ ผ่าน plugin | `grok plugin install superpowers@xai-official --trust` | 1 ใน 14 targets ของ superpowers |
| Factory Droid | ✓ ผ่าน plugin | `droid plugin install superpowers@superpowers` | — |
| MiMo CLI | △ คนละ spec | [KoinaAI/MiMo-CLI](https://github.com/KoinaAI/MiMo-CLI) — flat `*.md` ใน `.mimo/skills/` (project) หรือ `~/.mimo-code/skills/` (global) · frontmatter `name` `description` `triggers` (array keyword) `always` (bool) · ต้องประกาศใน `~/.mimo-code/config.json` หรือ `.mimo-code.json` | **ไม่ใช่ drop-in** ต้องแปลงก่อน · มี `AGENTS.md` · hooks (`session_start` `user_prompt` `after_tool`) · MCP stdio · subagents `.mimo/agents/*.md` ครบ |
| Freebuff | ? | [CodebuffAI/freebuff](https://github.com/CodebuffAI/freebuff) — ใช้ `AGENTS.md` + `@codebuff/sdk` | ยังไม่พบหลักฐาน `SKILL.md` |
| Ollama | — | model runner ไม่ใช่ harness | ใช้เป็น backend ของ harness อื่น |

เกณฑ์ที่ควรถามคือ **"อ่านไฟล์รูปแบบไหน และ route ด้วยอะไร"** ไม่ใช่แค่ "มีระบบ skills หรือเปล่า"

**ผลต่อการเลือกใช้:**
- collection ที่เป็น markdown ล้วน (karpathy · mattpocock · addyosmani · founder-skills · taste-skill · Hallmark · anti-slop · no-ai-slop) เป็น candidate สำหรับ pilot บน Qoder / Mistral Vibe / DeepSeek Harness เมื่อวางไฟล์ใน path ที่รองรับ แต่ยังต้องตรวจ frontmatter, tool names, scripts, paths, permissions และ smoke test ราย collection
- collection ที่พึ่ง hooks/agents/commands/namespace (superpowers · ecc · orchestkit · caveman · ponytail · aidlc-workflows · Ruflo) ได้เฉพาะเนื้อ skill — automation ต้องดูราย harness ตาม §12.1
- Mistral Vibe มี integration surface ค่อนข้างกว้างตามเอกสาร upstream (hooks + MCP + permissions) แต่การจัดอันดับเทียบ harness อื่นต้อง benchmark/runtime test แยก
- MiMo CLI รองรับ skills เต็มรูปแบบแต่คนละ spec — ต้องเขียน converter หรือแปลงมือก่อนใช้

---

## 13. Decision Guide ตามชนิดงาน

| สถานการณ์ | Stack/เครื่องมือที่แนะนำ |
|---|---|
| โปรเจกต์ทั่วไปขนาดเล็ก / solo | karpathy + superpowers |
| token เป็นต้นทุนหลัก | rtk/headroom (+ pilot caveman แทน karpathy) |
| ทีมใช้หลาย harness ต้องการ baseline เดียวกัน | pilot ponytail (หลัง audit hooks) |
| อยากได้วินัยแบบ principle-driven | pstack ราย skill (`how` · `why` · `interrogate` · `principle-*`) |
| เน้น reasoning/design ก่อน coding | karpathy + mattpocock (grilling, codebase-design, domain-modeling) |
| full SDLC แบบเบา | karpathy + addyosmani |
| โปรเจกต์ใหญ่/หลาย domain/หลายภาษา | karpathy + ECC แบบ selective (หรือ pilot orchestkit แทน ECC) |
| TypeScript / frontend หนัก | mattpocock + superpowers |
| ความถูกต้องสูง (prod/security) | karpathy + `doubt-driven-development` + `systematic-debugging` |
| สร้าง LLM/RAG/agent product | SDLC stack + maestro (+ headroom ถ้า token เป็นคอขวด) |
| จูนเวิร์กโฟลว์ coding agent เอง | maestro (`/diagnose` → `/fortify` → `/refine`) |
| orchestration platform เต็มรูปแบบ | ประเมิน Ruflo แทน maestro/ECC orchestration |
| Founder/GTM/pricing/SOP | founder-skills แบบ selective |
| Product UI / a11y | ui-skills **หรือ** ux-ui-agent-skills (มี design system/Figma) |
| Landing/portfolio/redesign | taste-skill **หรือ** Hallmark |
| ข้อความไม่ให้ดูเหมือน AI เขียน | no-ai-slop |
| Infographic/data storytelling | AntV Infographic |
| Architecture diagram จาก codebase | archify |
| SVG diagram ที่ต้องมี gate กันภาพผิด | fireworks-tech-graph |
| Diagram ชนิดพิเศษ (Wardley/Sankey/journey) | diagram-design |
| Defensive security audit | security-audit-skill · หรือ Codex Security official runtime |
| Reverse engineering ที่ได้รับอนุญาต | reverse-skill **หรือ** rea (allowlist + sandbox) |
| Privacy compliance / DPIA | Privacy-Data-Protection-Skills เฉพาะ jurisdiction |
| ประมวลผล video/audio | ffmpeg-skill (root `SKILL.md`) |
| แปลงหนังสือ/เอกสารภายในเป็น skill | book-to-skill + acceptance gate §17 |
| งาน Unity | Unity-MCP เฉพาะโปรเจกต์ |
| Durable background AI workflows | Trigger.dev skills เฉพาะโปรเจกต์ |
| Codebase graph/context | Graphify, Graft หรือ Understand-Anything |
| Team skill registry | SkillHub |
| Auto-select skills ตาม tech stack | autoskills dry-run + human review |
| PDF/document ingestion | MarkPDFdown / olmocr / PageIndex / Unstract wrapper + gates §10 |
| Web crawling | Scrapy wrapper + legal/robots/rate-limit |
| Process/port/container diagnosis | witr wrapper |
| Lifecycle ครบ idea→ops แบบมี gate และตรวจย้อนหลังได้ (org ที่ใช้ AWS/Kiro) | aidlc-workflows — Pilot ในโปรเจกต์แยก ไม่ซ้อน process/SDLC อื่น |
| ให้ agent ควบคุมซอฟต์แวร์ GUI/เดสก์ท็อป (3D, GIS, เสียง, e-book) ที่ไม่มี API | CLI-Anything ราย CLI + ซอฟต์แวร์ต้นทางในเครื่อง |
| memory ข้าม session เป็นไฟล์ Markdown ที่ผู้ใช้คุมเอง | ReMe — Pilot โหมดไม่ใช้ LLM ก่อน |
| หาซอฟต์แวร์ self-hosted ทดแทน SaaS (backend ของ RAG/เอกสาร/memory) | awesome-selfhosted (อ่านเป็นรายการ ไม่ใช่ skill — §21) |

---

## 14. Routing และ Collision Rules

### 14.1 Baseline collision

```text
เลือกหนึ่งตัวเป็น global:
  karpathy   กฎพฤติกรรม 4 ข้อ (เล็กที่สุด)
  caveman    บังคับตอบสั้น ลด token (Pilot)
  ponytail   baseline + hooks หลาย harness (Pilot)
```

### 14.2 Process collision

```text
เลือกหนึ่งตัวเป็นหลัก:
  superpowers    วินัยแบบ rigid + meta-router
  pstack         หยิบราย skill — ห้ามเปิดทั้งชุดคู่ superpowers
  aidlc-workflows  workflow engine ที่แทนทั้ง process และ SDLC (§14.3) — Pilot
```

### 14.3 SDLC collision

```text
เลือกหนึ่งตัว:
  mattpocock     thinking/control
  addyosmani     lightweight production playbook
  ecc            broad domain/language framework
  orchestkit     ทางเลือกแทน ecc (hooks หนัก)
  aidlc-workflows  ถ้าเลือกตัวนี้ ไม่ต้องมี process collection (§14.2) และ SDLC collection อื่น
```

### 14.4 Agent workflow collision

```text
เลือกหนึ่งแกนหลัก:
  maestro        audit/refine/context/tools/RAG/guardrails
  ruflo          orchestration/meta-harness/swarm platform
  ECC subset     เมื่อใช้ ECC อยู่แล้วและต้องการบาง agent skills
```

### 14.5 Frontend และ visual collision

```text
product UI / a11y / design system        -> ui-skills OR ux-ui-agent-skills
marketing page / landing / portfolio     -> taste-skill OR Hallmark
anti-slop UI/code (ไม่มี design หลัก)     -> anti-slop
infographic                              -> AntV Infographic
technical diagram                        -> archify OR fireworks OR diagram-design
```

### 14.6 Text anti-slop

```text
no-ai-slop  OR  antislop-copywriting + antislop-human — อย่างใดอย่างหนึ่ง
```

### 14.7 Code-context collision

```text
Graphify OR Graft OR Understand-Anything
อย่าเปิด hooks/indexers หลายชุดกับ repository เดียวก่อน benchmark
```

### 14.8 Security routing

- defensive audit → `security-audit-skill` ก่อนเสมอ · offensive/reverse → `reverse-skill` **หรือ** `rea` ตัวเดียว
- security skill ต้องไม่ auto-trigger จากข้อความกำกวม
- ยืนยัน defensive/authorized scope ก่อน
- แยก scan/review ออกจาก exploit/remediation
- network, install, privilege escalation และ destructive actions ต้องมี approval
- เก็บ evidence, command log และ target boundaries

### 14.9 Memory layer collision

```text
เลือกหนึ่งชั้นต่อโปรเจกต์:
  ReMe                    memory เป็นไฟล์ Markdown local (hook + MCP; งาน LLM ส่งเนื้อหาไป endpoint ที่ตั้ง)
  TencentDB-Agent-Memory  shared memory ระดับทีม (ต้องมี ACL/retention)
  maestro `.maestro/`     decision log + audit ในตัว maestro (ไม่ใช่ memory ของบทสนทนาทั่วไป)
  ECC `unified-memory`    เมื่อใช้ ECC อยู่แล้ว
```

หลายชั้นพร้อมกัน = บทสนทนาถูกจับซ้ำหลาย hook และ recall ปนกัน (ยังไม่ได้ทดสอบจริง)

---

## 15. ความทับซ้อนรายคู่ (Pairwise Overlap)

| คู่ | ทับซ้อน | คำแนะนำ |
|---|:-:|---|
| **karpathy ↔ caveman ↔ ponytail** | **สูง (ทั้งสามคู่)** | baseline เดียวกัน — เลือกตัวเดียว |
| **superpowers ↔ pstack** | **สูง** | tdd / planning / review ซ้ำ — pstack ใช้ราย skill |
| pstack ↔ mattpocock | กลาง | `tdd` `teach` ซ้ำชื่อ — เลือกฝั่งเดียวต่อ skill |
| pstack ↔ maestro | ต่ำ–กลาง | ซ้ำเฉพาะ `reflect` |
| addyosmani ↔ ecc | **สูงมาก** | ecc ครอบ addyosmani — เลือกตัวเดียว |
| **orchestkit ↔ ecc** | **สูงมาก** | full-SDLC + hooks — เลือกตัวเดียว |
| orchestkit ↔ addyosmani | สูง | เลือกตัวเดียว |
| superpowers ↔ addyosmani | กลาง | superpowers เข้มกว่าด้านวินัย |
| mattpocock ↔ ecc | กลาง | ecc กว้างกว่า, mattpocock ลึกด้าน thinking |
| superpowers ↔ mattpocock | ต่ำ | เสริมกัน (process ↔ thinking tools) |
| superpowers ↔ ecc | กลาง | superpowers rigid กว่า |
| karpathy ↔ SDLC/verticals | ~0 | เนื้อหาไม่ชน (ยังนับ context/routing) |
| maestro ↔ ecc | กลาง (subset) | ecc กระจัดกระจาย, maestro รวมศูนย์ + memory/audit |
| maestro ↔ superpowers / addyosmani / mattpocock | ต่ำ | subject ต่าง |
| **maestro ↔ ruflo** | **สูง** | subject เดียวกัน — เลือกตัวเดียว |
| maestro ↔ headroom / rtk | ~0 (เสริมกัน) | ความรู้เรื่อง context budget vs เครื่องจักรลด token |
| headroom ↔ rtk | ต่ำ | คนละจุดใน pipeline (context ทั่วไป vs command output) — ใช้คู่ได้ |
| taste-skill ↔ addyosmani / ecc | กลาง (frontend) | addyosmani `frontend-ui-engineering` กว้างแต่ตื้นกว่า · ecc มี `frontend-design-direction` `design-system` `frontend-patterns` — เลือกฝั่งเดียวสำหรับ frontend design |
| **taste-skill ↔ Hallmark** | **สูงมาก** | เลือกตัวเดียว |
| **taste-skill ↔ ui-skills / ux-ui** | สูง (คนละ surface) | marketing vs product UI — แยก routing |
| **ui-skills ↔ ux-ui-agent-skills** | **สูง** | product UI เดียวกัน — เลือกตัวเดียว |
| ui-skills / ux-ui ↔ addyosmani / ecc | กลาง | frontend/a11y ซ้ำบางส่วน |
| **anti-slop ↔ taste-skill / Hallmark** | **สูง (UI)** | มี design หลักแล้วไม่ต้องเปิด `antislop-ui` |
| **anti-slop ↔ no-ai-slop** | **สูง (text)** | เลือก text skill ฝั่งเดียว (§14.6) |
| **archify ↔ fireworks ↔ diagram-design** | **สูง** | เลือกตัวเดียวต่อโปรเจกต์ |
| diagram ↔ Infographic | ต่ำ–กลาง | technical diagram vs data storytelling |
| founder-skills ↔ ecc | ต่ำ–กลาง | founder-skills ลึกกว่าด้าน GTM/pricing |
| founder-skills ↔ claude-ops | ต่ำ | strategy vs ops automation |
| founder-skills ↔ taste-skill | ต่ำ (เฉพาะ CRO/copy) | เสียบร่วมกันได้ |
| Infographic ↔ taste-skill | ต่ำ–กลาง | structured infographic vs page design — คนละ output |
| **reverse-skill ↔ rea** | **สูงมาก** | reverse engineering เดียวกัน — เลือกตัวเดียว |
| reverse-skill / rea ↔ ecc security | สูง | ecc มี `security-review` `bounty-hunter` |
| security-audit-skill ↔ ecc security / addy hardening | กลาง | ใช้ security-audit-skill เป็น workflow audit หลัก |
| Privacy-Data-Protection ↔ ecc healthcare | กลาง | `hipaa-compliance` `healthcare-phi-compliance` ซ้ำ |
| Atlas ↔ superpowers / mattpocock | กลาง | planning/review ซ้ำ — ใช้เป็น reference |
| Atlas ↔ anthropics/skills | สูง | ชื่อ skill ซ้ำ 6 ตัว (§5.9) |
| **Graphify ↔ Graft ↔ Understand-Anything** | **สูงมาก** | เลือกตัวเดียว |
| **aidlc-workflows ↔ superpowers / pstack** | **สูงมาก** | workflow + gate ทั้งวงจรซ้ำกับ process discipline — ใช้ aidlc แทน |
| **aidlc-workflows ↔ mattpocock / addyosmani / ECC / orchestkit** | **สูงมาก** | spec→plan→build→ship ซ้ำ — เลือกตัวเดียว |
| **ReMe ↔ TencentDB-Agent-Memory** | **สูง** | memory ของบทสนทนาเหมือนกัน (ส่วนตัว vs ทีม) — เลือกชั้นเดียว (§14.9) |
| ReMe ↔ maestro `.maestro/` | ต่ำ–กลาง | `.maestro/` เป็น decision log + audit ของ workflow ไม่ใช่ memory ของบทสนทนา — ใช้คู่กันได้ถ้า hook ไม่จับซ้ำ |
| CLI-Anything ↔ ffmpeg-skill / Unity-MCP / diagram tools | ต่ำ–กลาง | ซ้อนเฉพาะงานซอฟต์แวร์ตัวเดียวกัน (เช่น วิดีโอ, Unity) — เลือกเครื่องมือเดียวต่อซอฟต์แวร์ |

---

## 16. Installation Guidance

> ตรวจ README และ pin revision ก่อนติดตั้งจริง — คำสั่ง upstream เปลี่ยนตามเวลา

### Core collections

```bash
npx skills add multica-ai/andrej-karpathy-skills          # karpathy
npx skills add https://github.com/obra/superpowers        # superpowers (เนื้อ skill; native plugin ดู §12.1)
npx skills@latest add mattpocock/skills                   # mattpocock
npx skills add addyosmani/agent-skills                    # addyosmani
npx skills add https://github.com/affaan-m/ECC            # ecc (เนื้อ skill นอก Claude Code)
npx skills add sharpdeveye/maestro                        # maestro
npx skills add https://github.com/Leonxlnx/taste-skill    # taste-skill
```

**Claude Code (native plugin):** superpowers ใช้ marketplace `obra/superpowers-marketplace` → `plugin install superpowers` · ecc/addyosmani ใช้ marketplace plugin

### Verticals เดิม

```bash
npx skills add https://github.com/ognjengt/founder-skills
npx ui-skills start
npx skills add https://github.com/antvis/Infographic
npx skills add nutlope/hallmark
npx autoskills --dry-run
```

### Candidates รอบ 2026-10-15

> **ยังไม่ได้ทดสอบคำสั่งติดตั้ง** — ใช้ installation path ตาม README ของแต่ละ repo · repo ที่เป็น markdown ล้วน (anti-slop, no-ai-slop, book-to-skill) มักใช้ `npx skills add <repo-url>` ได้ แต่ต้องยืนยันก่อน · **Atlas ไม่ติดตั้ง** (ไม่มี license — §5.9)

- **มี plugin/adapter ของตัวเอง — ใช้ทางของ upstream:** caveman · ponytail · pstack (Cursor plugin) / pstack-claude · orchestkit · diagram-design · Unity-MCP
- **มี CLI ต้องติดตั้ง runtime:** archify (Node) · fireworks-tech-graph (Python + `cairosvg`/`ffmpeg` optional) · rtk · witr · ffmpeg-skill (Python 3.9)
- **ติดตั้งเฉพาะไฟล์ที่ต้องการ:** ffmpeg-skill (root `SKILL.md` เท่านั้น) · Privacy-Data-Protection-Skills (ราย jurisdiction) · pstack (ราย skill) · CLI-Anything (ราย CLI — ครั้งแรกไม่ใส่ `-g -y`)
- **รอบเพิ่ม 4 repo (อ่านจากเอกสาร ยังไม่ได้ติดตั้งทดสอบ):** aidlc-workflows — **ใส่ `--version x.y.z` เสมอ** (ค่าเริ่มต้นคือ `releases/latest`) · ReMe — `pip install "reme-ai[core]"` ใน venv แยก (SKILL.md ของ ReMe เองบอกให้ถามผู้ใช้ก่อน) · CLI-Anything — `pip` ใน venv แยกต่อ CLI · awesome-selfhosted — ไม่ติดตั้ง (รายการ)

### ห้ามติดตั้งอัตโนมัติทั้ง repo

`reverse-skill` · `rea` · `claude-ops` · `claude-code-guide` → clone/inspect → เลือกโมดูล → pin revision → ติดตั้งผ่าน governed process

สำหรับ Ruflo, Codex Security, Trigger.dev, SkillHub, Graphify, Graft, Understand-Anything, headroom ให้ใช้ installation path ของผลิตภัณฑ์และตรวจ side effects ทุกครั้ง

---

## 17. Acceptance Gate ก่อนรับ Skill/Pack ใหม่

### Structure

- [ ] มี `SKILL.md` และ frontmatter ถูกต้อง
- [ ] ชื่อ, description, trigger และ scope สอดคล้องกัน
- [ ] references/scripts ใช้ progressive loading
- [ ] ไม่มี router description ซ้ำกับ skill ที่ติดตั้งอยู่
- [ ] แยก skill ที่ใช้งานจริงออกจาก mirror และ dev-workflow skill ของ repo
- [ ] เทียบจำนวนไฟล์ทั้ง repo กับจำนวน `SKILL.md` — ratio ต่ำ (< ~3%) ต้องเปิดดูว่าที่เหลือคือ runtime/installer ที่รันได้ หรือแค่ตัวอย่าง/asset · ถ้ามี installer ให้ติดตั้งแบบ skill-only แทน

### Quality

- [ ] มี representative tasks และ expected outputs
- [ ] มี negative/non-trigger tests
- [ ] ผ่าน regression test บน runtime เป้าหมาย
- [ ] ไม่มี claims ที่ไม่มีหลักฐานหรือ technical references ที่ล้าสมัย

### Security and governance

- [ ] ระบุ upstream, commit/version, **license** และ checksum — repo ที่ไม่มี license ห้ามใช้เชิงพาณิชย์จนกว่าเจ้าของยืนยัน
- [ ] ตรวจว่า skill ไม่ได้ก๊อปมาจากแหล่งอื่นที่มี license ต่างกัน
- [ ] review scripts, hooks, daemons, network calls และ dependency installation
- [ ] มี credential/data-egress policy
- [ ] มี human approval สำหรับ destructive, security, ingestion และ publish actions
- [ ] มี rollback/uninstall path

### Cost and operations

- [ ] วัดขนาด `SKILL.md` และ references
- [ ] วัด token/tool discovery overhead
- [ ] ตรวจ files/configs ที่ installer แก้ไข
- [ ] กำหนด timeout/retry/cost ceiling
- [ ] ดู maintenance cadence (§3.0) ประกอบการเลือก
- [ ] ไม่เปิด overlapping collections เกินความจำเป็น

---

## 18. สถานะ Catalog

| กลุ่ม | รายการ | สถานะ |
|---|---|---|
| Behavioral baseline | karpathy · caveman · ponytail | karpathy = Keep (default) · caveman / ponytail = Pilot |
| Process discipline | superpowers · pstack / pstack-claude | Choose one (superpowers = default · pstack ราย skill) |
| SDLC | mattpocock · addyosmani · ECC · orchestkit | Choose one |
| Agent workflow | maestro · Ruflo | Choose one (maestro = Keep when relevant · Ruflo = Pilot) |
| Design direction | taste-skill · Hallmark | Choose one |
| Product UI | ui-skills · ux-ui-agent-skills | Choose one (Add opt-in) |
| Anti-slop | anti-slop · no-ai-slop | Add selective ราย surface |
| Business | founder-skills | Add selective |
| Infographic | AntV Infographic | Add selective |
| Diagram | archify · fireworks-tech-graph · diagram-design | Choose one ต่อโปรเจกต์ |
| Security (defensive) | security-audit-skill | Add selective |
| Security (reverse) | reverse-skill · rea | Restricted · choose one |
| Compliance | Privacy-Data-Protection-Skills | Add selective ราย jurisdiction |
| Media | ffmpeg-skill | Add selective (root file) |
| Methodology | Atlas · claude-code-best-practice | Reference (Atlas ไม่มี license) |
| Ops automation | claude-ops | Pilot (isolated) |
| Lifecycle workflow engine | aidlc-workflows | Pilot — โปรเจกต์แยก · แทน process+SDLC ไม่ซ้อน |
| Software-to-CLI harness | CLI-Anything | Add selective ราย CLI |
| Agent memory | ReMe | Pilot — เลือกหนึ่งชั้น (§14.9) |
| Large external catalog | claude-code-guide | Reference — curate only |
| Product-specific | Codex Security · Trigger.dev · typesafe-ai · Unity-MCP | Per-project |
| Code graph/context | Graphify · Graft · Understand-Anything | Choose one after benchmark |
| Skill infrastructure | autoskills · SkillHub · book-to-skill | Dry-run + review · Governance pilot · Add selective |
| Runtime token reduction | headroom · rtk | Companion — ใช้คู่กันได้ |
| MCP/tools/frameworks | รายการใน §9–§11 | Companion |
| ไม่เข้าเกณฑ์ | รายการใน §21 | Excluded |

### สรุปสั้น (1 บรรทัด/ชุด)

- **karpathy** → นิสัยเขียนโค้ดที่ดี 1 ไฟล์ ใส่ทุกโปรเจกต์
- **caveman** → baseline ที่บังคับตอบสั้น ประหยัด token
- **ponytail** → baseline พร้อม hooks และ adapter หลาย harness
- **superpowers** → วินัยกระบวนการที่บังคับทำตามเป๊ะ
- **pstack** → สไตล์ agent แบบ poteto — หยิบหลักการและ skill รายตัว
- **mattpocock** → เครื่องมือคิด/วางแผนสำหรับ engineer ที่อยากคุมเอง
- **addyosmani** → playbook ครบ SDLC แบบเบา spec→ship
- **ecc** → ซูเปอร์มาร์เก็ตครบทุกภาษา/domain/orchestration หยิบเฉพาะที่ใช้
- **orchestkit** → คู่แข่ง ecc ที่ hooks หนัก community เล็ก
- **maestro** → โค้ชเวิร์กโฟลว์ของ AI agent พร้อม memory/audit/cost — เงียบตั้งแต่ เม.ย.
- **taste-skill** → รสนิยม design สำหรับ landing/portfolio ระวัง context ~87KB
- **ui-skills / ux-ui-agent-skills** → ผู้ตรวจ product UI (ตัวหลังเน้น design system/Figma)
- **anti-slop / no-ai-slop** → กันงานหน้าตา AI (UI-code / text)
- **founder-skills** → ที่ปรึกษาธุรกิจ GTM/pricing/SOP
- **Infographic** → โรงงาน infographic ผูก renderer ของ AntV
- **archify / fireworks / diagram-design** → diagram ครบ pipeline / เข้ม gate / หลายชนิด
- **security-audit-skill** → audit แบบ defensive จาก Cloudflare
- **reverse-skill / rea** → reverse engineering ที่ต้องมีใบอนุญาตก่อนแตะ
- **Privacy-Data-Protection-Skills** → คลัง compliance ใหญ่ หยิบราย jurisdiction
- **ffmpeg-skill** → media processing ด้วย stdlib ล้วน
- **headroom / rtk** → เครื่องลด token ตอน runtime ไม่ใช่ skill
- **aidlc-workflows** → workflow engine 33 stage/11 scope ของ AWS ที่ผูก hook ทุก tool call — Pilot ในโปรเจกต์แยก
- **CLI-Anything** → registry ของ CLI ที่ให้ agent ใช้ซอฟต์แวร์จริง — หยิบราย CLI ระวัง supply chain ของ hub
- **ReMe** → memory เป็นไฟล์ Markdown local — โหมด LLM ส่งบทสนทนาไป endpoint ที่ตั้ง

---

## 19. ภาคผนวก

ตารางเปรียบเทียบละเอียด A–F (Identity · Positioning · Capability matrix แกน A ราย phase · จุดแข็ง/จุดอ่อน · Capability matrix แกน B) ของ 7 core collections เดิม แยกไว้ใน `skill-collections-appendix-20261015.md` (ไม่จำเป็นต่อการใช้ไฟล์นี้)

ข้อสรุปหลักจากภาคผนวก:
- แถว **Observability/logging** มีแค่ addyosmani ที่ครอบเต็ม
- **domain packs และ language patterns** เป็น moat ของ ecc บนแกน A
- **workflow slop linter · persistent memory · audit + cost · effectiveness scorecard** เป็น moat ของ maestro บนแกน B — รอบ 10-15 ไม่ได้ประเมินว่ามีชุดใหม่ที่แทนได้หรือไม่
- headroom เด่นแถวเดียว (context budget ตอน runtime) แต่เป็นแถวที่ไม่มี skill ใดทำได้จริง จึงใช้คู่ ไม่ใช่แทน

---

## 20. แหล่งอ้างอิง

### Core collections

- karpathy — <https://github.com/multica-ai/andrej-karpathy-skills>
- caveman — <https://github.com/JuliusBrussee/caveman>
- ponytail — <https://github.com/DietrichGebert/ponytail>
- superpowers — <https://github.com/obra/superpowers> · marketplace `obra/superpowers-marketplace`
- pstack — <https://github.com/cursor/plugins/tree/main/pstack> · port: <https://github.com/michael-denyer/pstack-claude>
- mattpocock — <https://github.com/mattpocock/skills>
- addyosmani — <https://github.com/addyosmani/agent-skills>
- ecc — <https://github.com/affaan-m/ECC>
- orchestkit — <https://github.com/yonatangross/orchestkit>
- maestro — <https://github.com/sharpdeveye/maestro> · MCP `maestro-workflow-mcp` · VS Code `sharpdeveye.maestro-workflow`
- taste-skill — <https://github.com/Leonxlnx/taste-skill> · <https://tasteskill.dev>
- aidlc-workflows — <https://github.com/awslabs/aidlc-workflows>

### Hybrid ที่มีหัวข้อละเอียด (§6)

- CLI-Anything — <https://github.com/HKUDS/CLI-Anything> · hub <https://hkuds.github.io/CLI-Anything/>
- ReMe — <https://github.com/agentscope-ai/ReMe> · docs <https://reme.agentscope.io>

### repo อื่นทั้งหมด

ลิงก์ของ verticals, hybrid/product-specific packs, infrastructure และ tools อยู่ในตารางของ §5–§11 (ไม่ซ้ำที่นี่เพื่อไม่ให้ลิงก์เพี้ยนระหว่างสองที่)

### Harness (§12.4)

- <https://docs.qoder.com/extensions/skills> · <https://github.com/mistralai/mistral-vibe> · <https://github.com/deepseek-ai/deepseek-harness> · <https://github.com/xai-org/plugin-marketplace> · <https://github.com/KoinaAI/MiMo-CLI> · <https://github.com/CodebuffAI/freebuff>

### References (ไม่ติดตั้ง)

- <https://github.com/asgeirtj/system_prompts_leaks> — คลัง system prompt จาก vendor

---

## 21. Repositories ที่ประเมินแล้วไม่เข้าเกณฑ์ Collection

| Repository | ประเภทจริง | เหตุผล |
|---|---|---|
| [`awesome-selfhosted/awesome-selfhosted`](https://github.com/awesome-selfhosted/awesome-selfhosted) *(10-16)* | รายการซอฟต์แวร์ self-hosted (CC-BY-SA-3.0 — API ตอบ `NOASSERTION`) | ไม่มี `SKILL.md` (6 ไฟล์) · **README ~330 KB อย่าโหลดเข้า context ทั้งไฟล์** · ใช้เป็นแหล่งหา backend self-hosted สำหรับ RAG/เอกสาร/memory (§10–§11) · ข้อมูลจริงอยู่ที่ repo `awesome-selfhosted-data` |
| `LockedinLabs-AI/agent-console` *(10-15)* | — | repo หาย (Gone) — ตัดจนกว่า URL ใช้ได้ |
| `tonhowtf/omniget` *(10-15)* | — | 404 — ตัดจนกว่า URL ใช้ได้ |
| `blue-yonder/tsfresh` *(10-15)* | Python library | ไม่มี `SKILL.md` |
| `Botspot/pi-apps` *(10-15)* | app store สำหรับ Raspberry Pi (GPL-3.0) | ไม่มี `SKILL.md` |
| `ConduitPlatform/Conduit` *(10-15)* | backend template | ไม่มี `SKILL.md` |
| `johnxie/awesome-code-docs` *(10-15)* | awesome list | reference |
| `awesome-opencode/awesome-opencode` *(10-15)* | awesome list (CC0) | reference |
| `666ghj/MiroFish` *(10-15)* | swarm engine (AGPL-3.0) | ไม่มี `SKILL.md` |
| `rahulnyk/knowledge_graph` | notebook/pipeline | ไม่มี installable skills |
| `marc-shade/world-intel-mcp` | MCP server | เพิ่ม tools ไม่เพิ่ม skill content |
| `danish296/codevibes` | application | external evaluator |
| `TencentDB-Agent-Memory` | memory service | adapter ไม่ทำให้เป็น collection |
| `full-stack-ai-agent-template` | template | application scaffold |
| `MarkPDFdown` | CLI/API | ต้องทำ wrapper |
| `autoskills` | installer | จัดการ skills ไม่ใช่ content |
| `Local_Knowledge_Graph` | Python/Ollama framework | custom license |
| `claude-code-sub-agents` | agent definitions | ไม่มี `SKILL.md` |
| `Dive` | desktop MCP host | runtime platform |
| `claude-context` | semantic-search MCP | retrieval service |
| `prompt-forge` | prompt workbench | QA application |
| `CCPlugins` | slash commands | ไม่ใช่ Agent Skills |
| `Morphik Core` | retrieval platform | service/framework |
| `Scrapy` | crawling framework | library |
| `Promptflow` | LLM workflow framework | platform |
| `TEN Framework` | realtime agent framework | domain runtime |
| `paperless-gpt` | document application | ผูก paperless-ngx |
| `Unstract` | extraction platform | service/MCP |
| `SkillHub` | registry | infrastructure |
| `headroomlabs-ai/headroom` | runtime compression | `SKILL.md` = 0 (ยืนยันซ้ำ 10-15) — ใช้เป็น tool เสริมแกน B ได้ (§9) |
| `PageIndex` · `olmocr` · `pdfcraft` · `pdf-mcp` *(10-15)* | tools | `SKILL.md` = 0 — Companion |
| `asgeirtj/system_prompts_leaks` | คลัง system prompt (CC0) | reference ให้คนศึกษา · ส่วน `bundled-skills/` ติดมากับ Claude Code อยู่แล้ว · เป็น prompt ที่หลุดมา ไม่ควร copy ไปใช้ |

**เกณฑ์:** skill collection ต้อง "ติดตั้งแล้วเปลี่ยนพฤติกรรม agent ได้" (มี `SKILL.md` + frontmatter ให้ router เลือกโหลด) — passive reference ไม่นับ

---

## 22. Change Log

> ประวัติทุกรอบอยู่ใน `skill-collections-changelog.md` · ที่นี่สรุปเฉพาะสองรอบล่าสุด · ตัวเลข ⭐ ดู §3.0

### 2026-10-16

**เพิ่ม:** 4 repo — aidlc-workflows (§4.12 Pilot) · CLI-Anything (§6) · ReMe (§6, §9, §14.9) · awesome-selfhosted (§21 Excluded/Reference) · กฎ memory layer (§14.9) · aidlc ใน collision §14.2–§14.3

**เปลี่ยน:** caveman/ponytail ปรับเป็น Pilot · refresh ⭐/pushed/license ของ repo 08-15 ทุกตัว และเพิ่ม mattpocock / addyosmani / karpathy เข้า §3.0 · karpathy ไม่มีไฟล์ LICENSE และเงียบ ~6 เดือน · audit frontmatter caveman (22) และ ponytail (6) — แก้คำอธิบาย caveman ที่เดิมผิด (product monorepo ~1,785 ไฟล์ · Apache-2.0 เฉพาะ ≥ 3.0.0) · ยืนยันพฤติกรรมของ ponytail (comment `shortcut:` · codebase map) · สแกนขนาดทั้ง repo เทียบ `SKILL.md` 37 repo (§2, §17) · อ่าน installer ของ caveman และ orchestkit (§4.2, §4.9) · ยืนยันความหมายของ `Edit(/**)` จากเอกสาร Claude Code (§4.12) · แก้ตามรีวิวรอบสาม (รายละเอียดใน changelog)

**ตัด/ย้าย:** §20 ตัดลิงก์ที่ซ้ำกับตาราง §5–§11 · ตัด ⭐ ที่ซ้ำนอก §3.0 (§6, §22)

### 2026-10-15

**เพิ่ม:** repo ใหม่ 27 ตัว (ใหม่ 35 − ตัดออก 8 · skill/pack 23 + companion 4) และตรวจซ้ำของเดิม 3 รวมเข้าหมวดเดิม (Layer 0: caveman, ponytail · Layer 1: pstack · Layer 2: orchestkit · verticals ใหม่: diagram, anti-slop, compliance, media, methodology · hybrid/product-specific: rtk, witr, WeKnora, claude-ops, Unity-MCP, typesafe-ai) · กฎชนใหม่ (`reverse-skill ↔ rea` · `ui-skills ↔ ux-ui-agent-skills` · `orchestkit ↔ ECC` · text skills ของ anti-slop ↔ no-ai-slop) · แถวใหม่ใน §13 และ §15 · ผล benchmark diagram (T)

**เปลี่ยน:** ตัวเลขทั้งหมดรวมที่ §3.0 · คำตัดสินชุดเดียวทั้งเอกสาร (§2) · `witr` ยืนยัน Apache-2.0 และมี `SKILL.md` 1 ไฟล์ · เพิ่มกฎ design-quality rules ใน §1.3

**ตัด/ย้าย:** ตารางตรวจ repo + benchmark ฉบับเต็ม → `skill-collections-repo-analysis-20261015.md` · ภาคผนวก A–F → `skill-collections-appendix-20261015.md` · change log ย้อนหลัง → `skill-collections-changelog.md` · ตาราง 4 แหล่งของ README ECC ย่อเหลือสรุปใน §12.1.1 · **เนื้อหาของ 08-15 บางส่วนยังถูกย่อ** (รายการที่กู้คืนแล้วและที่ยังย่ออยู่ดู `skill-collections-changelog.md` รอบ 2026-10-16) — ฉบับเต็มอยู่ที่ `skill-collections-20260815.md`
