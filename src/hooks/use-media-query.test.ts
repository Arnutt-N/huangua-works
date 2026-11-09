import { describe, expect, it } from 'vitest';
import { ADMIN_SIDEBAR_QUERY } from '@/hooks/use-media-query';

describe('ADMIN_SIDEBAR_QUERY', () => {
  it('ตรงกับ breakpoint md ของ Tailwind (768px) ที่ AdminLayout ใช้ซ่อนปุ่มเปิดเมนู', () => {
    expect(ADMIN_SIDEBAR_QUERY).toBe('(min-width: 768px)');
  });
});
