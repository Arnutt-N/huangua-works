// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INTAKE_DRAFT_KEY, saveIntakeDraft } from '../../components/forms/non-pii-draft';
import { IntakeForm } from './intake-form';
import { INTAKE_FILE_TIMEOUT_MS, INTAKE_QUERY_TIMEOUT_MS } from './intake-test-timeouts';

vi.mock('../../components/liff/liff-provider', () => ({
  useLiff: () => ({ authenticated: false, displayName: null }),
}));

vi.setConfig({ testTimeout: INTAKE_FILE_TIMEOUT_MS });

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
      : url === '/api/cases/upload' ? { ok: true, id: 'att-1', url: 'https://storage.huangua.go.th/media/cases/attachments/att-1.png', key: 'cases/attachments/att-1.png', type: 'image/png', size: 1024 }
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
  fireEvent.click(await screen.findByRole('option', { name: option }, { timeout: INTAKE_QUERY_TIMEOUT_MS }));
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
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(INTAKE_DRAFT_KEY)!)).toEqual({ version: 1, categoryId: 'roads' }), { timeout: INTAKE_QUERY_TIMEOUT_MS });
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
    await waitFor(() => expect(screen.getByLabelText('อำเภอ')).not.toBeDisabled(), { timeout: INTAKE_QUERY_TIMEOUT_MS });
    await choose('อำเภอ', 'ยางตลาด');
    await waitFor(() => expect(screen.getByLabelText('ตำบล')).not.toBeDisabled(), { timeout: INTAKE_QUERY_TIMEOUT_MS });
    await choose('ตำบล', 'หัวงัว');
    fireEvent.click(screen.getByRole('checkbox'));
    await userEvent.setup().click(screen.getByRole('button', { name: 'ส่งเรื่อง' }));
    await screen.findByRole('heading', { name: 'รับเรื่องเรียบร้อย' }, { timeout: INTAKE_QUERY_TIMEOUT_MS });
    expect(window.localStorage.getItem(INTAKE_DRAFT_KEY)).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/api/cases/submit', expect.objectContaining({ method: 'POST' }));
  });

  it('เชื่อม hint รายละเอียดกับ textarea ก่อนมี error', () => {
    render(<IntakeForm categories={categories} />);
    expect(screen.getByLabelText('รายละเอียด')).toHaveAttribute('aria-describedby', 'detail-hint');
    expect(document.getElementById('detail-hint')).toHaveTextContent('ยิ่งละเอียด');
  });

  it('NET-01: เมื่อโหลด geodata ล้มเหลว (500) จะแสดง alert พร้อมปุ่มลองใหม่ และไม่ล้างข้อมูลฟอร์มที่กรอกไว้', async () => {
    let districtCallCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/provinces') {
        return { ok: true, json: async () => ({ provinces: [{ id: 46, nameTh: 'กาฬสินธุ์' }] }) };
      }
      if (url.startsWith('/api/districts')) {
        districtCallCount++;
        if (districtCallCount === 1) {
          return { ok: false, status: 500, json: async () => ({ error: 'Database unavailable' }) };
        }
        return { ok: true, json: async () => ({ districts: [{ id: 4603, nameTh: 'ยางตลาด' }] }) };
      }
      return { ok: true, json: async () => ({}) };
    }));

    render(<IntakeForm categories={categories} />);
    fireEvent.change(screen.getByLabelText('ชื่อ - นามสกุล'), { target: { value: 'สมชาย ใจดี' } });
    fireEvent.change(screen.getByLabelText('หัวเรื่อง'), { target: { value: 'น้ำไม่ไหล' } });

    await waitFor(() => expect(screen.getByLabelText('จังหวัด')).not.toBeDisabled(), {
      timeout: INTAKE_QUERY_TIMEOUT_MS,
    });
    await choose('จังหวัด', 'กาฬสินธุ์');

    const alert = await screen.findByRole('alert', undefined, { timeout: INTAKE_QUERY_TIMEOUT_MS });
    expect(alert).toHaveTextContent('โหลดรายชื่ออำเภอไม่สำเร็จ กรุณาลองใหม่');
    const retryBtn = screen.getByRole('button', { name: 'ลองใหม่' });
    expect(retryBtn).toBeInTheDocument();

    expect(screen.getByLabelText('ชื่อ - นามสกุล')).toHaveValue('สมชาย ใจดี');
    expect(screen.getByLabelText('หัวเรื่อง')).toHaveValue('น้ำไม่ไหล');

    fireEvent.click(retryBtn);

    await waitFor(() => expect(screen.queryByText('โหลดรายชื่ออำเภอไม่สำเร็จ กรุณาลองใหม่')).not.toBeInTheDocument(), {
      timeout: INTAKE_QUERY_TIMEOUT_MS,
    });
    await waitFor(() => expect(screen.getByLabelText('อำเภอ')).not.toBeDisabled(), {
      timeout: INTAKE_QUERY_TIMEOUT_MS,
    });
    await choose('อำเภอ', 'ยางตลาด');
    expect(screen.getByLabelText('อำเภอ')).toHaveTextContent('ยางตลาด');
  });

  it('NET-01: เมื่อโหลดจังหวัดล้มเหลว (network fail) จะมีปุ่มลองใหม่ และกดแล้วโหลดจังหวัดสำเร็จได้', async () => {
    let provinceCallCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/provinces') {
        provinceCallCount++;
        if (provinceCallCount === 1) {
          throw new Error('Network error');
        }
        return { ok: true, json: async () => ({ provinces: [{ id: 46, nameTh: 'กาฬสินธุ์' }] }) };
      }
      return { ok: true, json: async () => ({}) };
    }));

    render(<IntakeForm categories={categories} />);

    const alert = await screen.findByRole('alert', undefined, { timeout: INTAKE_QUERY_TIMEOUT_MS });
    expect(alert).toHaveTextContent('โหลดรายชื่อจังหวัดไม่สำเร็จ กรุณาลองใหม่');

    const retryBtn = screen.getByRole('button', { name: 'ลองใหม่' });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);

    await waitFor(() => expect(screen.queryByText('โหลดรายชื่อจังหวัดไม่สำเร็จ กรุณาลองใหม่')).not.toBeInTheDocument(), {
      timeout: INTAKE_QUERY_TIMEOUT_MS,
    });
    await waitFor(() => expect(screen.getByLabelText('จังหวัด')).not.toBeDisabled(), {
      timeout: INTAKE_QUERY_TIMEOUT_MS,
    });
    await choose('จังหวัด', 'กาฬสินธุ์');
    expect(screen.getByLabelText('จังหวัด')).toHaveTextContent('กาฬสินธุ์');
  });

  it('NET-01: เมื่อสลับจังหวัดเร็ว ผลลัพธ์ที่มาช้าของจังหวัดเก่าจะไม่ทับอำเภอของจังหวัดใหม่', async () => {
    let resolveFirstDistrict: (val: unknown) => void;
    const firstDistrictPromise = new Promise((resolve) => {
      resolveFirstDistrict = resolve;
    });

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/provinces') {
        return {
          ok: true,
          json: async () => ({
            provinces: [
              { id: 46, nameTh: 'กาฬสินธุ์' },
              { id: 40, nameTh: 'ขอนแก่น' },
            ],
          }),
        };
      }
      if (url.startsWith('/api/districts?provinceId=46')) {
        await firstDistrictPromise;
        return {
          ok: true,
          json: async () => ({
            districts: [{ id: 4603, nameTh: 'ยางตลาด' }],
          }),
        };
      }
      if (url.startsWith('/api/districts?provinceId=40')) {
        return {
          ok: true,
          json: async () => ({
            districts: [{ id: 4001, nameTh: 'เมืองขอนแก่น' }],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }));

    render(<IntakeForm categories={categories} />);
    await waitFor(() => expect(screen.getByLabelText('จังหวัด')).not.toBeDisabled(), {
      timeout: INTAKE_QUERY_TIMEOUT_MS,
    });

    // 1. เลือกกาฬสินธุ์ (ยิง request กาฬสินธุ์ ค้างไว้)
    await choose('จังหวัด', 'กาฬสินธุ์');

    // 2. เปลี่ยนเป็นขอนแก่นทันที (ยิง request ขอนแก่น)
    await choose('จังหวัด', 'ขอนแก่น');

    // ขอนแก่นตอบกลับก่อน
    await waitFor(() => expect(screen.getByLabelText('อำเภอ')).not.toBeDisabled(), {
      timeout: INTAKE_QUERY_TIMEOUT_MS,
    });
    await choose('อำเภอ', 'เมืองขอนแก่น');
    expect(screen.getByLabelText('อำเภอ')).toHaveTextContent('เมืองขอนแก่น');

    // 3. ปล่อยให้ request กาฬสินธุ์ resolve ช้ากว่า
    resolveFirstDistrict!({ ok: true });

    // อำเภอต้องยังเป็น เมืองขอนแก่น ไม่ถูกทับ
    expect(screen.getByLabelText('อำเภอ')).toHaveTextContent('เมืองขอนแก่น');
  });
});

