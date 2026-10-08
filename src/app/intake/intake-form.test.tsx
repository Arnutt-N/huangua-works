// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INTAKE_DRAFT_KEY, saveIntakeDraft } from '../../components/forms/non-pii-draft';
import { IntakeForm } from './intake-form';

vi.mock('../../components/liff/liff-provider', () => ({
  useLiff: () => ({ authenticated: false, displayName: null }),
}));

const categories = [{ id: 'roads', name: 'ถนน' }];

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const data = url === '/api/provinces' ? { provinces: [{ id: 46, nameTh: 'กาฬสินธุ์' }] }
      : url.startsWith('/api/districts') ? { districts: [{ id: 4603, nameTh: 'ยางตลาด' }] }
      : url.startsWith('/api/subdistricts') ? { subdistricts: [{ id: 460301, nameTh: 'หัวงัว' }] }
      : url.startsWith('/api/villages') ? { villages: [] }
      : { caseId: 'case-test', trackingCode: 'HG483729156', message: 'บันทึกเรื่องแล้ว' };
    return { ok: true, json: async () => data };
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
});

async function choose(label: string, option: string) {
  fireEvent.keyDown(screen.getByLabelText(label), { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: option }));
}

describe('ฟอร์มแจ้งเรื่องสำหรับผู้สูงอายุ', () => {
  it('ทุก control ที่ validate ผิดเชื่อมกับข้อความ role=alert รวม select และ consent', async () => {
    render(<IntakeForm categories={categories} />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'ส่งเรื่อง' }));
    for (const id of ['name', 'cid', 'cat', 'title', 'detail', 'province', 'district', 'subdistrict', 'consent']) {
      const control = document.getElementById(id)!;
      expect(control, id).toHaveAttribute('aria-invalid', 'true');
      const errorId = control.getAttribute('aria-describedby')!.split(' ')[0]!;
      expect(document.getElementById(errorId), id).toHaveAttribute('role', 'alert');
      expect(document.getElementById(errorId), id).not.toBeEmptyDOMElement();
    }
    expect(fetch).not.toHaveBeenCalledWith('/api/cases/submit', expect.anything());
  });

  it('บันทึกเฉพาะหมวดอัตโนมัติแม้กรอก PII และข้อความอิสระ แล้วคืนค่าเฉพาะหมวด', async () => {
    const view = render(<IntakeForm categories={categories} />);
    await choose('หมวดเรื่อง', 'ถนน');
    for (const [id, value] of Object.entries({
      name: 'นายทดสอบ', cid: '1234567890123', phone: '0812345678',
      title: 'แจ้งเรื่องของนายทดสอบ', detail: 'ติดต่อ 0812345678', village: 'บ้านนายทดสอบ', addr: 'ที่อยู่ส่วนบุคคล',
    })) fireEvent.change(document.getElementById(id)!, { target: { value } });
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(INTAKE_DRAFT_KEY)!)).toEqual({ version: 1, categoryId: 'roads' }));
    view.unmount();
    render(<IntakeForm categories={categories} />);
    await waitFor(() => expect(screen.getByLabelText('หมวดเรื่อง')).toHaveTextContent('ถนน'));
    for (const id of ['name', 'cid', 'phone', 'title', 'detail', 'village', 'addr']) expect(document.getElementById(id)).toHaveValue('');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('ปุ่มล้างดราฟต์ล้าง storage และค่าฟอร์มโดยไม่บันทึกกลับ', async () => {
    saveIntakeDraft('roads', ['roads']);
    render(<IntakeForm categories={categories} />);
    await waitFor(() => expect(screen.getByLabelText('หมวดเรื่อง')).toHaveTextContent('ถนน'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'ล้างดราฟต์และข้อมูล' }));
    expect(window.localStorage.getItem(INTAKE_DRAFT_KEY)).toBeNull();
    expect(screen.getByLabelText('หมวดเรื่อง')).toHaveTextContent('เลือกหมวด');
  });

  it('ส่งสำเร็จล้าง draft แต่ไม่บันทึกข้อมูลส่วนบุคคลที่ส่ง API', async () => {
    render(<IntakeForm categories={categories} />);
    await choose('หมวดเรื่อง', 'ถนน');
    fireEvent.change(screen.getByLabelText('ชื่อ - นามสกุล'), { target: { value: 'นายทดสอบ' } });
    const prefix = '123456789012';
    const sum = [...prefix].reduce((total, digit, i) => total + Number(digit) * (13 - i), 0);
    fireEvent.change(screen.getByLabelText('เลขบัตรประชาชน 13 หลัก'), { target: { value: prefix + ((11 - sum % 11) % 10) } });
    fireEvent.change(screen.getByLabelText('หัวเรื่อง'), { target: { value: 'ถนนชำรุด' } });
    fireEvent.change(screen.getByLabelText('รายละเอียด'), { target: { value: 'มีหลุมบนถนน' } });
    await choose('จังหวัด', 'กาฬสินธุ์');
    await waitFor(() => expect(screen.getByLabelText('อำเภอ')).not.toBeDisabled());
    await choose('อำเภอ', 'ยางตลาด');
    await waitFor(() => expect(screen.getByLabelText('ตำบล')).not.toBeDisabled());
    await choose('ตำบล', 'หัวงัว');
    fireEvent.click(screen.getByRole('checkbox'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'ส่งเรื่อง' }));
    await screen.findByRole('heading', { name: 'รับเรื่องเรียบร้อย' });
    expect(window.localStorage.getItem(INTAKE_DRAFT_KEY)).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/cases/submit', expect.objectContaining({ method: 'POST' }));
  });

  it('เชื่อม hint รายละเอียดกับ textarea ก่อนมี error', () => {
    render(<IntakeForm categories={categories} />);
    expect(screen.getByLabelText('รายละเอียด')).toHaveAttribute('aria-describedby', 'detail-hint');
    expect(document.getElementById('detail-hint')).toHaveTextContent('ยิ่งละเอียด');
  });
});
