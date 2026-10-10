# ปีงบประมาณอัตโนมัติบนหน้าแรก

## PRD

ป้ายหน้าแรกระบุปี 2569 แบบตายตัว ทำให้ผู้ใช้เห็นปีเก่าหลังเปลี่ยนปีงบประมาณ ต้องแสดงปีงบประมาณปัจจุบันแบบ พ.ศ. ตามเวลาไทย

ขอบเขตครอบคลุมป้ายปีบนหน้าแรก ตัวคำนวณปีงบประมาณที่ใช้ร่วมกัน และการสำรวจข้อความปีในแอป ปีงบประมาณเริ่มวันที่ 1 ตุลาคมและสิ้นสุดวันที่ 30 กันยายน วันที่ประกาศนโยบาย ปีของกฎหมาย ข้อมูลประวัติ และตัวอย่างในเทสต์ยังเป็นวันที่ของเหตุการณ์นั้น

เกณฑ์รับงาน:

- ป้ายแสดง `ระบบออนไลน์ใหม่ ปีงบประมาณ 2570` ณ วันที่ 10 ตุลาคม 2026
- เวลาไทย 30 กันยายน 2026 เวลา 23:59:59 แสดง 2569 และ 1 ตุลาคมเวลา 00:00:00 แสดง 2570
- ผลคำนวณไม่ขึ้นกับ timezone ของเซิร์ฟเวอร์หรือผู้ใช้
- ป้ายหลัง hydration ใช้ปีปัจจุบัน แม้ HTML ใน ISR cache จะมีปีเก่า
- หน้าเปิดค้างข้ามปีงบประมาณปรับปีภายในหนึ่งนาที และปรับเมื่อกลับมาดูแท็บ
- คง `revalidate = 3600`, LIFF redirect, layout, และการทำงานของ Stats
- ทดสอบช่วงเปลี่ยนปีและตรวจป้ายด้วย browser จริง

ข้อจำกัดคือใช้ helper ใน `src/lib/thai-date.ts`, ไม่เพิ่ม dependency, ไม่แก้ข้อมูลในฐานข้อมูล และไม่แก้ WIP ในไฟล์ E2E ที่มีอยู่ก่อนเริ่มงาน ความสำเร็จวัดจากค่าปีและการเปลี่ยนปีตามเกณฑ์ ไม่ใช่เพียง build ผ่าน

## ผลสำรวจ

| จุด | ความหมาย | การจัดการ |
| --- | --- | --- |
| `src/components/landing/Hero.tsx:66` | ป้ายปีปัจจุบันบนหน้าแรก | เปลี่ยนเป็นปีงบประมาณแบบคำนวณ |
| `src/app/privacy/page.tsx:21` | วันที่ประกาศนโยบาย 23 สิงหาคม 2569 | คงวันที่ประกาศ |
| `src/app/terms/page.tsx:12` | วันที่ประกาศข้อกำหนด 23 สิงหาคม 2569 | คงวันที่ประกาศ |
| `src/lib/cases/intake.ts:89` | คำนวณปีงบประมาณ ค.ศ. สำหรับ metadata ของเคส | ใช้ helper เดิมที่ปรับ timezone |
| `src/lib/thai-date.test.ts` | วันตัวอย่างที่แน่นอน | คง assertions และเพิ่มช่วงเปลี่ยนปี |
| Comments และเอกสารเก่า | วันที่เหตุการณ์หรือประวัติการแก้ไข | คงข้อมูลประวัติ |

ค้นหาผ่าน `graft grep` แล้วตรวจไฟล์แอปที่ graph ไม่ครอบคลุมด้วย `rg` พบป้ายปีปัจจุบันหนึ่งจุด ไม่มีข้อความปีงบประมาณแบบตายตัวอื่นใน UI

## PRP-Plan

