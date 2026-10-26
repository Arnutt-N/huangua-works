# Skill Collections — รายงานตรวจ repo รอบ 2026-10-15

> ไฟล์หลักฐานของ `skill-collections-20261015.md` (catalog) — catalog ใช้งานได้โดยไม่ต้องมีไฟล์นี้
> ขอบเขต: §1–§7 = ลิสต์ repo ที่ผู้ใช้ส่งมา (38 repo — ดูหมายเหตุใต้ตาราง §2) ตรวจผ่าน GitHub API เมื่อ 2026-10-15 + ตรวจซ้ำ 3 รายการจากฉบับ 08-15 (`ui-skills` `headroom` `witr`) · §8 = สแกนขนาด repo 37 ตัว (รวม core collections เดิม) 2026-10-16 · §9 = รอบเพิ่ม 4 repo 2026-10-16
> ตัวเลขใน §2 เป็น snapshot วันที่ 10-15 — ค่าล่าสุดและสถานะปัจจุบันดู catalog §3.0 และ §18
> รูปแบบเดียวกับ `skill-collections-repo-analysis-20260815.md` (รายงานรอบก่อน)

---

## 1. วิธีตรวจ

| รายการ | วิธี | ข้อจำกัด |
|---|---|---|
| ⭐ / pushed / license | GitHub REST API (`/repos/{owner}/{repo}`) | license อ่านจาก field `license` — ถ้าเป็น `null` ตรวจ root ซ้ำด้วยมือ |
| จำนวน `SKILL.md` | นับไฟล์ชื่อ `SKILL.md` ใน recursive git tree | **นับไฟล์ ไม่ใช่นับ skill** — รวมไฟล์ซ้ำข้าม mirror (`plugins/` + `skills/`, adapter ราย harness) และ test fixture |
| frontmatter | อ่าน `name` / `description` รายไฟล์ | รอบ 10-15 audit 13 ไฟล์ในกลุ่ม ADD (§4) · รอบ 10-16 เพิ่ม caveman 22 + ponytail 6 (catalog §4.2–§4.3) — ที่เหลือยังไม่ audit |
| benchmark diagram | clone แบบ shallow ลงโฟลเดอร์ชั่วคราว แล้วรัน renderer/validator ตรง | brief เดียวกัน 1 ชุด + fixture ทางการ — ไม่ใช่ benchmark เชิงสถิติ |

---

## 2. ตารางผลตรวจ (38 repo)

