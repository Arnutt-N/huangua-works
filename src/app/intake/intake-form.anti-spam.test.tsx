// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { IntakeForm } from './intake-form';
import { countFailures } from '../../../scripts/check-contrast';

vi.mock('../../components/liff/liff-provider', () => ({
  useLiff: () => ({ authenticated: false, displayName: null }),
}));
const NOW = 1_800_000_000_000;
const fetchMock = vi.fn();
let clock: MockInstance<() => number>;
const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView');
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});
afterAll(() => {
  if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', scrollDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

beforeEach(() => {
  clock = vi.spyOn(Date, 'now').mockReturnValue(NOW);
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

  fetchMock.mockReset().mockImplementation(async (url: string) => {
    const data = url === '/api/cases/submit'
      ? { caseId: 'case-test', trackingCode: 'HG000000001', message: 'รับเรื่องเรียบร้อย' }
      : url === '/api/provinces' ? { provinces: [{ id: 46, nameTh: 'กาฬสินธุ์' }] }
      : url.startsWith('/api/districts?') ? { districts: [{ id: 4603, nameTh: 'ยางตลาด' }] }
      : url.startsWith('/api/subdistricts?') ? { subdistricts: [{ id: 460301, nameTh: 'หัวงัว' }] }
      : url.startsWith('/api/villages?') ? { villages: [] }
      : (() => { throw new Error('ห้ามยิง API จริงหรือ endpoint ที่ไม่ได้จำลอง'); })();
    return { ok: true, status: 201, json: async () => data };
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function choose(label: string, option: string) {
  const trigger = screen.getByLabelText(label);
  await waitFor(() => expect((trigger as HTMLButtonElement).disabled).toBe(false));
  fireEvent.keyDown(trigger, { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: option }));
}
async function readyForm() {
  const view = render(<IntakeForm categories={[{ id: 'roads', name: 'ถนน' }]} />);
  fireEvent.change(screen.getByLabelText('ชื่อ - นามสกุล'), { target: { value: 'นายทดสอบ' } });
  const prefix = '123456789012';
  const sum = [...prefix].reduce((total, digit, i) => total + Number(digit) * (13 - i), 0);
  fireEvent.change(screen.getByLabelText('เลขบัตรประชาชน 13 หลัก'), { target: { value: prefix + ((11 - sum % 11) % 10) } });
  fireEvent.change(screen.getByLabelText('หัวเรื่อง'), { target: { value: 'ถนนชำรุดในหมู่บ้าน' } });
  fireEvent.change(screen.getByLabelText('รายละเอียด'), { target: { value: 'ถนนเป็นหลุมขนาดใหญ่บริเวณหน้าวัดในหมู่บ้าน กรุณาช่วยตรวจสอบและซ่อมแซม' } });
  await choose('หมวดเรื่อง', 'ถนน');
  await choose('จังหวัด', 'กาฬสินธุ์');
  await choose('อำเภอ', 'ยางตลาด');
  await choose('ตำบล', 'หัวงัว');
  fireEvent.click(screen.getByRole('checkbox'));
  await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/api/villages?'))).toBe(true));
  return view.container.querySelector('form')!;
}
const posts = () => fetchMock.mock.calls.filter(([url]) => url === '/api/cases/submit');
const payload = () => JSON.parse(posts()[0]![1].body as string);

describe('ฟอร์ม intake — สัญญาณกันสแปม', () => {
  it('ฟิลด์ website_url อยู่นอกจอ ไม่รับ tab และไม่อ่านออกเสียง โดยไม่ใช้ display:none', () => {
    const { container } = render(<IntakeForm categories={[]} />);
    const input = container.querySelector<HTMLInputElement>('input[name="website_url"]')!;
    expect(input.id).toBe('website_url');
    expect(input.tabIndex).toBe(-1);
    expect(input.getAttribute('aria-hidden')).toBe('true');
    expect(input.autocomplete).toBe('off');
    expect(input.hidden).toBe(false);
    expect(input.parentElement!.style.position).toBe('absolute');
    expect(parseFloat(input.parentElement!.style.left)).toBeLessThan(0);
    expect(getComputedStyle(input.parentElement!).display).not.toBe('none');
    expect(screen.queryByRole('textbox', { name: 'เว็บไซต์' })).toBeNull();
  });
  it.each([
    { websiteUrl: '', elapsed: 500, delay: 1500 },
    { websiteUrl: 'https://spam.test', elapsed: 500, delay: 1500 },
    { websiteUrl: '', elapsed: -60000, delay: 2000 },
  ])('กรอกไวหรือนาฬิกาถอยหลังรอ $delay ms โดยเก็บสัญญาณตั้งแต่กดส่ง ($websiteUrl)', async ({ websiteUrl, elapsed, delay }) => {
    const form = await readyForm();
    const input = form.querySelector<HTMLInputElement>('input[name="website_url"]')!;
    input.value = websiteUrl;
    clock.mockReturnValue(NOW + elapsed);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.submit(form);
    input.value = '';
    expect(posts()).toHaveLength(0);
    await act(async () => { await vi.advanceTimersByTimeAsync(delay - 1); });
    expect(posts()).toHaveLength(0);
    clock.mockReturnValue(NOW + 2000);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(posts()).toHaveLength(1);
    expect(payload().formStartedAt).toBe(NOW);
    expect(payload().websiteUrl).toBe(websiteUrl || undefined);
  });
  it.each([2000, 30000, 3600000])('ผู้ใช้ใช้เวลา %s ms ส่งได้ทันทีและเวลาเริ่มไม่เปลี่ยนตามการ render', async (elapsed) => {
    const form = await readyForm();
    clock.mockReturnValue(NOW + elapsed);
    fireEvent.change(screen.getByLabelText('หัวเรื่อง'), { target: { value: 'ถนนชำรุดต้องซ่อมแซม' } });
    fireEvent.submit(form);
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(payload().formStartedAt).toBe(NOW);
    expect(payload().websiteUrl).toBeUndefined();
    await screen.findByText('รับเรื่องเรียบร้อย', { selector: 'h2' });
  });
  it('ส่งซ้ำหลัง error ใช้เวลาเริ่มฟอร์มเดิม ไม่เริ่มนับใหม่', async () => {
    const form = await readyForm();
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่' }) });
    clock.mockReturnValue(NOW + 30000);
    fireEvent.submit(form);
    await screen.findByRole('alert');
    clock.mockReturnValue(NOW + 60000);
    fireEvent.submit(form);
    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(posts().map(([, options]) => JSON.parse(options.body as string).formStartedAt)).toEqual([NOW, NOW]);
    await screen.findByText('รับเรื่องเรียบร้อย', { selector: 'h2' });
  });
  it('contrast gate ผ่านทั้งธีมโดยไม่เรียก suite อื่น', () => {
    expect(countFailures(true)).toBe(0);
  });
});