1. ตรวจ helper, callers, หน้าแรก, และ Next.js guide ใน `node_modules/next/dist/docs/` พร้อมเปรียบเทียบการส่งปีจาก server กับการคำนวณที่ client
2. เพิ่ม boundary tests ใน `src/lib/thai-date.test.ts` สำหรับ instant ก่อนและหลังเริ่มปีงบประมาณตามเวลาไทย ตรวจว่าเทสต์ล้มเหลวด้วยค่าเก่าก่อนแก้ helper
3. ปรับ `getFiscalYear(Date): number` ใน `src/lib/thai-date.ts` ให้ใช้ปีและเดือน Gregorian ใน `Asia/Bangkok` คง signature เดิม `getFiscalYearBE` ใช้ผลบวก 543 โดยไม่สร้าง Date ที่อิง timezone ของเครื่อง
4. แก้ป้ายใน `src/components/landing/Hero.tsx` และเพิ่มค่าเริ่มต้นจาก `src/app/page.tsx` ตามผลเลือกแบบ เพื่อรักษา SSR, ISR และ hydration พร้อมปรับปีหลังเปิดหน้าและเมื่อข้ามปีงบประมาณ
5. เพิ่ม `src/components/landing/Hero.test.tsx` สำหรับ snapshot เก่า, hydration, interval, visibilitychange และ subscription cleanup เพิ่ม `e2e/fiscal-year.spec.ts` เพื่อดูป้ายจริงใน browser ต่าง timezone และการเปิดค้างข้ามปี เก็บภาพใน `.verify-evidence/dynamic-fiscal-year/`
6. รัน focused tests, contrast test, typecheck, lint และตรวจ diff แยกจาก WIP เดิม ตรวจป้ายจริงบนหน้าแรกแล้วให้ reviewer อิสระตรวจ scoped diff

ลำดับที่บล็อกคือแบบและ review gate ก่อนโค้ด จากนั้น boundary test ก่อน helper แล้ว UI กับ tests โดยผู้แก้คนเดียวใน worktree แยก ผู้ออกแบบและ reviewer ตรวจแบบอ่านอย่างเดียวได้พร้อมกัน

ความเสี่ยงคือ timezone ของ UTC host, hydration ไม่ตรงกัน, ปีค้างใน ISR และ timer ค้างหลัง unmount ทดสอบ instant ที่จุดเปลี่ยนปี เทสต์ hydration และ cleanup พร้อมคง cache หน้าแรก

## Review gate

ตรวจ PRD กับคำขอแล้ว ขอบเขตตรงกับปีงบประมาณบนหน้าแรกและการสำรวจจุดอื่น ตรวจแผนกับโค้ดแล้วมี helper เดิมและ caller ของ Hero เพียงหน้าแรก Cross-judge อิสระให้ READY สำหรับ Candidate A หลังระบุ test paths และพฤติกรรมที่ต้องตรวจ ไม่ต้องถามผู้ใช้เพิ่มเพราะเกณฑ์ปีงบประมาณไทยระบุใน AGENTS.md แล้ว

## แบบที่เทียบ

### Candidate A

หน้า Home ส่ง `initialFiscalYearBE: number` ที่ได้จาก helper ให้ Hero ขณะสร้างหน้าแบบ ISR Hero ใช้ `useSyncExternalStore(subscribeFiscalYear, getCurrentFiscalYearBE, getServerSnapshot)` โดย server snapshot คืน prop เดิม จึงคง HTML และ hydration ให้ตรงกัน Client snapshot อ่านเวลาใหม่จาก helper เดิม ปรับผลหลัง hydration แล้วแจ้งเปลี่ยนทุกหนึ่งนาทีและเมื่อเกิด visibilitychange Subscription คืนฟังก์ชันล้าง timer กับ listener

แก้ helper เดิมให้ใช้ `Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: 'numeric' }).formatToParts(date)` และแปลงปีงบประมาณ ค.ศ. เป็น พ.ศ. ด้วยการบวก 543 Caller เดิมคือ case intake จึงใช้กติกาเดียวกันโดยไม่ต้องเปลี่ยน signature

ไฟล์หลักคือ page.tsx, Hero.tsx, thai-date.ts และเทสต์ ไม่เพิ่ม component ใหม่ Year ปรากฏใน HTML ตั้งแต่แรก แต่ HTML เก่าจาก ISR หรือ browser ที่ปิด JavaScript อาจรอ revalidation

### Candidate B

Hero ใช้ component ใหม่ `CurrentFiscalYearBadge` โดยไม่รับ prop ปี Server และ hydration แรกแสดงป้ายกลางที่ยังไม่มีปี หลัง mount จึงคำนวณวันที่ไทยจาก Intl แล้วสร้าง Date ตอนเที่ยงให้ helper เดิม ใช้ timeout รอเที่ยงคืนไทยถัดไปและปรับเมื่อเกิด visibilitychange พร้อมล้าง timer กับ listener