| # | Repository | ⭐ | pushed | License | `SKILL.md` (ไฟล์) | ประเภท (taxonomy §2 ของ catalog) | สถานะ |
|---:|---|---:|---|---|---:|---|---|
| 1 | `cursor/plugins` (tree `pstack/`) | 11,510 | 2026-10-15 | MIT (`pstack/LICENSE`, Lauren Tan) | ~50 dirs | Core collection (process) | Choose one กับ superpowers |
| 2 | `michael-denyer/pstack-claude` | 2,118 | 2026-10-14 | MIT | 61 | Core collection (port) | ใช้แทน pstack นอก Cursor |
| 3 | `plugin87/ux-ui-agent-skills` | 1,823 | 2026-10-10 | MIT | 26 | Domain vertical (UI) | Choose one กับ ui-skills |
| 4 | `rtk-ai/rtk` | 83,442 | 2026-10-15 | Apache-2.0 | 12 | Hybrid pack (CLI proxy + skills) | Companion |
| 5 | `JuliusBrussee/caveman` | 112,117 | 2026-10-15 | Apache-2.0 | 28 (ไม่ซ้ำ 22) | Core collection (baseline) | Pilot *(10-16 — เดิม Choose one baseline)* |
| 6 | `DietrichGebert/ponytail` | 164,048 | 2026-10-15 | MIT | 13 (รวม mirror `.openclaw/skills/`) | Core collection (baseline) | Pilot *(10-16 — เดิม Choose one baseline)* |
| 7 | `morluto/rea` | 259,256 | 2026-10-15 | MIT | 4 | Domain vertical (security) | Restricted |
| 8 | `cathrynlavery/diagram-design` | 55,678 | 2026-10-14 | MIT | 1 | Single skill | Choose one diagram |
| 9 | `tt-a1i/archify` | 83,903 | 2026-10-15 | MIT | 5 | Hybrid pack (skill + CLI) | Choose one diagram |
| 10 | `yizhiyanhua-ai/fireworks-tech-graph` | 11,736 | 2026-09-05 | MIT | 2 | Hybrid pack (skill + CLI) | Choose one diagram |
| 11 | `cloudflare/security-audit-skill` | 29,744 | 2026-09-14 | MIT | 1 | Single skill | Add selective |
| 12 | `syahiidkamil/Software-Engineer-AI-Agent-Atlas` | 401 | 2026-06-25 | **ไม่มี** (`null`, ตรวจ root ซ้ำแล้ว) | 21 | Reference | Reference + selective |
| 13 | `VectifyAI/PageIndex` | 39,135 | 2026-10-15 | MIT | 0 | Tool companion | Companion |
| 14 | `Lifecycle-Innovations-Limited/claude-ops` | 545 | 2026-10-14 | MIT | 69 | Hybrid pack (skills + daemon) | Pilot |
| 15 | `johnxie/awesome-code-docs` | 65 | 2026-10-12 | MIT | 0 | Reference | Excluded |
| 16 | `ConduitPlatform/Conduit` | 924 | 2026-10-13 | MIT | 0 | Template | Excluded |
| 17 | `Botspot/pi-apps` | 2,832 | 2026-10-15 | GPL-3.0 | 0 | Application | Excluded |
| 18 | `LockedinLabs-AI/agent-console` | — | — | — | — | — | Excluded (repo Gone) |
| 19 | `miqdadbadjuber/anti-slop` | 6,148 | 2026-10-13 | MIT | 6 | Domain vertical (anti-slop) | Add selective |
| 20 | `typesafe-ai/skills` | 2,704 | 2026-09-12 | MIT | 1 | Product-specific pack | Per-project only |
| 21 | `shanraisshan/claude-code-best-practice` | 67,578 | 2026-10-15 | MIT | 10 | Reference | Reference |
| 22 | `petergyang/no-ai-slop` | 12,388 | 2026-09-02 | MIT | 1 | Single skill | Add selective |
| 23 | `yonatangross/orchestkit` | 293 | 2026-10-15 | MIT | 236 (119 dirs) | Core collection (SDLC) | Choose one กับ ECC |
| 24 | `blue-yonder/tsfresh` | 9,473 | 2026-07-06 | MIT | 0 | Python library | Excluded |
| 25 | `tonhowtf/omniget` | — | — | — | — | — | Excluded (404) |
| 26 | `PDFCraftTool/pdfcraft` | 9,294 | 2026-10-14 | AGPL-3.0 | 0 | Tool companion | Companion |
| 27 | `Tencent/WeKnora` | 34,146 | 2026-10-15 | other | 5 | Hybrid pack (RAG + CLI skills) | Companion — อ่าน license ก่อน |
| 28 | `allenai/olmocr` | 19,747 | 2026-03-25 | Apache-2.0 | 0 | Tool companion | Companion (เงียบ ~6.5 เดือน) |
| 29 | `virgiliojr94/book-to-skill` | 34,934 | 2026-10-12 | MIT | 1 | Infrastructure (single skill) | Add selective |
| 30 | `kajisho5/ffmpeg-skill` | 1,952 | 2026-10-15 | MIT | 14 (media จริง 1) | Single skill + scripts/MCP | Add selective |
| 31 | `awesome-opencode/awesome-opencode` | 10,587 | 2026-07-03 | CC0-1.0 | 0 | Reference list | Excluded |
| 32 | `mukul975/Privacy-Data-Protection-Skills` | 307 | 2026-03-16 | Apache-2.0 | 824 | Domain vertical (compliance) | Add selective (เงียบ ~7 เดือน) |
| 33 | `666ghj/MiroFish` | 79,375 | 2026-10-01 | AGPL-3.0 | 0 | Swarm engine | Excluded |
| 34 | `IvanMurzak/Unity-MCP` | 4,463 | 2026-10-15 | Apache-2.0 | 25 | Product-specific pack (MCP + skills) | Per-project only |
| 35 | `I-CAN-hack/pdf-mcp` | 79 | 2026-07-30 | MIT | 0 | Tool companion | Companion |
| 36 | `ibelick/ui-skills` *(ตรวจซ้ำ)* | 9,761 | 2026-10-15 | MIT *(ยืนยัน 10-16)* | 9 | Domain vertical (UI) | Add opt-in |
| 37 | `pranshuparmar/witr` *(ตรวจซ้ำ)* | 22,700 | 2026-10-04 | Apache-2.0 *(ยืนยัน 10-15)* | 1 | Hybrid pack (CLI + skill) | Companion |
| 38 | `headroomlabs-ai/headroom` *(ตรวจซ้ำ)* | 75,406 | 2026-10-15 | Apache-2.0 *(ยืนยัน 10-16)* | 0 | Tool companion | Companion |
> ตารางมี 38 repo แต่ร่างแรกของรอบนี้ระบุว่า "39 รายการ" — ส่วนต่าง 1 รายการน่าจะมาจากลิงก์ `cursor/plugins` สองลิงก์ (tree `pstack/` และ blob `poteto-mode/SKILL.md`) ที่ชี้ repo เดียวกัน · ยังไม่ได้ยืนยันกับลิสต์ต้นฉบับ

