// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/admin/_lib/admin-api', () => ({
  adminApi: { listReplyObjects: vi.fn(), listIntents: vi.fn() },
}));

import { adminApi } from '@/app/admin/_lib/admin-api';
import type { IntentItem, ReplyObject } from '@/app/admin/_lib/admin-api';
import { ChatbotDashboardClient } from './chatbot-dashboard-client';

function intent(over: Partial<IntentItem> = {}): IntentItem {
  return {
    id: 'i1',
    name: 'เวลาทำการ',
    description: null,
    isActive: true,
    keywords: [{ id: 'k1', keyword: 'กี่โมง', matchType: 'contains' as const }],
    responses: [
      { id: 'r1', replyType: 'text' as const, textContent: 'เปิด 08:30', replyObjectId: null, displayOrder: 0 },
    ],
    ...over,
  };
}

function replyObject(over: Partial<ReplyObject> = {}): ReplyObject {
  return {
    id: 'o1',
    objectId: 'flex_welcome',
    name: 'Welcome Message',
    category: null,
    objectType: 'flex',
    payload: {},
    altText: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
    ...over,
  };
}

const mockReplyObjects = vi.mocked(adminApi.listReplyObjects);
const mockIntents = vi.mocked(adminApi.listIntents);

afterEach(() => {
  cleanup();
  mockReplyObjects.mockReset();
  mockIntents.mockReset();
});

beforeEach(() => {
  mockReplyObjects.mockResolvedValue({ ok: true, data: { items: [replyObject()] } });
  mockIntents.mockResolvedValue({ ok: true, data: { items: [intent()] } });
});

describe('ChatbotDashboardClient overview', () => {
  it('แสดง 3 KPI: Reply Objects / Intent Categories / Active Responses', async () => {
    mockReplyObjects.mockResolvedValue({
      ok: true,
      data: { items: [replyObject(), replyObject({ id: 'o2', objectId: 'flex_bye' })] },
    });
    mockIntents.mockResolvedValue({
      ok: true,
      data: {
        items: [
          intent(),
          intent({ id: 'i2', responses: [] }),
          intent({ id: 'i3', isActive: false }),
        ],
      },
    });
    render(<ChatbotDashboardClient />);

    expect(await screen.findByText('Reply Objects')).toBeInTheDocument();
    expect(screen.getByText('Intent Categories')).toBeInTheDocument();
    expect(screen.getByText('Active Responses')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('2 หมวดที่เปิดใช้')).toBeInTheDocument();
    expect(screen.getByText('คำตอบในหมวดที่เปิดใช้')).toBeInTheDocument();
  });

  it('Recent Templates แสดงสูงสุด 5 รายการพร้อม objectId', async () => {
    mockReplyObjects.mockResolvedValue({
      ok: true,
      data: {
        items: Array.from({ length: 7 }, (_, i) =>
          replyObject({ id: `o${i}`, objectId: `flex_${i}`, name: `Template ${i}` }),
        ),
      },
    });
    render(<ChatbotDashboardClient />);

    expect(await screen.findByText('Template 0')).toBeInTheDocument();
    expect(screen.getByText('Template 4')).toBeInTheDocument();
    expect(screen.queryByText('Template 5')).not.toBeInTheDocument();
    expect(screen.getByText('$flex_0')).toBeInTheDocument();
  });

  it('Active Intents แสดงจำนวน keyword/response และเหตุผลไม่พร้อม', async () => {
    mockIntents.mockResolvedValue({
      ok: true,
      data: { items: [intent(), intent({ id: 'i2', name: 'ที่อยู่', keywords: [] })] },
    });
    render(<ChatbotDashboardClient />);

    expect(await screen.findByText('1 keywords · 1 responses')).toBeInTheDocument();
    expect(screen.getByLabelText('ยังไม่มี keyword')).toBeInTheDocument();
  });

  it('ไม่มีข้อมูลแสดงลิงก์สร้างทั้งสองฝั่ง', async () => {
    mockReplyObjects.mockResolvedValue({ ok: true, data: { items: [] } });
    mockIntents.mockResolvedValue({ ok: true, data: { items: [] } });
    render(<ChatbotDashboardClient />);

    expect(await screen.findByText('สร้างเทมเพลตแรก')).toBeInTheDocument();
    expect(screen.getByText('ไปสร้างหมวด')).toBeInTheDocument();
  });
});

describe('ChatbotDashboardClient error', () => {
  it('intents ล้มแสดง error ไม่ใช่ empty state', async () => {
    mockIntents.mockResolvedValue({ ok: false, error: 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่', status: 500 });
    render(<ChatbotDashboardClient />);

    expect(await screen.findByText('เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่')).toBeInTheDocument();
    expect(screen.queryByText('ไปสร้างหมวด')).not.toBeInTheDocument();
    expect(screen.getByText('Welcome Message')).toBeInTheDocument();
  });

  it('reply objects 403 แสดง error แยกจาก intents', async () => {
    mockReplyObjects.mockResolvedValue({ ok: false, error: 'สิทธิ์ไม่เพียงพอ', status: 403 });
    render(<ChatbotDashboardClient />);

    expect(await screen.findByText('สิทธิ์ไม่เพียงพอ')).toBeInTheDocument();
    expect(screen.queryByText('สร้างเทมเพลตแรก')).not.toBeInTheDocument();
    expect(screen.getByText('เวลาทำการ')).toBeInTheDocument();
  });
});
