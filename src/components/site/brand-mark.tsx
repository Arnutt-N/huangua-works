import { cn } from '@/lib/cn';

/**
 * BrandMark — ตราสัญลักษณ์ "อบต" แบบ gradient tile
 *
 * เดิม landing Navbar สร้าง tile นี้แบบ inline style ในไฟล์ตัวเอง ส่วนแอดมินใช้ไอคอน
 * LayoutDashboard คนละตัว → สองฝั่งดูเป็นคนละผลิตภัณฑ์ แยกออกมาเป็น component เดียว
 * เพื่อให้ทุกหน้า (landing / admin / login) ใช้ตราเดียวกันจริง ๆ
 *
 * ใช้ gradient emerald เดียวกับปุ่ม primary ของ Hero (DESIGN.md §accent)
 */
export function BrandMark({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'bg-accent-gradient-br flex flex-none items-center justify-center rounded-lg font-bold tracking-tight text-on-accent',
        size === 'sm' ? 'h-9 w-9 text-xs' : 'h-10 w-10 text-sm',
        className,
      )}
      style={{ boxShadow: '0 6px 16px -8px var(--color-accent-strong)' }}
    >
      อบต
    </span>
  );
}