---

## 3. หลักฐานโครงสร้างรายกลุ่ม

### 3.1 pstack

- `cursor/plugins/pstack/skills/` ~50 dirs — ที่ตั้งชื่อเฉพาะ: `architect` `arena` `automate-me` `benchmark-checklist` `blast-radius` `bro` `correct` `figure-it-out` `how` `interrogate` `reflect` `swarm` `tdd` `teach` `technical-writing` `typescript-best-practices` `unslop` `why` + กลุ่ม `principle-*` + `poteto-mode`
- `poteto-mode/SKILL.md` 20,362 bytes + `playbooks/` `references/` `scripts/`
- `pstack-claude` 61 ไฟล์ — port สู่ Claude Code / Codex / Copilot / Pi / OpenCode / Gemini

### 3.2 caveman / ponytail / rtk

> **ตรวจเพิ่ม 2026-10-16 (รายละเอียดอยู่ใน catalog §4.2–§4.3):** caveman เป็น product monorepo ~1,785 ไฟล์ (proxy/engine เป็น Go, CLI, extension, MCP, mem, supabase) ไม่ใช่ collection ล้วน · license Apache-2.0 เฉพาะ ≥ 3.0.0 (ก่อนหน้านั้น MIT + BSL 1.1) และ Caveman Cloud เป็นบริการเชิงพาณิชย์แยก · ponytail 13 ไฟล์ = 6 skills + mirror 6 + benchmark fixture 1 (สำเนา caveman) · bullet ด้านล่างนับ `SKILL.md` เท่านั้น ไม่สะท้อนขนาดจริงของ caveman

- `caveman` 28 ไฟล์ = ไม่ซ้ำ 22 + mirror 6 (`plugins/caveman/skills/*` ซ้ำ `skills/*`: `caveman` `caveman-compress` `caveman-stats` `cavecrew` `megacave` `ultracave`) · มี `commands/` `agents/` `benchmarks/` · plugin manifests `.claude-plugin` `.cursor-plugin` `.codex`
- `ponytail` 13 ไฟล์ = `skills/ponytail*` + mirror `.openclaw/skills/*` · มี `hooks/` `commands/` + adapters `.codex-plugin` `.cursor` `.opencode` `.qoder-plugin` และของ kimi/grok/devin
- `rtk` 12 ไฟล์ใน `.claude/skills/` (`rtk-tdd` `rtk-triage` `security-guardian` `ship` ฯลฯ) — ตัวตนหลักคือ CLI proxy

### 3.3 orchestkit

- 236 ไฟล์ชื่อ `SKILL.md` ตรงตัว → 119 dirs หลังตัดชื่อซ้ำ
- ไฟล์ eval `no-skill.md` 7 ไฟล์ และ `test-skill-md.sh` ไม่นับ (ไม่ใช่ skill)
- **119 dirs ยังรวม mirror ราย harness** (`plugins/ork-codex/skills/ork-*` ฯลฯ) จึงไม่ใช่จำนวน skill ไม่ซ้ำ — ใช้ตัวเลข README (**106 skills**, **171 hooks**) เป็นค่าอ้างอิงจนกว่าจะ dedupe ข้าม harness

### 3.4 Security

- `cloudflare/security-audit-skill` — `skills/security-audit/SKILL.md` · findings แบบ machine-readable
- `morluto/rea` — `.agents/skills/reverse-engineer-anything` + `rea-changelog-update` `rea-ci-tests-audit` `rea-tool-design` (สามตัวหลังเป็น dev-workflow ของ repo)

### 3.5 UI / anti-slop

- `ux-ui-agent-skills` — `.claude/skills/` (`a11y-audit` `design-tokens` `design-qa` `design-review` `figma-integration` `gate` `governance` ฯลฯ) · README อ้าง 52 components / WCAG
- `anti-slop` — `antislop` `antislop-code` `antislop-copywriting` `antislop-human` `antislop-layoutmobile` `antislop-ui` (**`copywriting` และ `human` เป็น text** — ทับ `no-ai-slop`)
- `no-ai-slop` — `skills/no-ai-slop/SKILL.md` · text 20+ patterns

### 3.6 Methodology / ops

- Atlas — `.claude/skills/` 20 ตัว: `abstraction-power` `adversarial-review` `algorithmic-art` `anthropic-product-knowledge` `find-skills` `free-will` `frontend-design` `human-writing` `learning-from-mistakes` `mcp-builder` `pdf` `playwright-cli` `postgresql-code-review` `postgresql-optimization` `shadcn` `skill-creator` `supabase-postgres-best-practices` `super-product-owner` `super-ui-ux-design` `theme-factory`
  - ⚠️ `algorithmic-art` `frontend-design` `mcp-builder` `pdf` `skill-creator` `theme-factory` ชื่อตรงกับ skill ของ `anthropics/skills` — ถ้าเป็นสำเนา จะติด license ของต้นฉบับ (บางตัวเป็น source-available ไม่ใช่ open source) ซ้อนกับการที่ Atlas เองไม่มี license
