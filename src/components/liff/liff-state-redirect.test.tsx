// @vitest-environment jsdom
import { cleanup, render, waitFor, act } from '@testing-library/react';
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
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-liff-boot');
  vi.useRealTimers();
});

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

beforeEach(() => {
  h.calls.length = 0;
  h.liffId = null;
  h.loadLiffSdk.mockClear();
  h.loadLiffSdk.mockImplementation(() => Promise.resolve());
  h.init.mockClear();
  h.init.mockImplementation(() => Promise.resolve());
});

function mountWithLiff(liffId: string | null) {
  h.liffId = liffId;
  (window as unknown as { liff?: unknown }).liff = { init: h.init };
  return render(<LiffStateRedirect />);
}

afterEach(() => {
  delete (window as unknown as { liff?: unknown }).liff;
});

const spinner = (container: HTMLElement) => container.querySelector('svg[aria-hidden="true"]');

test('ไม่มี liff.state → ไม่มี overlay ไม่โหลด SDK ไม่ redirect', () => {
  const { container } = mountWithLiff('2000000001-abcdefgh');

  expect(container.querySelector('[role="status"]')).toBeNull();
  expect(h.loadLiffSdk).not.toHaveBeenCalled();
  expect(replaceMock).not.toHaveBeenCalled();
});

test('§ pre-paint script ถูก render เฉพาะเมื่อตั้ง LIFF ID — ยังไม่ตั้งห้ามซ่อนอะไรของหน้าแรก', () => {
  const withId = mountWithLiff('2000000001-abcdefgh');
  const script = withId.container.querySelector('script');
  expect(script?.textContent).toContain('data-liff-boot');
  withId.unmount();

  const withoutId = mountWithLiff(null);
  expect(withoutId.container.querySelector('script')).toBeNull();
});

test('§ หัวใจของบั๊กลูป: มี LIFF ID → init เสร็จก่อนจึง replace (ลำดับ load → init → replace) + overlay ขึ้นทันที', async () => {
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
  const { container } = mountWithLiff('2000000001-abcdefgh');

  // overlay โผล่ตั้งแต่ยังไม่ navigate (ผู้ใช้เห็น splash แทนหน้าแรก)
  expect(container.querySelector('[role="status"]')).not.toBeNull();
  expect(container.textContent).toContain('กำลังเปิดหน้าแจ้งเรื่อง…');

  await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/intake'));

  expect(h.loadLiffSdk).toHaveBeenCalledTimes(1);
  expect(h.init).toHaveBeenCalledWith({ liffId: '2000000001-abcdefgh' });
  expect(h.calls).toEqual(['load', 'init', 'replace']);
});

test('§ spinner หน่วง 250ms: ช่วงแรกไม่มี spinner (splash นิ่ง) พอเกิน 250ms จึงขึ้น', async () => {
  vi.useFakeTimers();
  currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent('/track');
  // init ค้างไว้ จะได้วัดตัว spinner โดด ๆ
  h.init.mockImplementation(() => new Promise<void>(() => {}));
  const { container } = mountWithLiff('2000000001-abcdefgh');

  await act(async () => {
    vi.advanceTimersByTime(100);
  });
  expect(spinner(container)).toBeNull();

  await act(async () => {
    vi.advanceTimersByTime(151);
  });
  expect(spinner(container)).not.toBeNull();
});

test('§ กัน init ค้าง: ครบ 5 วินาที ต้อง replace ต่อให้ promise ยังไม่ resolve', async () => {
  vi.useFakeTimers();
  currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent('/intake');
  h.init.mockImplementation(() => new Promise<void>(() => {}));
  mountWithLiff('2000000001-abcdefgh');

  await act(async () => {
    vi.advanceTimersByTime(4999);
  });
  expect(replaceMock).not.toHaveBeenCalled();

  await act(async () => {
    vi.advanceTimersByTime(2);
  });
  expect(replaceMock).toHaveBeenCalledWith('/intake');
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

  await act(async () => {});
  expect(replaceMock).not.toHaveBeenCalled();
});

test('มี liff.state แต่ยังไม่ตั้ง LIFF ID → replace ทันทีแบบไม่แตะ SDK (พฤติกรรมเดิม)', async () => {
  currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent('/track?id=HN123');
  mountWithLiff(null);

  await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/track?id=HN123'));
  expect(h.loadLiffSdk).not.toHaveBeenCalled();
});

test('§ ข้อความ splash บอกปลายทางจริง — ตาม prefix ของ target', async () => {
  const cases: Array<[string, string]> = [
    ['/intake', 'กำลังเปิดหน้าแจ้งเรื่อง…'],
    ['/track?id=HN123', 'กำลังเปิดหน้าติดตามเรื่อง…'],
    ['/other/page', 'กำลังเชื่อมต่อบัญชี LINE…'],
  ];
  for (const [path, message] of cases) {
    cleanup();
    currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent(path);
    const { container } = mountWithLiff('2000000001-abcdefgh');
    expect(container.textContent).toContain(message);
  }
});

test('§ overlay รับต่อจาก pre-paint: mount แล้วลบ data-liff-boot คืนให้ body มองเห็นได้', async () => {
  currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent('/intake');
  document.documentElement.setAttribute('data-liff-boot', '');
  mountWithLiff('2000000001-abcdefgh');

  await waitFor(() =>
    expect(document.documentElement.hasAttribute('data-liff-boot')).toBe(false),
  );
});

test('liff.state อันตราย (//, สัมบูรณ์, backslash) → ไม่ redirect ไม่โหลด SDK ไม่มี overlay', () => {
  for (const evil of [
    '//evil.com/track',
    'https://evil.com/track',
    '/\\evil.com/track',
    'javascript:alert(1)',
  ]) {
    cleanup();
    currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent(evil);
    const { container } = mountWithLiff('2000000001-abcdefgh');
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  }
  expect(h.loadLiffSdk).not.toHaveBeenCalled();
});

test('liff.state รูปแบบขอบ: / เดี่ยว → origin เดิมได้, ค่าว่าง/%2F%2F/space นำหน้า → ไม่ redirect', async () => {
  currentUrl = 'http://localhost/?liff.state=' + encodeURIComponent('/');
  mountWithLiff('2000000001-abcdefgh');
  await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'));

  replaceMock.mockClear();
  for (const edge of ['', '%2F%2Fevil.com', encodeURIComponent(' /track')]) {
    cleanup();
    currentUrl = 'http://localhost/?liff.state=' + edge;
    mountWithLiff('2000000001-abcdefgh');
  }
  // เคส valid ที่ยังรอ init อยู่ให้เวลาแสดงตัวก่อน ส่วนเคส invalid ต้องเงียบถาวร
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(replaceMock).not.toHaveBeenCalled();
});
