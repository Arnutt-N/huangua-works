import { describe, expect, it } from 'vitest';
import manifest from './manifest';

describe('manifest metadata route', () => {
  it('ส่งออกข้อมูล manifest ตามข้อกำหนด PWA', () => {
    const data = manifest();
    expect(data.name).toContain('อบต.หัวงัว');
    expect(data.short_name).toBe('อบต.หัวงัว');
    expect(data.display).toBe('standalone');
    expect(data.start_url).toBe('/');
    expect(data.background_color).toBe('#fafcff');
    expect(data.theme_color).toBe('#1e40af');
    expect(data.icons?.length).toBeGreaterThan(0);
    expect(data.shortcuts?.length).toBe(4);

    const queueShortcut = data.shortcuts?.find((s) => s.url === '/admin/queue');
    expect(queueShortcut).toBeDefined();
    expect(queueShortcut?.name).toContain('งานช่าง');
  });
});
