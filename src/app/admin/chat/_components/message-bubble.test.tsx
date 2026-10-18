// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageBubble } from './message-bubble';
import type { Message } from '../_lib/types';

afterEach(cleanup);

function renderMessage(message: Message) {
  return render(
    <MessageBubble message={message} customerName="ผู้ใช้" customerPicture={null} onRetry={vi.fn()} />,
  );
}

const base = { id: '1', sender: 'user', textContent: null, createdAt: '2026-10-17T00:00:00.000Z' };

describe('MessageBubble สื่อจาก LINE', () => {
  it('รูปที่มี mediaUrl แสดงเป็นรูปพร้อมลิงก์ต้นฉบับ', () => {
    renderMessage({ ...base, messageType: 'image', mediaUrl: 'https://files.example/a.jpg' });
    const img = screen.getByAltText('รูปที่ผู้ใช้ส่ง');
    expect(img).toHaveAttribute('src', 'https://files.example/a.jpg');
    expect(screen.getByRole('link', { name: 'เปิดรูปต้นฉบับที่ผู้ใช้ส่ง' })).toBeInTheDocument();
  });

  it('ไฟล์แนบแสดงเป็นลิงก์เปิดดู', () => {
    renderMessage({ ...base, messageType: 'file', mediaUrl: 'https://files.example/a.pdf' });
    expect(screen.getByRole('link', { name: /ไฟล์แนบ/ })).toHaveAttribute('href', 'https://files.example/a.pdf');
  });

  it('รูปที่ไม่มี mediaUrl ถอยกลับเป็น placeholder เหมือนเดิม', () => {
    renderMessage({ ...base, messageType: 'image', mediaUrl: null });
    expect(screen.getByText('[image]')).toBeInTheDocument();
  });

  it('ข้อความธรรมดาแสดงเหมือนเดิม', () => {
    renderMessage({ ...base, messageType: 'text', textContent: 'สวัสดี' });
    expect(screen.getByText('สวัสดี')).toBeInTheDocument();
  });
});
