import { describe, expect, it } from 'vitest';
import {
  MEDIA_ACCEPT_ATTR,
  MEDIA_ALLOWED_MIME,
  MEDIA_MAX_SIZE_BYTES,
  MEDIA_SIZE_ERROR,
  MEDIA_TYPE_ERROR,
  validateMediaFile,
} from './media-upload-rules';

describe('media-upload-rules (FORM-04)', () => {
  it('accept ตรงกับ MIME allow-list ของเซิร์ฟเวอร์ ไม่มี PDF/GIF/SVG', () => {
    expect(MEDIA_ACCEPT_ATTR.split(',').sort()).toEqual(Object.keys(MEDIA_ALLOWED_MIME).sort());
    expect(MEDIA_ACCEPT_ATTR).not.toMatch(/pdf|gif|svg/);
  });

  it.each(['image/png', 'image/jpeg', 'image/webp'])('ผ่าน %s ที่ขนาดพอดีเพดาน', (type) => {
    expect(validateMediaFile({ type, size: MEDIA_MAX_SIZE_BYTES })).toBeNull();
  });

  it.each(['application/pdf', 'image/gif', 'image/svg+xml', 'text/html', ''])('ปฏิเสธ %s', (type) => {
    expect(validateMediaFile({ type, size: 10 })).toBe(MEDIA_TYPE_ERROR);
  });

  it('ปฏิเสธไฟล์เกินเพดาน 1 ไบต์', () => {
    expect(validateMediaFile({ type: 'image/png', size: MEDIA_MAX_SIZE_BYTES + 1 })).toBe(MEDIA_SIZE_ERROR);
  });

  it('ตรวจชนิดก่อนขนาด', () => {
    expect(validateMediaFile({ type: 'application/pdf', size: MEDIA_MAX_SIZE_BYTES + 1 })).toBe(MEDIA_TYPE_ERROR);
  });
});
