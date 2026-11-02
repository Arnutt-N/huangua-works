// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toLocalISODate } from '@/lib/validation';
import { buildSlotAvailability } from './slots';
import { QueueBookingForm } from './queue-booking-form';

// § เทส race 3 เคสนี้ flaky ภายใต้โหลดทั้งชุด (timeout 5s) — 30s ตาม intake pattern
vi.setConfig({ testTimeout: 30_000 });

/** วันราชการล่วงหน้า n วัน (จ–ศ) — ใช้เป็นวันที่จองที่ server mock ยอมรับแน่ ๆ */
function nextBusinessDays(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  while (out.length < count) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day >= 1 && day <= 5) out.push(toLocalISODate(d));
  }
  return out;
}

function nextSaturday(): string {
  const d = new Date();
  while (d.getDay() !== 6) {
    d.setDate(d.getDate() + 1);
  }
  return toLocalISODate(d);
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

/** กรอกฟอร์มหมวดราชการ (ไม่ต้องกรอกหมู่บ้าน) จนพร้อมกดจอง */
function fillGovernmentBookingForm() {
  fireEvent.change(screen.getByLabelText(/ชื่อ-นามสกุล/i), { target: { value: 'สมชาย ใจดี' } });
  fireEvent.change(screen.getByLabelText(/เบอร์โทรศัพท์ติดต่อกลับ/i), { target: { value: '0812345678' } });
  fireEvent.change(screen.getByLabelText(/เรื่องหรือหัวข้อ/i), { target: { value: 'ขออนุญาตก่อสร้าง' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /ยินยอม/i }));
}

describe('QueueBookingForm · หมวดหมู่และฟังก์ชันการใช้งาน', () => {
  it('สลับหมวดหมู่แล้วโหลดช่วงเวลาและรีเซ็ตค่า', async () => {
    const [dayA] = nextBusinessDays(1);
    if (!dayA) throw new Error('test setup: หาวันราชการไม่เจอ');

    fetchMock.mockResolvedValue(
      jsonResponse({ date: dayA, dateTh: dayA, slots: buildSlotAvailability([]) }),
    );

    render(<QueueBookingForm />);

    // เลือกหมวดงานติดต่อราชการ
    const govRadio = screen.getByRole('radio', { name: /งานติดต่อราชการทั่วไป/i });
    fireEvent.click(govRadio);
    expect(govRadio).toHaveAttribute('aria-checked', 'true');

    // กด preset เรื่องที่ติดต่อ
    const presetBtn = screen.getByRole('button', { name: /ขออนุญาตก่อสร้างอาคาร/i });
    fireEvent.click(presetBtn);

    const serviceInput = screen.getByLabelText(/เรื่องหรือหัวข้อ/i) as HTMLInputElement;
    expect(serviceInput.value).toContain('ขออนุญาตก่อสร้างอาคาร');
  });

  it('แสดงข้อความเตือนเมื่อเลือกวันหยุดเสาร์-อาทิตย์', async () => {
    const sat = nextSaturday();
    render(<QueueBookingForm />);
    const dateInput = screen.getByLabelText('วันที่นัด');
    fireEvent.change(dateInput, { target: { value: sat } });

    expect(
      screen.getByText(/อบต.หัวงัว ปิดทำการในวันหยุดราชการ/i),
    ).toBeInTheDocument();
  });
});

describe('QueueBookingForm · race ตอนเปลี่ยนวันที่', () => {
  it('response เก่าของวันก่อนหน้าไม่ทับตารางของวันล่าสุด', async () => {
    const [dayA, dayB] = nextBusinessDays(2);
    if (!dayA || !dayB) throw new Error('test setup: หาวันราชการไม่เจอ');
    const gateA = deferred<Response>();
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      // วัน B ตอบทันที: slot_1 เต็มแล้ว
      if (url.includes(dayB)) {
        return Promise.resolve(
          jsonResponse({ date: dayB, dateTh: dayB, slots: buildSlotAvailability(['slot_1']) }),
        );
      }
      // วัน A ตอบช้า (ค้างจนกว่าจะ resolve)
      return gateA.promise;
    });

    render(<QueueBookingForm />);
    const dateInput = screen.getByLabelText('วันที่นัด');
    fireEvent.change(dateInput, { target: { value: dayA } });
    fireEvent.change(dateInput, { target: { value: dayB } });

    // B มาก่อน — slot_1 เต็มแล้ว
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /09:00.*คิวเต็ม/ })).toBeDisabled(),
    );

    // A มาช้า (ข้อมูลว่างหมด) — ต้องถูกทิ้ง ตารางยังเป็นของ B
    gateA.resolve(
      jsonResponse({ date: dayA, dateTh: dayA, slots: buildSlotAvailability([]) }),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByRole('radio', { name: /09:00.*คิวเต็ม/ })).toBeDisabled();
  });

  it('POST ชน 409 แล้วรีเฟรชตารางของวันเดิมให้เห็นช่วงที่เต็ม', async () => {
    const [dayA] = nextBusinessDays(1);
    if (!dayA) throw new Error('test setup: หาวันราชการไม่เจอ');
    let getCount = 0;
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ error: 'ช่วงนี้ถูกจองแล้ว' }, 409));
      }
      // GET ครั้งแรกว่างหมด ครั้งรีเฟรชหลัง 409 slot_1 เต็ม
      getCount += 1;
      const taken = getCount === 1 ? [] : ['slot_1'];
      return Promise.resolve(
        jsonResponse({ date: dayA, dateTh: dayA, slots: buildSlotAvailability(taken) }),
      );
    });

    render(<QueueBookingForm />);
    // สลับเป็นหมวดราชการ เพื่อความสะดวกในการกรอก
    fireEvent.click(screen.getByRole('radio', { name: /งานติดต่อราชการทั่วไป/i }));

    fireEvent.change(screen.getByLabelText('วันที่นัด'), { target: { value: dayA } });
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'เช้า 09:00–10:30' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'เช้า 09:00–10:30' }));
    fillGovernmentBookingForm();
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการจองคิว' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ช่วงนี้ถูกจองแล้ว'));
    // รีเฟรชแล้ว: slot_1 เต็ม + เลิกเลือกช่วงเดิม
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /09:00.*คิวเต็ม/ })).toBeDisabled(),
    );
    const getCalls = fetchMock.mock.calls.filter(([, init]) => init?.method !== 'POST');
    expect(getCalls).toHaveLength(2);
  });

  it('เปลี่ยนวันระหว่างรอ POST แล้ว 409 มาช้า — ไม่ดึงวันเก่ามาทับตารางวันใหม่', async () => {
    const [dayA, dayB] = nextBusinessDays(2);
    if (!dayA || !dayB) throw new Error('test setup: หาวันราชการไม่เจอ');
    const postGate = deferred<Response>();
    fetchMock.mockImplementation((input, init) => {
      if (init?.method === 'POST') return postGate.promise;
      return Promise.resolve(
        jsonResponse({
          date: dayB,
          dateTh: dayB,
          slots: buildSlotAvailability(
            String(input).includes(dayA) &&
              fetchMock.mock.calls.filter(([u]) => String(u).includes(dayA)).length > 1
              ? ['slot_1']
              : [],
          ),
        }),
      );
    });

    render(<QueueBookingForm />);
    fireEvent.click(screen.getByRole('radio', { name: /งานติดต่อราชการทั่วไป/i }));

    const dateInput = screen.getByLabelText('วันที่นัด');
    fireEvent.change(dateInput, { target: { value: dayA } });
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'เช้า 09:00–10:30' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'เช้า 09:00–10:30' }));
    fillGovernmentBookingForm();
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการจองคิว' }));

    // เปลี่ยนวันระหว่างรอ POST ตอบ
    fireEvent.change(dateInput, { target: { value: dayB } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3)); // GET A, POST, GET B

    // POST ตอบ 409 ช้า — วันเก่าแล้ว ต้องไม่รีเฟรชทับ
    postGate.resolve(jsonResponse({ error: 'ช่วงนี้ถูกจองแล้ว' }, 409));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const getACalls = fetchMock.mock.calls.filter(
      ([u, init]) => init?.method !== 'POST' && String(u).includes(dayA),
    );
    expect(getACalls).toHaveLength(1);
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'เช้า 09:00–10:30' })).toBeEnabled(),
    );
  });

  it('เมื่อกดส่งฟอร์มว่าง จะแสดง ErrorSummary พร้อม role=alert และย้ายโฟกัสไปยัง ErrorSummary', async () => {
    const scrollIntoViewMock = vi.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

    render(<QueueBookingForm />);

    const submitBtn = screen.getByRole('button', { name: 'ยืนยันการจองคิว' });
    fireEvent.click(submitBtn);

    const alert = screen.getByRole('alert', { name: /กรุณาตรวจสอบข้อมูล/i });
    expect(alert).toBeInTheDocument();
    expect(document.activeElement).toBe(alert);

    // ตรวจสอบว่ามีลิงก์ไปยังฟิลด์ต่าง ๆ
    const nameLink = screen.getByRole('link', { name: /ชื่อ-นามสกุล/i });
    expect(nameLink).toHaveAttribute('href', '#queue-name');

    // กดลิงก์แล้วโฟกัสต้องย้ายไปยัง input ชื่อ-นามสกุล
    fireEvent.click(nameLink);
    expect(document.activeElement).toBe(screen.getByLabelText(/ชื่อ-นามสกุล/i));
    expect(scrollIntoViewMock).toHaveBeenCalled();

    // ตรวจสอบ aria-describedby และ aria-invalid
    const nameInput = screen.getByLabelText(/ชื่อ-นามสกุล/i);
    expect(nameInput).toHaveAttribute('aria-describedby', 'queue-name-error');
    expect(screen.getByText('กรุณากรอกชื่อ-นามสกุล')).toHaveAttribute('id', 'queue-name-error');
  });

  it('กดส่งซ้ำเมื่อยังมีข้อผิดพลาด จะย้ายโฟกัสกลับมาที่ ErrorSummary อีกครั้ง', async () => {
    render(<QueueBookingForm />);

    const submitBtn = screen.getByRole('button', { name: 'ยืนยันการจองคิว' });
    fireEvent.click(submitBtn);

    const alert = screen.getByRole('alert', { name: /กรุณาตรวจสอบข้อมูล/i });
    expect(document.activeElement).toBe(alert);

    // ย้ายโฟกัสไปที่ปุ่มส่งอีกรอบแล้วกดส่ง
    submitBtn.focus();
    expect(document.activeElement).toBe(submitBtn);

    fireEvent.click(submitBtn);
    expect(document.activeElement).toBe(alert);
  });
});
