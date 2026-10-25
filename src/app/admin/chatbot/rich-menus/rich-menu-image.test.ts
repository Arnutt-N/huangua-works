import { describe, expect, it } from 'vitest';
import { RICH_MENU_IMAGE_LIMIT_BYTES } from '@/lib/contracts';
import { planRichMenuFit, scaledToFit } from './rich-menu-image';

describe('planRichMenuFit', () => {
  it('รูปไม่เกิน 1 MB ผ่านไปเฉย ๆ', () => {
    const plan = planRichMenuFit(RICH_MENU_IMAGE_LIMIT_BYTES);
    expect(plan.fits).toBe(true);
    expect(plan.attempts).toHaveLength(0);
  });

  it('รูปเกิน 1 MB ได้ลำดับการย่อ ลด quality ก่อนลดขนาด', () => {
    const plan = planRichMenuFit(RICH_MENU_IMAGE_LIMIT_BYTES + 1);
    expect(plan.fits).toBe(false);
    expect(plan.attempts).toHaveLength(16);
    expect(plan.attempts[0]).toEqual({ scale: 1, quality: 0.9 });
    expect(plan.attempts[4]).toEqual({ scale: 0.75, quality: 0.9 });
  });
});

describe('scaledToFit', () => {
  it('คงสัดส่วนและไม่ขยายเกินต้นฉบับ', () => {
    expect(scaledToFit(5000, 3372, 2500, 1686)).toEqual({ width: 2500, height: 1686 });
    expect(scaledToFit(100, 100, 2500, 1686)).toEqual({ width: 100, height: 100 });
  });
});
