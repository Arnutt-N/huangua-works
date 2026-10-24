import { describe, expect, it } from 'vitest';
import { messagesToCsv } from './export';
import type { Message } from './types';

function msg(over: Partial<Message> = {}): Message {
  return {
    id: 'm1',
    sender: 'user',
    messageType: 'text',
    textContent: 'สวัสดี',
    createdAt: '2026-10-24T06:00:00.000Z',
    ...over,
  };
}

describe('messagesToCsv', () => {
  it('มี BOM + header ไทย', () => {
    const csv = messagesToCsv([]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('เวลา,ผู้ส่ง,ประเภท,ข้อความ');
  });

  it('แปลง sender เป็นป้ายไทย และค่าว่างของ text', () => {
    const csv = messagesToCsv([msg(), msg({ id: 'm2', sender: 'admin', textContent: null, messageType: 'image' })]);
    expect(csv).toContain('ผู้ใช้');
    expect(csv).toContain('เจ้าหน้าที่');
    expect(csv).toContain('[image]');
  });

  it('escape comma/quote/newline ตาม RFC 4180', () => {
    const csv = messagesToCsv([msg({ textContent: 'a,b "c"\nd' })]);
    expect(csv).toContain('"a,b ""c""\nd"');
  });
});
