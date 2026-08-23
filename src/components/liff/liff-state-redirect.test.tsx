// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, expect, test, vi } from 'vitest';
import { LiffStateRedirect } from './liff-state-redirect';

/**
 * § jsdom ทำ window.location เป็น non-configurable ตาม spec — vi.spyOn(location, 'replace')
 * ใช้ไม่ได้ ต้อง redefine ทั้ง window.location เป็น object ปลอม (jsdom อนุญาตเฉพาะ
 * property ของ window เอง) แล้วคุม URL ผ่านตัวแปรเองเพราะไม่มี navigation จริง
 */
const replaceMock = vi.fn();
let currentUrl = 'http://localhost/';

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    get: () => ({
      get search() {
        return new URL(currentUrl).search;
      },
      replace: replaceMock,
    }),
  });
});

beforeEach(() => {
  replaceMock.mockClear();
  currentUrl = 'http://localhost/';
});

// § vitest.config ไม่ได้เปิด globals — auto-cleanup ของ RTL ไม่ทำงาน ต้องเรียกเอง
afterEach(cleanup);

test('ไม่มี liff.state → อยู่หน้าแรกตามปกติ ไม่ redirect', () => {
  render(<LiffStateRedirect />);

  expect(replaceMock).not.toHaveBeenCalled();
});

test('มี liff.state=/track?id=HN123 → replace ไปหน้านั้น', () => {
  currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent('/track?id=HN123');

  render(<LiffStateRedirect />);

  expect(replaceMock).toHaveBeenCalledWith('/track?id=HN123');
});

test('liff.state อันตราย (//, สัมบูรณ์, backslash) → ไม่ redirect ออกนอก origin', () => {
  for (const evil of [
    '//evil.com/track',
    'https://evil.com/track',
    '/\\evil.com/track',
    'javascript:alert(1)',
  ]) {
    currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent(evil);
    render(<LiffStateRedirect />);
  }

  expect(replaceMock).not.toHaveBeenCalled();
});

test('liff.state รูปแบบขอบ: / เดี่ยว → origin เดิมได้, ค่าว่าง/%2F%2F/space นำหน้า → ไม่ redirect', () => {
  currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent('/');
  render(<LiffStateRedirect />);
  expect(replaceMock).toHaveBeenCalledWith('/');

  replaceMock.mockClear();
  for (const edge of ['', '%2F%2Fevil.com', encodeURIComponent(' /track')]) {
    currentUrl = 'http://localhost/?liff.state=' + edge;
    render(<LiffStateRedirect />);
  }
  expect(replaceMock).not.toHaveBeenCalled();
});
