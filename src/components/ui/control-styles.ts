// § cn() joins class strings and does not drop a later px/pr.
// One element gets one padding utility. A second one wins by stylesheet order.

export const controlFocus =
  'transition-colors duration-normal ease-out-expo ' +
  'focus:outline-none focus-visible:ring focus-visible:ring-accent-strong/35 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none';

export const fieldPad = 'px-4';

export const fieldIconClass =
  'pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted';

export const fieldPadIcon = 'pl-11 pr-4';

export const fieldPadIconReveal = 'pl-11 pr-14';

/**
 * ช่องที่มี glyph ฝั่งขวาของเบราว์เซอร์ (เวลา/วันที่)
 * pr-11 ดันข้อความออกจากไอคอน ไม่ให้ทับกัน
 */
export const fieldPadEndGlyph = 'pl-4 pr-11';

export const selectTriggerClass =
  'inline-flex min-h-touch w-full cursor-pointer items-center justify-between gap-2 overflow-hidden rounded-md border border-border bg-surface-raised pl-4 pr-5 text-base leading-snug text-ink whitespace-nowrap ' +
  'focus:border-accent-strong ' +
  controlFocus +
  ' data-[placeholder]:text-muted';

export const controlChevronIcon = 'h-4 w-4 shrink-0 text-muted';

export const fieldChrome =
  'min-h-touch w-full rounded-md border bg-surface-raised text-base leading-snug text-ink placeholder:text-muted ' +
  controlFocus;

