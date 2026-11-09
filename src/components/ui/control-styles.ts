/**
 * มาตรวัดตัวควบคุมที่ใช้ร่วมกันทั้งเว็บ (ปุ่ม ช่องกรอก ตัวเลือก)
 *
 * § cn() ไม่ได้ merge class ที่ชน property เดียวกัน — ห้ามใส่ px-4 แล้วตามด้วย pr-11
 * ในองค์ประกอบเดียว เพราะตัวที่ชนะขึ้นกับลำดับใน stylesheet ไม่ใช่ลำดับใน className
 * ระยะขวาของเชฟรอนจึงเป็นคลาสเดียว (pr-5) ไม่ใช่การทับ px
 */

/** สูงอย่างน้อย 44px — touch target C6 */
export const controlHeight = 'min-h-touch';

/** มุมของปุ่มและช่องกรอก (DESIGN.md: rounded-md = 12px) */
export const controlRadius = 'rounded-md';

/** ตัวอักษรในตัวควบคุม: ไม่ใช้ line-height 1.6 ของ body เพราะในกล่อง 44px จะดูอึดอัด */
export const controlText = 'text-base leading-snug';

export const controlFocus =
  'transition-colors duration-normal ease-out-expo ' +
  'focus:outline-none focus-visible:ring focus-visible:ring-accent-strong/35 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';

/** ช่องข้อความธรรมดา — padding ซ้ายขวาเท่ากัน */
export const fieldPad = 'px-4';

/** ช่องที่มีไอคอนซ้าย (ไอคอนอยู่ที่ left-3.5) */
export const fieldPadIcon = 'pl-11 pr-4';

/**
 * ช่องที่มี glyph ฝั่งขวาของเบราว์เซอร์ (เวลา/วันที่)
 * pr-11 ดันข้อความออกจากไอคอน ไม่ให้ทับกัน
 */
export const fieldPadEndGlyph = 'pl-4 pr-11';

/**
 * ตัวเลือก — เชฟรอนอยู่ด้านใน padding
 * pr-5 (20px) คือช่องว่างจากขอบขวาถึงตัว v ไม่ให้ชิดกรอบ
 */
export const selectTriggerClass =
  'inline-flex min-h-touch w-full cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-md border border-border bg-surface-raised pl-4 pr-5 text-base leading-snug text-ink whitespace-nowrap ' +
  'focus:border-accent-strong ' +
  controlFocus +
  ' data-[placeholder]:text-muted';

/** ไอคอน v — shrink-0 กันข้อความยาวบีบไอคอนจนชิดขอบหรือทับตัวอักษร */
export const controlChevronIcon = 'h-4 w-4 shrink-0 text-muted';

export const fieldChrome =
  'min-h-touch w-full rounded-md border bg-surface-raised text-base leading-snug text-ink placeholder:text-muted ' +
  controlFocus;

/** คลาสช่องกรอกแบบเต็ม สำหรับจุดที่ยังเป็น <input> ตรง ๆ */
export const fieldControlClass = `${fieldChrome} border-border ${fieldPad}`;
