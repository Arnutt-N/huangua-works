# บันทึกจุดที่หน้าตาเปลี่ยนโดยตั้งใจ — Color System Hardening

> เกณฑ์ A8 ใน `docs/prd-color-system.md` — จุดที่หน้าตาเปลี่ยนต้องมีบรรทัดในเอกสารนี้
> จุดที่เปลี่ยนโดยไม่มีบรรทัดรองรับ = regression ต้อง revert
>
> เอกสารนี้มีไว้เพราะการย้ายค่าดิบไปใช้ token ทำให้หน้าตาเปลี่ยนในบางจุด **โดยที่นั่น
> คือสิ่งที่ถูกต้อง** — ถ้าไม่แยกไว้ คนรีวิวจะเจอ diff ที่หน้าตาเปลี่ยนแล้วไม่รู้ว่า
> ควรดีใจหรือควร revert

---

## ธีม light — เปลี่ยนโดยตั้งใจ

| จุด | เดิม | ใหม่ | ทำไม |
|---|---|---|---|
| ปุ่ม "กลับหน้าหลัก" (`intake-form.tsx`) | `oklch(80% 0.015 255)` — 1.81:1 | `border-border-strong` — 3.26:1 | **ผิด WCAG 1.4.11** ค่าเดิมคือค่าก่อนการแก้ contrast ที่ `tokens.css:31-36` บันทึกไว้ ซึ่ง #55 หมุน hue ตามไปโดยไม่รู้ว่ามันถูกทิ้งแล้ว |
| dashed border พื้นที่อัปโหลด (`intake-form.tsx`) | ค่าเดียวกัน | `border-border-strong` | inactive component จึงไม่ผิดกฎ แต่แก้ให้สม่ำเสมอกับปุ่มข้างบน |
| ไอคอน "ถนน" (`Services.tsx`) | `oklch(60% 0.22 25)` — 3.61:1 | `text-danger-ink` — 6.58:1 | ตกเกณฑ์ข้อความ 4.5:1 · กฎใน `tokens.css` §status ink ระบุว่าบนพื้น `*-soft` ต้องใช้ `*-ink` |
| ขอบ 3 จุด (`intake-form.tsx` ×2, `Hero.tsx` ×1) | `oklch(90% 0.01 255)` — 1.31:1 | `border-border` — 1.54:1 | ค่าเดิมคือค่าก่อนแก้ contrast (L90→85) ไม่ผิดกฎเพราะเป็น hairline ตกแต่ง แต่จางกว่าที่ระบบตั้งใจ |
| ตัวเลข "อัปเดต" (`Hero.tsx`) | `oklch(50% 0.02 255)` | `text-muted` (47%) | ค่าเดิมคือค่าก่อนแก้ contrast ที่ `tokens.css:28` บันทึกไว้ (5.8 → 6.6:1) |
| ปุ่มในอีเมลรีเซ็ตรหัสผ่าน (`mail.ts`) | `#0d9488` (teal) | `#0049a1` | สี palette ก่อน #55 — ผู้ใช้ได้รับอีเมลที่สีไม่ตรงกับเว็บมาตลอด |
| พื้นหลัง Storybook (`preview.tsx`) | hue **245** | `var(--color-surface)` | hue เพี้ยนตกค้างจาก palette ก่อนหน้า ทำให้ทุก story ตรวจ component บนพื้นผิดสี |
| skeleton (`page.tsx`) | `oklch(96% 0.01 255 / 0.5)` | `bg-surface-sunken/50` | chroma เพี้ยน 0.01 vs 0.02 — น่าจะพิมพ์พลาดตั้งแต่ต้น |
| ขอบ badge (`Hero.tsx`) | `oklch(90% 0.05 255)` | `border-accent-200` (0.049) | ต่างกัน 0.001 ซึ่งเกินเพดาน sRGB อยู่แล้ว browser render เท่ากัน |

## ธีม dark — เปลี่ยนทุกจุดโดยตั้งใจ

**ค่าดิบไม่ตอบสนองธีม ส่วน token ตอบสนอง** ดังนั้นการย้ายทุกจุดคือการเปลี่ยนหน้าตา dark mode โดยเนื้อแท้ — และเป็นการแก้บั๊ก ไม่ใช่ regression

ตัวอย่างที่ชัดที่สุด: `Services.tsx` ตั้งพื้นทั้ง section เป็น `oklch(96% 0.02 255)` (สว่าง 96%) แปลว่า**ก่อนหน้านี้ใน dark mode section "บริการของเรา" เป็นแถบสว่างกลางหน้าจอมืด** หลังย้ายเป็น `bg-surface-sunken` มันจะเข้มถูกต้องตามธีม

ด้วยเหตุนี้ baseline screenshot จึงเทียบเฉพาะ light theme — dark ตรวจด้วย axe `color-contrast` แทน

## จุดที่เลือก token ต่างจากที่ดูเผิน ๆ

| จุด | ใช้ | ไม่ใช้ | เพราะ |
|---|---|---|---|
| รางของ progress bar (`Hero.tsx`) | `bg-accent-sunken` | `bg-surface-sunken` | สอง token นี้**ค่าเท่ากันเป๊ะในธีม light** แต่ต่างกันใน dark (27% 0.03 vs 27% 0.02) เลือกผิดจะดูปกติทุกอย่างจนกว่าจะเปิด dark mode |
| พื้นไอคอนสีทอง 5 จุด | `bg-warning-soft` | `bg-accent-gold-soft` | ค่าเท่ากันทั้งสองธีม แต่ทุกจุดจับคู่กับ `text-warning-ink` การใช้ gold-soft จะหลุดจากคู่ `warning-ink / warning-soft` ที่ `check-contrast.ts` เฝ้าอยู่ |
| เงาการ์ดใหญ่ (`Hero.tsx`) | `shadow-accent-drop` (utility ใหม่) | `shadow-accent-glow` | ค่าต่างกันจริง (25/50/-12/0.1 vs 10/40/-10/0.3) การกลืนเข้าอันเดิมจะเปลี่ยนเงา |

## จุดที่คงค่าดิบไว้โดยตั้งใจ

| จุด | ค่า | เพราะ |
|---|---|---|
| ป้ายสถานะบน header การ์ด (`Hero.tsx:249`) | `oklch(100% 0 0 / 0.2)` | `--color-surface-raised` ไม่ใช่สีขาวในธีมมืด (`oklch(20% 0.02 255)`) การแทนจะทำให้ป้ายกลืนหายบนพื้น gradient · `tokens.css` ใช้ pattern เดียวกันใน `.glass` |
| ประกายวิ่งบนแถบ progress (`Hero.tsx:304`) | `oklch(100% 0 0 / 0.3)` | เหตุผลเดียวกัน |
| `scripts/seed.ts` 5 จุด | hue 245/120/30/280/180 | เป็น **data** เขียนลงคอลัมน์ `departments.color` การย้ายต้อง migrate ข้อมูล production ด้วย |
| `public/icon.svg` | `oklch(51%/42% 0.16 255)` | SVG static อ้าง CSS var ไม่ได้ |
| `layout.tsx` themeColor | `#fafcff` / `#070b11` | `meta[name=theme-color]` ยังไม่รองรับ oklch ในหลาย browser |

สามรายการท้ายอยู่ใน allowlist ของ ESLint rule พร้อมเหตุผลกำกับใน `eslint.config.mjs`
