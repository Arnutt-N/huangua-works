// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.setConfig({ testTimeout: 30_000 });

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: {
    listMedia: vi.fn().mockResolvedValue({
      ok: true,
      data: { items: [{ id: 'f1', filename: 'a.png', mimeType: 'image/png', sizeBytes: 100, category: 'img', url: 'http://x/a.png' }] },
    }),
  },
}));

import { FilesClient } from './files-client';

afterEach(() => cleanup());

describe('A11Y-02 ปุ่มไฟล์', () => {
  it('wrapper div มี focus-within:opacity-100 + pointer-coarse:opacity-100', async () => {
    const { container } = render(<FilesClient />);
    await screen.findByText('a.png');
    const wrapper = container.querySelector('div.opacity-0');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.className).toMatch('focus-within:opacity-100');
    expect(wrapper?.className).toMatch('pointer-coarse:opacity-100');
  });
});