- `claude-code-best-practice` — `.claude/skills/` (`agent-browser` `presentation/*` `time-skill` `weather-*` ฯลฯ) — ตัวอย่างประกอบ methodology
- `claude-ops` — `claude-ops/skills/ops-*` (AWS / comms / daemon / deploy / monitoring / revenue) + `boss` `flow` `ledger`

### 3.7 Compliance / doc / media

- `Privacy-Data-Protection-Skills` — `plugins/ai-privacy-governance-skills/skills/*` · GDPR / CCPA / EU AI Act / HIPAA / LGPD / PIPL / DPDP
- `book-to-skill` — `SKILL.md` ไฟล์เดียว
- `ffmpeg-skill` — **root `SKILL.md` คือ media skill จริง** (`name: ffmpeg-skill`, 42 scripts, MCP 12 core / 42 เต็ม, Python 3.9 stdlib, ไม่ใช้ cloud/keys) · `.claude/skills/` 13 ตัวเป็น dev-workflow ของ repo (`code-review` `mcp-server-design` `release-management` ฯลฯ)
- `WeKnora` — `cli/skills/weknora-rag-search` `weknora-shared` + examples
- `Unity-MCP` — 25 ไฟล์ ผูกกับ Unity plugin + MCP

---

## 4. Frontmatter audit (13 ไฟล์ กลุ่ม ADD)

| Skill | สรุปจาก `description` |
|---|---|
| `how` (pstack) | code walkthrough / หาที่วางโค้ด |
| `poteto-mode` (pstack) | ตอบกระชับ · unslopped prose · verified work |
| `design-review` (ux-ui) | review 6 มิติ + Nielsen heuristics |
| `gate` (ux-ui) | one-command quality gate |
| `reverse-engineer-anything` (rea) | native / managed / Electron / firmware · metadata v42 |
| `security-audit` (Cloudflare) | codebase / API / CLI / daemon · full workflow เฉพาะเมื่อสั่ง audit ชัดเจน |
| `book-to-skill` | PDF / EPUB / DOCX / HTML / MD / RTF / MOBI → skill |
| `diagram-design` | 44 แบบ · HTML / SVG / PNG + import drawio / Mermaid / excalidraw · v2.6 |
| `archify` | explorable HTML + inline SVG + dark/light + export SVG/WebM · v3.1 |
| `fireworks-tech-graph` | SVG → PNG / HTML / GIF |
| `ffmpeg-skill` | 42 scripts + MCP 12/42 · stdlib ล้วน |
| `adversarial-review` (Atlas) | hostile second opinion ที่รัน target จริง |
| `ai-dpia` (Privacy) | DPIA ตาม EDPB 04/2025 |

---

## 5. Benchmark diagram (รันจริง 2026-10-15)

วิธี: shallow clone ทั้ง 3 repo ลงโฟลเดอร์ชั่วคราว รัน renderer/validator ตรงด้วย brief เดียวกัน (6 nodes / 5 edges) + fixture ทางการของแต่ละตัว

| | archify | fireworks-tech-graph | diagram-design |
|---|---|---|---|
| Pipeline | `finalize architecture` → 4 gates (`validate` / `deliver` / `check` / `browser-check`) | `validate` → `render` → `check` → `export-html` | ไม่มี CLI/renderer — วาดมือตาม SKILL (30KB) + type reference แล้วรัน `self_check.py` |
| Same-brief | ✅ ผ่านทุก gate ~15s · มี route advisory (bends เกิน) แต่ไม่ fail | ❌ ติด composition gate ซ้ำ (`EDGE_MICRO_SEGMENT` · `EDGE_BEND_BUDGET` · legend intersects · route ไม่ผ่าน) — ต้องลดเหลือ 3 nodes และตัด label ลูกศรถึงผ่าน | — (ไม่มี renderer ให้รัน brief) |
| Fixture ทางการ | — | ✅ 11 nodes / 10 edges ~4s | ✅ `self_check.py` ผ่าน |
| ขนาด output | HTML ~813KB (ฝัง viewer runtime) | SVG 27KB / HTML 36KB | ตัวอย่าง 12KB |
| Type coverage | architecture | technical graph | **44–45 types** (frontmatter v2.6 ระบุ 44 · การนับใน repo ได้ 45 — ยังไม่กระทบคำตัดสิน) |
| Dependencies | Node (`bin/archify.mjs`) | Python stdlib + `cairosvg`/`ffmpeg` (optional) | Python (`self_check.py`) |
| สรุป | pipeline ครบที่สุดสำหรับ code-backed architecture | renderer เข้มที่สุด (fail ดีกว่าวาดผิด) แต่ authoring ยากที่สุด — ลอก geometry จาก fixture อย่าเขียนเอง | coverage กว้างที่สุด แต่ไม่มี automation — คุณภาพขึ้นกับคนวาด |

