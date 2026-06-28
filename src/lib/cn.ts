/**
 * cn — merge class names (เบา ไม่พึ่ง clsx/tailwind-merge)
 * กรอง false/null/undefined ออก แล้ว join ด้วย space
 */
export function cn(
  ...classes: ReadonlyArray<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(' ');
}