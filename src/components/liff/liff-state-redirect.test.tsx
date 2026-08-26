// @vitest-environment jsdom
import { cleanup, render, waitFor } from '@testing-library/react';
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

// § vi.mock factory ถูก hoist เหนือ import — ตัวแปรที่ factory อ้างถึงต้องมาจาก
// vi.hoisted เท่านั้น ไม่งั้น TDZ ReferenceError
const h = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    liffId: null as string | null,
    loadLiffSdk: vi.fn(() => Promise.resolve()),
    init: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('./liff-sdk', () => ({ loadLiffSdk: h.loadLiffSdk }));
vi.mock('@/lib/liff/config', () => ({ getLiffId: () => h.liffId }));

function mountWithLiff(liffId: string | null) {
  h.liffId = liffId;
  (window as unknown as { liff?: unknown }).liff = { init: h.init };
  return render(<LiffStateRedirect />);
}

beforeEach(() => {
  h.calls.length = 0;
  h.liffId = null;
  h.loadLiffSdk.mockClear();
  h.loadLiffSdk.mockImplementation(() => Promise.resolve());
  h.init.mockClear();
  h.init.mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  delete (window as unknown as { liff?: unknown }).liff;
});

test('ไม่มี liff.state → อยู่หน้าแรกตามปกติ ไม่ redirect ไม่โหลด SDK', () => {
  mountWithLiff('2000000001-abcdefgh');

  expect(replaceMock).not.toHaveBeenCalled();
  expect(h.loadLiffSdk).not.toHaveBeenCalled();
});

test('มี liff.state แต่ยังไม่ตั้ง LIFF ID → replace ทันทีแบบไม่แตะ SDK (พฤติกรรมเดิม)', () => {
  currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent('/track?id=HN123');
  mountWithLiff(null);

  expect(replaceMock).toHaveBeenCalledWith('/track?id=HN123');
  expect(h.loadLiffSdk).not.toHaveBeenCalled();
});

test('§ หัวใจของบั๊กลูป: มี LIFF ID → ต้อง init เสร็จก่อนจึง replace (ลำดับ init → replace)', async () => {
  currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent('/intake');
  h.loadLiffSdk.mockImplementation(() => {
    h.calls.push('load');
    return Promise.resolve();
  });
  h.init.mockImplementation(() => {
    h.calls.push('init');
    return Promise.resolve();
  });
  replaceMock.mockImplementation(() => h.calls.push('replace'));
  mountWithLiff('2000000001-abcdefgh');

  await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/intake'));

  expect(h.loadLiffSdk).toHaveBeenCalledTimes(1);
  expect(h.init).toHaveBeenCalledWith({ liffId: '2000000001-abcdefgh' });
  expect(h.calls).toEqual(['load', 'init', 'replace']);
});

test('init พัง → ยังเดินทางต่อให้หน้าปลายทาง fallback เว็บธรรมดา (ไม่ติดค้าง/ไม่ลูป)', async () => {
  currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent('/track');
  h.init.mockImplementation(() => Promise.reject(new Error('init failed')));
  mountWithLiff('2000000001-abcdefgh');

  await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/track'));
});

test('SDK โหลดไม่ได้ → ยังเดินทางต่อ', async () => {
  currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent('/intake');
  h.loadLiffSdk.mockImplementation(() => Promise.reject(new Error('cdn unreachable')));
  mountWithLiff('2000000001-abcdefgh');

  await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/intake'));
  expect(h.init).not.toHaveBeenCalled();
});

test('unmount ก่อน init เสร็จ → ไม่ replace (กัน replace ซ้อนจาก effect ที่ตายแล้ว)', async () => {
  currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent('/track');
  let resolveInit: () => void = () => {};
  h.init.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resolveInit = resolve;
      }),
  );
  const { unmount } = mountWithLiff('2000000001-abcdefgh');

  unmount();
  resolveInit();

  await Promise.resolve();
  expect(replaceMock).not.toHaveBeenCalled();
});

test('liff.state อันตราย (//, สัมบูรณ์, backslash) → ไม่ redirect ออกนอก origin และไม่โหลด SDK', () => {
  for (const evil of [
    '//evil.com/track',
    'https://evil.com/track',
    '/\\evil.com/track',
    'javascript:alert(1)',
  ]) {
    currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent(evil);
    mountWithLiff('2000000001-abcdefgh');
  }

  expect(replaceMock).not.toHaveBeenCalled();
  expect(h.loadLiffSdk).not.toHaveBeenCalled();
});

test('liff.state รูปแบบขอบ: / เดี่ยว → origin เดิมได้, ค่าว่าง/%2F%2F/space นำหน้า → ไม่ redirect', async () => {
  currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent('/');
  mountWithLiff('2000000001-abcdefgh');
  await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'));

  replaceMock.mockClear();
  for (const edge of ['', '%2F%2Fevil.com', encodeURIComponent(' /track')]) {
    currentUrl = 'http://localhost/?liff.state=' + edge;
    mountWithLiff('2000000001-abcdefgh');
  }
  // เคส valid ที่ยังรอ init อยู่ให้เวลาแสดงตัวก่อน ส่วนเคส invalid ต้องเงียบถาวร
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(replaceMock).not.toHaveBeenCalled();
});