คำตัดสิน: architecture จาก codebase → **archify** · SVG ที่ต้องมี gate กันภาพผิด → **fireworks** · diagram ชนิดพิเศษ (Wardley / Sankey / journey) → **diagram-design** · เลือกตัวเดียวต่อโปรเจกต์

---

## 6. License ที่ยืนยันรอบนี้

`archify` MIT · `awesome-code-docs` MIT · `Conduit` MIT · `pi-apps` GPL-3.0 · `witr` Apache-2.0 · `tsfresh` MIT · `pdfcraft` AGPL-3.0 · `awesome-opencode` CC0-1.0 · `pstack/LICENSE` MIT (Lauren Tan, ตรวจไฟล์ base64) · Atlas ไม่มีไฟล์ license (มีแค่ `.claude/` `.github/` `docs/` `bin/` ฯลฯ)

---

## 7. ยังไม่ได้ตรวจ

- frontmatter ของไฟล์นอก 13 ตัวใน §4 และนอก caveman/ponytail
- dedupe orchestkit ข้าม harness (§3.3)
- adapter/plugin ของ `ux-ui-agent-skills` · `archify` · `fireworks` · `security-audit-skill` · `ffmpeg-skill` (ช่อง `?` ใน §12 ของ catalog)
- commit pin ของ candidate ทุกตัว
- ~~⭐ ของ repo ฉบับ 08-15 ที่ไม่อยู่ในลิสต์รอบนี้~~ · ~~license ของ `ui-skills` และ `headroom`~~ — ตรวจแล้ว 10-16 (catalog §3.0)
- งานค้างอื่นของรอบ 10-16 รวมอยู่ในตาราง "ยังไม่ verify" ของ catalog §3.0

---

## 8. ขนาด repo เทียบจำนวน skill (สแกน 2026-10-16)

วิธี: `git/trees/HEAD?recursive=1` ผ่าน GitHub API นับไฟล์ทุกชนิด (blob) เทียบกับไฟล์ที่ชื่อลงท้าย `SKILL.md` — ทุก repo ไม่ถูก truncate · **นับไฟล์เท่านั้น ไม่ใช่นับ skill ไม่ซ้ำ** (รวม mirror และ fixture) และตัวเลข `SKILL.md` ต่างจาก §2 เล็กน้อยเพราะ pattern การนับต่างกัน (`*SKILL.md` เทียบ `SKILL.md` ตรงตัว) · เรียงจาก ratio ต่ำไปสูง

| Repository | ไฟล์ทั้ง repo | `SKILL.md` | % |
|---|---:|---:|---:|
| headroomlabs-ai/headroom | 2,641 | 0 | 0.0 |
| Tencent/WeKnora | 5,083 | 5 | 0.1 |
| morluto/rea | 4,057 | 4 | 0.1 |
| cathrynlavery/diagram-design | 681 | 1 | 0.1 |
| pranshuparmar/witr | 1,171 | 1 | 0.1 |
| Nutlope/hallmark | 286 | 1 | 0.3 |
| tt-a1i/archify | 1,017 | 5 | 0.5 |
| antvis/Infographic | 778 | 5 | 0.6 |
| yizhiyanhua-ai/fireworks-tech-graph | 297 | 2 | 0.7 |
| virgiliojr94/book-to-skill | 130 | 1 | 0.8 |
| IvanMurzak/Unity-MCP | 2,547 | 25 | 1.0 |
| rtk-ai/rtk | 798 | 12 | 1.5 |
| JuliusBrussee/caveman | 1,785 | 28 | 1.6 |
| shanraisshan/claude-code-best-practice | 454 | 10 | 2.2 |
| yonatangross/orchestkit | 9,006 | 243 | 2.7 |
| ibelick/ui-skills | 272 | 8 | 2.9 |
| plugin87/ux-ui-agent-skills | 640 | 26 | 4.1 |
| kajisho5/ffmpeg-skill | 323 | 14 | 4.3 |
| cloudflare/security-audit-skill | 22 | 1 | 4.5 |
| ruvnet/ruflo | 7,837 | 380 | 4.8 |
| Lifecycle-Innovations-Limited/claude-ops | 1,143 | 69 | 6.0 |
| obra/superpowers | 238 | 15 | 6.3 |
| DietrichGebert/ponytail | 202 | 13 | 6.4 |
| petergyang/no-ai-slop | 14 | 1 | 7.1 |
| miqdadbadjuber/anti-slop | 59 | 6 | 10.2 |
| syahiidkamil/Software-Engineer-AI-Agent-Atlas | 200 | 21 | 10.5 |
| multica-ai/andrej-karpathy-skills | 9 | 1 | 11.1 |
| addyosmani/agent-skills | 217 | 25 | 11.5 |
| cursor/plugins (ทั้ง repo — pstack เป็นส่วนย่อย) | 947 | 112 | 11.8 |
| zhaoxuya520/reverse-skill | 599 | 89 | 14.9 |
| Leonxlnx/taste-skill | 89 | 14 | 15.7 |
| sharpdeveye/maestro | 141 | 25 | 17.7 |
| michael-denyer/pstack-claude | 366 | 66 | 18.0 |
| mukul975/Privacy-Data-Protection-Skills | 4,172 | 824 | 19.8 |
| mattpocock/skills | 190 | 38 | 20.0 |
| affaan-m/ECC | 4,621 | 1,062 | 23.0 |
| ognjengt/founder-skills | 46 | 15 | 32.6 |

