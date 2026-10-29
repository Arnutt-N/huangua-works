// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageBubble } from './message-bubble';
import type { Message } from '../_lib/types';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ url: 'https://signed.example/a.jpg?X-Amz-Signature=abc' }),
    })),
  );
});

function renderMessage(message: Message) {
  return render(
    <MessageBubble message={message} customerName="ผู้ใช้" customerPicture={null} onRetry={vi.fn()} />,
  );
}

const base = {
  id: 'm1',
  conversationId: 'c1',
  sender: 'user',
  textContent: null,
  createdAt: '2026-10-17T00:00:00.000Z',
};

describe('MessageBubble สื่อจาก LINE', () => {
  it('รูปที่มีไฟล์ขอ signed URL แล้วแสดงเป็นรูป', async () => {
    renderMessage({ ...base, messageType: 'image', hasMedia: true });

    const img = await screen.findByAltText('รูปที่ผู้ใช้ส่ง');
    expect(img).toHaveAttribute('src', 'https://signed.example/a.jpg?X-Amz-Signature=abc');
    expect(screen.getByRole('link', { name: 'เปิดรูปต้นฉบับที่ผู้ใช้ส่ง' })).toBeInTheDocument();
  });

  it('ขอ read-url จาก endpoint ที่ผูก conversationId + messageId ไม่ใช่ที่อยู่ตรง ๆ', async () => {
    renderMessage({ ...base, messageType: 'image', hasMedia: true });
    await screen.findByAltText('รูปที่ผู้ใช้ส่ง');

    expect(fetch).toHaveBeenCalledWith(
      '/api/line/admin/conversations/c1/messages/m1/read-url',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('ไฟล์แนบแสดงเป็นลิงก์เปิดดูที่ signed URL', async () => {
    renderMessage({ ...base, messageType: 'file', hasMedia: true });
    const link = await screen.findByRole('link', { name: /ไฟล์แนบ/ });
    expect(link).toHaveAttribute('href', 'https://signed.example/a.jpg?X-Amz-Signature=abc');
  });

  it('ไม่มีไฟล์ (hasMedia false) ไม่ยิง read-url และถอยเป็น placeholder', () => {
    renderMessage({ ...base, messageType: 'image', hasMedia: false });
    expect(screen.getByText('[image]')).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('read-url ล้มเหลวแสดงข้อความบอกให้ลองใหม่ ไม่ใช่หน้าว่าง', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    renderMessage({ ...base, messageType: 'image', hasMedia: true });

    await waitFor(() => {
      expect(screen.getByText(/เปิดไฟล์ไม่ได้/)).toBeInTheDocument();
    });
  });

  it('ระหว่างรอ signed URL แสดงสถานะกำลังโหลด', async () => {
    let resolve: (v: unknown) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise((r) => {
        resolve = r;
      })),
    );
    renderMessage({ ...base, messageType: 'image', hasMedia: true });

    expect(await screen.findByText('กำลังโหลดไฟล์...')).toBeInTheDocument();
    resolve({ ok: true, json: async () => ({ url: 'https://signed.example/x.jpg' }) });
    await screen.findByAltText('รูปที่ผู้ใช้ส่ง');
  });

  it('ข้อความธรรมดาแสดงเหมือนเดิม', () => {
    renderMessage({ ...base, messageType: 'text', textContent: 'สวัสดี' });
    expect(screen.getByText('สวัสดี')).toBeInTheDocument();
  });
});