แบบนี้ไม่แก้ Home และ helper เดิม แต่เพิ่ม component ใหม่และต้องรู้รายละเอียด timezone ของ helper ที่ caller ด้วย Case intake จึงยังมีความคลาดเคลื่อน timezone เดิม ยอมรับ HTML ที่ไม่มีปีเพื่อให้ client เป็นผู้คำนวณทั้งหมด

## เกณฑ์เลือกแบบ

ตรวจความถูกต้องที่รอยต่อเวลาไทย ความตรงกันของ SSR และ hydration การแก้ปีค้างใน ISR การคง cache และจำนวนจุดที่ต้องรู้กติกา timezone แบบ A รวมกติกาไว้ที่ helper เดิมและมีปีตั้งแต่ HTML แรก จึงเป็นแบบที่เสนอ แบบ B มีการแปลง Date ซ้ำที่ caller และไม่ได้แก้ความคลาดเคลื่อนใน helper

## รูปแบบที่เสนอ

`Home` ใช้ `<Hero initialFiscalYearBE={getFiscalYearBE(new Date())} />` และ Hero รับปี พ.ศ. เป็น number ไม่มีการเปลี่ยนชื่อหรือ signature ของ helper เดิม `getFiscalYear` ยังคงคืน ค.ศ. และ `getFiscalYearBE` คืน พ.ศ.

ยอมรับว่า HTML ที่ไม่มี JavaScript อาจแสดงปีจาก ISR จนกว่าจะ revalidate สำเร็จ เพื่อคง cache ทั้งหน้า Client ปรับปีทันทีหลัง hydration และภายในหนึ่งนาทีเมื่อเปิดค้าง Cross-judge ให้เลือก A เพราะกติกา timezone อยู่ใน helper เดียวและ server HTML มีปีตั้งแต่แรก ไม่ใช้ B ที่ต้องแปลง Date ที่ caller อีกครั้ง

## ผล implementation และ verification

แก้ตาม Candidate A ทั้งหกไฟล์ในแผน ไม่มีการเพิ่ม dependency หรือเปลี่ยน signature ของ helper เดิม `revalidate = 3600` และ LIFF redirect คงเดิม ไม่มี deviation จากแบบที่ผ่าน review

- Boundary test บน UTC ก่อนแก้ได้ 2026 แทน 2027 และ 2569 แทน 2570 ที่ instant `2026-09-30T17:00:00Z` หลังแก้ helper ผ่าน 19/19
- Focused helper และ Hero tests ผ่าน 23/23 ครอบคลุม hydration จากปีเก่า, minute rollover, visibilitychange และ cleanup
- `npx vitest run` ใน workspace หลักผ่าน 711/711 จาก 76 files รวม integration และ contrast gate
- `npx playwright test e2e/fiscal-year.spec.ts --trace on` ผ่าน 7/7 ทั้ง UTC, Asia/Bangkok, America/Los_Angeles และการเปิดหน้าค้างข้ามปี
- `npx tsc --noEmit` ผ่าน และ lint เฉพาะหกไฟล์ผ่าน
- Browser จริงแสดง `ระบบออนไลน์ใหม่ ปีงบประมาณ 2570` เก็บภาพก่อนและหลังใน `.verify-evidence/dynamic-fiscal-year/`
- Reviewer อิสระตรวจ scoped diff ให้ READY ไม่มี blocking findings และ comment review ไม่มีรายการที่ต้องลบ

`npx eslint .` ยังพบ 14 errors และ 3 warnings ในหกไฟล์ admin ที่ไม่ได้แก้ในงานนี้ เป็นปัญหาเดิมที่พบตั้งแต่ก่อนเริ่มงานปีงบประมาณ Gate ของทั้ง repo จึงยังไม่ผ่าน และยังไม่ push, เปิด PR หรือ merge

CLI Playwright รุ่นติดตั้งไม่รองรับ `--screenshot` จึงใช้ `--trace on` และเก็บภาพผ่าน browser script จริงแทน ไม่มีการแก้ config การทดสอบของ repo