**ratio ต่ำมีสองแบบ — ต้องเปิดดูองค์ประกอบ ไม่ใช่ตัดสินจากตัวเลข** (เปิดดูแล้วเฉพาะ 5 ตัวด้านล่าง):

| Repo | องค์ประกอบจริงที่เห็น | ผลต่อการตัดสินใจ |
|---|---|---|
| **caveman** | product monorepo: `proxy/` 419 + `engine/` 258 (Go) · `packages/` 456 · `extension/` · `mcp/` · `mem/` · `installer/` · `supabase/` | skills เป็นแค่ 1 surface · installer แก้ `settings.json` (catalog §4.2) |
| **rea** | **แอป TypeScript:** `src/` 1,978 · `tests/` 1,240 · `scripts/` 399 · `website/` 93 · `bridge/` 32 · `.ts` 3,008 ไฟล์ · มี `install.sh` | ไม่ใช่ pack ของ markdown — พื้นผิว review ใหญ่กว่าที่ "4 SKILL.md" บอก · ยืนยันการจัดเป็น Restricted |
| **orchestkit** | `docs/` 2,530 · `src/` 2,504 · `plugins/` 1,872 · `.html` 1,067 ไฟล์ · installer: `bin/install-git-hooks.sh` · `bin/install-hooks.sh` · `install-codex-profile.sh` · `install-codex-roles.sh` · `hooks/dist/setup.mjs` | **อ่านแล้ว 2026-10-16:** สคริปต์ git hooks เป็นของ contributor ไม่ใช่ขั้นติดตั้ง · profile Codex ตั้ง `approval_policy="never"` + `network_access=true` (มีผลเมื่อสั่ง `--profile`) — รายละเอียด catalog §4.9 |
| **diagram-design** | skill เดี่ยว + ตัวอย่าง/asset: `.html` 218 · `.png` 92 · `.svg` 88 · `.webp` 48 · `scripts/` 181 (`.py` 92) | ไม่ใช่ product — หยิบเฉพาะ `SKILL.md` + references ได้ |
| **archify** | `test/` 291 · `docs/` 179 · `archify/` 157 · `website/` 92 · มี **`archify.zip` 5.0 MB** commit อยู่ใน repo | ตรวจเนื้อ zip ไม่ได้ — ติดตั้งจาก source ไม่ใช่จาก zip (**ยังไม่ได้เปิดดูเนื้อ zip**) |

ที่ยังไม่ได้เปิดดูองค์ประกอบ: headroom · WeKnora · witr · Hallmark · Infographic · fireworks · book-to-skill · Unity-MCP · rtk · best-practice · ui-skills

---

## 9. รอบเพิ่ม 4 repo (สแกน 2026-10-16)

| Repository | ⭐ | License | pushed | ไฟล์ทั้ง repo | `SKILL.md` | % |
|---|---:|---|---|---:|---:|---:|
| awesome-selfhosted/awesome-selfhosted | 327,102 | CC-BY-SA-3.0 (ไฟล์ `LICENSE`; API ตอบ `NOASSERTION`) | 2026-10-15 | 6 | 0 | 0.0 |
| HKUDS/CLI-Anything | 53,161 | Apache-2.0 | 2026-09-22 | 1,872 | 151 | 8.1 |
| awslabs/aidlc-workflows | 5,336 | MIT-0 | 2026-10-16 | 1,857 | 14 | 0.8 |
| agentscope-ai/ReMe | 3,625 | Apache-2.0 | 2026-10-16 | 888 | 7 | 0.8 |

