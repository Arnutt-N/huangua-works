import { describe, expect, it } from 'vitest';
import { RICH_MENU_IMAGE_LIMIT_BYTES } from '@/lib/contracts';
import { scaledToFit } from './rich-menu-image';

describe('scaledToFit', () => {
  it('คงสัดส่วนและไม่ขยายเกินต้นฉบับ', () => {
    expect(scaledToFit(5000, 3372, 2500, 1686)).toEqual({ width: 2500, height: 1686 });
    expect(scaledToFit(100, 100, 2500, 1686)).toEqual({ width: 100, height: 100 });
  });
});