describe('IntakeForm — แนบรูปภาพและ Network Resilience (Scope 1A + 1B)', () => {
  it('เลือกรูปภาพแนบ → แสดง preview พร้อมชื่อและขนาด และสามารถกดลบได้', async () => {
    const user = userEvent.setup();
    render(<IntakeForm categories={categories} />);

    // input file
    const fileInput = document.getElementById('attachment-input') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // สร้าง mock file
    const file = new File(['png-content'], 'damaged-road.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    // ต้องแสดงชื่อไฟล์ และขนาด
    await waitFor(() => {
      expect(screen.getByText('damaged-road.png')).toBeInTheDocument();
    });

    // กดลบไฟล์
    const deleteBtn = screen.getByRole('button', { name: 'ลบไฟล์ damaged-road.png' });
    await user.click(deleteBtn);

    // รายการต้องหายไป
    expect(screen.queryByText('damaged-road.png')).not.toBeInTheDocument();
  });

  it('ส่งเรื่องพร้อมไฟล์แนบ → ส่ง attachments ไปยัง /api/cases/submit', async () => {
    const user = userEvent.setup();
    render(<IntakeForm categories={categories} />);

    // กรอกข้อมูลฟอร์ม
    await choose('หมวดเรื่อง', 'ถนน');
    fireEvent.change(document.getElementById('name')!, { target: { value: 'สมศรี มีสุข' } });
    fireEvent.change(document.getElementById('cid')!, { target: { value: '1100500123451' } });
    fireEvent.change(document.getElementById('phone')!, { target: { value: '0812345678' } });
    fireEvent.change(document.getElementById('title')!, { target: { value: 'ถนนหน้าบ้านชำรุด' } });
    fireEvent.change(document.getElementById('detail')!, { target: { value: 'มีหลุมลึกขนาดใหญ่ น้ำท่วมขัง' } });

    await choose('จังหวัด', 'กาฬสินธุ์');
    await waitFor(() => expect(screen.getByLabelText('อำเภอ')).not.toBeDisabled(), { timeout: INTAKE_QUERY_TIMEOUT_MS });
    await choose('อำเภอ', 'ยางตลาด');
    await waitFor(() => expect(screen.getByLabelText('ตำบล')).not.toBeDisabled(), { timeout: INTAKE_QUERY_TIMEOUT_MS });
    await choose('ตำบล', 'หัวงัว');

    // แนบรูป
    const fileInput = document.getElementById('attachment-input') as HTMLInputElement;
    const file = new File(['png-content'], 'pothole.png', { type: 'image/png' });
    await user.upload(fileInput, file);
    await waitFor(() => expect(screen.getByText('pothole.png')).toBeInTheDocument());

    // ติ๊ก consent
    fireEvent.click(document.getElementById('consent')!);

    // ส่งเรื่อง
    const submitBtn = screen.getByRole('button', { name: 'ส่งเรื่อง' });
    await user.click(submitBtn);

    // ตรวจสอบว่า fetch /api/cases/submit ถูกเรียกพร้อม attachments
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/cases/submit',
        expect.objectContaining({
          body: expect.stringContaining('"attachments":[{"url":"https://storage.huangua.go.th/media/cases/attachments/att-1.png","type":"image/png","size":11}]'),
        })
      );
    });
  });

  it('เมื่อการส่งเรื่องเกิด Timeout → แสดงข้อความเตือนและข้อมูลฟอร์มไม่หาย', async () => {
    const user = userEvent.setup();

    // Mock fetch ให้ /api/cases/submit throw TimeoutError
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/cases/submit') {
        const err = new Error('The operation was aborted');
        err.name = 'TimeoutError';
        throw err;
      }
      const data = url === '/api/provinces' ? { provinces: [{ id: 46, nameTh: 'กาฬสินธุ์' }] }
        : url.startsWith('/api/districts') ? { districts: [{ id: 4603, nameTh: 'ยางตลาด' }] }
        : url.startsWith('/api/subdistricts') ? { subdistricts: [{ id: 460301, nameTh: 'หัวงัว' }] }
        : url.startsWith('/api/villages') ? { villages: [] }
        : { caseId: 'case-test', trackingCode: 'HG483729156', message: 'บันทึกเรื่องแล้ว' };
      return { ok: true, json: async () => data };
    }));

    render(<IntakeForm categories={categories} />);

    // กรอกข้อมูลฟอร์ม
    await choose('หมวดเรื่อง', 'ถนน');
    fireEvent.change(document.getElementById('name')!, { target: { value: 'สมชาย รักชาติ' } });
    fireEvent.change(document.getElementById('cid')!, { target: { value: '1100500123451' } });
    fireEvent.change(document.getElementById('phone')!, { target: { value: '0898765432' } });
    fireEvent.change(document.getElementById('title')!, { target: { value: 'เสาไฟทางดับ' } });
    fireEvent.change(document.getElementById('detail')!, { target: { value: 'มืดมากตอนกลางคืน' } });

    await choose('จังหวัด', 'กาฬสินธุ์');
    await waitFor(() => expect(screen.getByLabelText('อำเภอ')).not.toBeDisabled(), { timeout: INTAKE_QUERY_TIMEOUT_MS });
    await choose('อำเภอ', 'ยางตลาด');
    await waitFor(() => expect(screen.getByLabelText('ตำบล')).not.toBeDisabled(), { timeout: INTAKE_QUERY_TIMEOUT_MS });
    await choose('ตำบล', 'หัวงัว');

    fireEvent.click(document.getElementById('consent')!);

    const submitBtn = screen.getByRole('button', { name: 'ส่งเรื่อง' });
    await user.click(submitBtn);

    // ต้องแสดง error เกี่ยวกับการหมดเวลาการเชื่อมต่อ
    await waitFor(() => {
      expect(screen.getByText(/การเชื่อมต่อหมดเวลา/)).toBeInTheDocument();
    });

    // ข้อมูลฟอร์มยังคงอยู่ครบ ไม่ถูกล้าง
    expect(document.getElementById('name')).toHaveValue('สมชาย รักชาติ');
    expect(document.getElementById('title')).toHaveValue('เสาไฟทางดับ');
    expect(document.getElementById('detail')).toHaveValue('มืดมากตอนกลางคืน');
  });
});
