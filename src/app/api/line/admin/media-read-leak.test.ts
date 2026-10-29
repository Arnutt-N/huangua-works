import { describe, expect, it, vi } from 'vitest';

/**
 * § เกณฑ์ A3 ของ docs/prd-media-read-access.md — ไม่มี URL ของ storage ที่ไม่เซ็น
 * หลุดไปถึง client ผ่าน GET endpoint ที่มีอยู่
 *
 * เทสต์นี้ไม่ได้ตรวจ SQL ที่ route สร้าง (brittle) แต่ตรวจว่าไฟล์ route ไม่อ้างถึง
 * คอลัมน์ที่ห้ามส่งออกใน select ของ GET — ถ้ามีคนเปลี่ยนกลับไป `.select()` เปล่า
 * หรือเพิ่ม storageKey/url เข้าไป เทสต์จะแดง
 */

const mediaRouteSource = await import('fs').then((fs) =>
  fs.readFileSync('src/app/api/line/admin/media/route.ts', 'utf8'),
);
const conversationRouteSource = await import('fs').then((fs) =>
  fs.readFileSync('src/app/api/line/admin/conversations/[id]/route.ts', 'utf8'),
);

function getFunctionBody(source: string, fnName: string): string {
  const start = source.indexOf(`export async function ${fnName}(`);
  expect(start, `${fnName} not found`).toBeGreaterThan(-1);
  const nextExport = source.indexOf('export async function', start + 10);
  return source.slice(start, nextExport === -1 ? undefined : nextExport);
}

describe('GET endpoints ไม่ส่งที่อยู่ไฟล์ให้ client', () => {
  it('GET /api/line/admin/media ไม่ select url หรือ storageKey', () => {
    const body = getFunctionBody(mediaRouteSource, 'GET');
    expect(body).not.toMatch(/select\(\)\s*\.from\(mediaFiles\)/);
    expect(body).not.toContain('mediaFiles.url');
    expect(body).not.toContain('mediaFiles.storageKey');
  });

  it('GET conversations/[id] ไม่ select mediaUrl หรือ storageKey', () => {
    const body = getFunctionBody(conversationRouteSource, 'GET');
    expect(body).not.toMatch(/select\(\)\s*\n?\s*\.from\(chatMessages\)/);
    expect(body).not.toContain('mediaUrl: chatMessages.mediaUrl');
    expect(body).not.toContain('storageKey: chatMessages.storageKey');
  });

  it('GET conversations/[id] ยังบอก client ว่ามีไฟล์ (hasMedia)', () => {
    const body = getFunctionBody(conversationRouteSource, 'GET');
    expect(body).toContain('hasMedia');
  });
});

// vi ถูก import ไว้ให้รูปแบบเดียวกับเทสต์อื่นในโปรเจกต์
void vi;