**องค์ประกอบที่เห็น:**
- **CLI-Anything:** แยกเป็นโฟลเดอร์ต่อซอฟต์แวร์ (`mailchimp` 49 · `unimol_tools` 47 · `macrocli` 40 · `iterm2` 39 · `freecad` 36 · `audacity` 34 ฯลฯ) แต่ละอันมี `agent-harness/cli_anything/<ชื่อ>/skills/SKILL.md` + top-level `skills/` (71 ไฟล์) ที่ README ว่ารวมเป็นแหล่ง canonical · `cli-hub-matrix/` มี SKILL.md ราย domain (3d-cad · game-development · image-design · knowledge-research · video-creation) · `SKILL.md` 151 ไฟล์ **ไม่ได้ dedupe** ระหว่างสำเนาใน harness กับ `skills/`
- **aidlc-workflows:** `tests/` 1,233 (66%) · `core/` 274 · `harness/` 112 · `docs/` 107 · `plugins/` 18 · `SKILL.md` 14 ไฟล์ = 4 ใน `core/skills/` + สำเนาราย harness (claude · codex · copilot · cursor ×4 · kiro · kiro-ide · opencode)
- **ReMe:** `reme/` 221 (แพ็กเกจ Python) · `reme_studio/` 149 · `integrations/` 133 · `tests/` 111 · `docs/` 86 · `plugins/` 78 · `SKILL.md` 7 ไฟล์ = `skills/` 5 (`dingtalk-message` `qwenpaw_memory` `reme_memory` `serper-search` `tushare-data`) + สำเนา `reme-memory` ใน integration ของ Claude Code และ Codex
- **awesome-selfhosted:** `README.md` ~330 KB (2,367 บรรทัด) + `non-free.md` + `LICENSE` — ข้อมูลจริงถูกดูแลใน repo แยกตาม badge ใน README

**สิ่งที่ตรวจเพิ่ม (รายละเอียดใน catalog §4.12 และ §6):**
- aidlc: `docs/guide/18-install-and-lifecycle.md` (สแกนคีย์เวิร์ด checksum/attestation/version — 66 hits) · `harness/claude/settings.json` + `.mcp.json`
- ReMe: รายการไฟล์ `integrations/claude_code/` และ `integrations/codex/` — พบ `hooks/hooks.json` · `hooks/auto_memory.py` · `.mcp.json` · `mcp_bridge.py`/`mcp_server.py`
- CLI-Anything: sample `blender/…/SKILL.md` (300 บรรทัด) และ README ส่วนต้น

---

## 10. caveman — installer และ Caveman Cloud (ย้ายจาก catalog §4.2 รอบ 2026-10-16)

> ข้อความยกมาจาก catalog ตามเดิมไม่แก้เนื้อหา — catalog เหลือสรุปและคำแนะนำ

### 10.1 installer

- **installer (อ่านโค้ดแล้ว 2026-10-16 — `install.sh` ทั้งไฟล์ · `host-hooks.js` · `settings.js` · สแกน `install.js` 2,840 บรรทัด):**
  - ตรวจหา agent ที่ติดตั้งอยู่ในเครื่อง แล้วติดตั้งให้ host ที่ตรวจเจอ (Claude · Codex · Cursor · Windsurf · Cline · Continue · Kilo · Roo · Augment · Copilot · Amp · Gemini · Hermes · OpenClaw) โดยเรียก `npx skills add` ต่อ host · ดาวน์โหลดไฟล์จาก `raw.githubusercontent.com/<ref>` ด้วย `curl` · ติดตั้ง Claude plugin ผ่าน `claude plugin marketplace add` / `plugin install` · ค่า ref อ่านจาก env `CAVEMAN_REF` (ค่าเริ่มต้น `v4.0.1`) — พฤติกรรมเริ่มต้นเทียบ `--all` / `--only` ยังไม่ได้ยืนยัน
  - **เส้นทาง curl-pipe ดึง git tag (`github:JuliusBrussee/caveman#v4.0.1`) ซึ่งย้ายได้ — ควร pin เป็น commit SHA** · ตัวอย่างใน comment ของ `install.sh` ยัง pin ที่ `v1.10.0` (ก่อน 3.0.0 จึงอยู่ใต้ license เดิม) อย่าคัดลอกคำสั่งจาก comment
  - หลังติดตั้งรัน `npx -y @caveman-ai/cli@4.0.1 setup` (npm package ตัวที่สอง — อ่านแล้ว ดูหัวข้อ Caveman Cloud ด้านล่าง) ยกเว้นใส่ `--non-interactive` (พิมพ์คำสั่งแทน) · `--dry-run` / `--list` / `-u|--uninstall` / `--help` ข้ามขั้นนี้
  - การแก้ `settings.json`: เขียน atomic (temp + rename, mode 0600) · เพิ่ม hook แบบ idempotent · ลบเฉพาะ hook ที่ basename ของสคริปต์ตรงกับของตัวเอง (เก็บ hook แปลกปลอมไว้) · **comment ในไฟล์ไม่รอด** — ถ้าไฟล์มี comment จะสำรอง `settings.json.bak` ให้ครั้งเดียวพร้อมเตือน (ไม่สำรองถ้าไฟล์ไม่มี comment)
  - ไม่พบโค้ด telemetry / credentials / gateway ใน `install.js` และ `owned-install.js` (สแกนคีย์เวิร์ด 0 hits) · มี checksum (`src/hooks/checksums.sha256`) และ symlink guard · ลบแบบ recursive เฉพาะ staging/scratch/extension dir ตามชื่อตัวแปร (ยังไม่ได้ตรวจทุกเส้นทาง)
  - คำแนะนำ: รัน `--dry-run --non-interactive` ก่อน · จำกัด host ด้วย `--only claude` · หรือใช้ plugin marketplace แทนสคริปต์

### 10.2 Caveman Cloud ฝั่ง CLI และ telemetry

- **Caveman Cloud ฝั่ง CLI (อ่าน `packages/cli/src/modules/cloud.ts` + สแกน `onboard.ts` 2026-10-16 — ข้อความด้านล่างคือที่ upstream เปิดเผยเองใน CLI):**
  - `caveman setup` มี `--yes` / `--dry-run` / `--only` / `--skip` · ไม่มี terminal (เช่น CI) จะไม่เปลี่ยนอะไรจนกว่าจะใส่ `--yes` · Cloud คือ `https://api.caveman.so` (เปลี่ยนได้ด้วย `baseURL` หรือ env `CAVE_API_URL`) · sign-in ผ่านเบราว์เซอร์ (device code) จึงทำแบบไม่มีคนไม่ได้
  - **โมดูล routing (Auto ในตัวเลือกโมเดลของ agent):** เมื่อเปิด ทุก request บน Auto ส่ง **คำสั่งล่าสุด (พร้อมสิ่งที่ agent แนบ) + คำสั่งก่อนหน้า + ท้ายคำตอบล่าสุดของ agent + ข้อมูล request (tools, effort, headers, จำนวน token) ไปยัง Caveman Cloud** เพื่อเลือกโมเดล · **แพ็กเกจ Free "อาจเก็บข้อมูลเหล่านี้เพื่อปรับปรุง routing"** · request จริงไปที่ provider ด้วย key ของผู้ใช้ มีเฉพาะที่ route ไปโมเดลของ Caveman Cloud ที่ผ่าน Cloud · ปิดด้วย `caveman off routing`
  - **runtime data ต่อ request — ยืนยันจากซอร์ส Go (`proxy/internal/cloudlink/events.go` อ่านเต็มไฟล์):** ส่งเฉพาะเมื่อ **sign-in แล้ว** (ยังไม่ sign-in = ไม่ส่งเลย) และไม่ส่งเมื่อ offline หรือปิดด้วย `telemetry.enabled=false` / `DO_NOT_TRACK` / `CAVEMAN_TELEMETRY=0` · ถ้า sign-in แล้วถือเป็น **opt-out ไม่ใช่ opt-in** · POST `/api/v1/runtime/events` เป็น batch ≤ 500 ทุก 10 วินาที เก็บใน memory และทิ้งเมื่อส่งไม่สำเร็จ
  - **ฟิลด์ที่ส่งตามระดับ:** ทุกระดับ = event id · เวลา · `install_id` · ชื่อ agent · provider · billing basis (`api_key`/`subscription`) · สถานะแต่ละ stage · ระดับ `usage` เพิ่มชื่อโมเดลที่ขอ/ที่ใช้ + จำนวน token + token ที่ตัดออกจาก context · ระดับ `decisions` เพิ่มผล routing + เหตุผล + decision id · **struct ของ event ไม่มีฟิลด์ข้อความ prompt/คำตอบ** ตรงกับที่ upstream ประกาศ · ระดับมาจาก Cloud (`/me`) ไม่ใช่เครื่องผู้ใช้กำหนด · `counts` เป็นค่า fallback
  - โค้ดบอกว่า routing "stays on" แล้ว "รอ" การ sign-in (เริ่มทำงานหลัง `caveman login`) — **ไฟล์ที่อ่านแล้วยังไม่พอยืนยันว่า `caveman setup` เปิด routing และตั้งระดับ telemetry เป็นค่าใดโดยเริ่มต้น** → ใช้ `caveman setup --dry-run` ดูก่อนเสมอ
  - นัยต่อ environment ที่มี prompt/โค้ดลับ: อย่าเปิด routing บน Free plan โดยไม่ตั้งใจ และตรวจ `telemetry` เป็น off ก่อนใช้งานกับ repo ที่ไม่ควรส่งข้อมูลออก
