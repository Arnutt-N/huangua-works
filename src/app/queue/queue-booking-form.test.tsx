// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toLocalISODate } from '@/lib/validation';
import { buildSlotAvailability } from './slots';
import { QueueBookingForm } from './queue-booking-form';

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

/** กรอกฟอร์มจนพร้อมกดจอง (สมมติตารางช่วงว่างโหลดแล้ว) */
function fillBookingForm() {
  fireEvent.change(screen.getByLabelText('ชื่อ-นามสกุล'), { target: { value: 'สมชาย ใจดี' } });
  fireEvent.change(screen.getByLabelText('เบอร์โทรติดต่อกลับ'), { target: { value: '0812345678' } });
  fireEvent.change(screen.getByLabelText('ประเภทงานช่าง'), { target: { value: 'ไฟฟ้าดับ' } });
  fireEvent.click(screen.getByRole('checkbox', { name: /ยินยอม/ }));
}

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
      expect(screen.getByRole('radio', { name: /09:00.*เต็มแล้ว/ })).toBeDisabled(),
    );

    // A มาช้า (ข้อมูลว่างหมด) — ต้องถูกทิ้ง ตารางยังเป็นของ B
    gateA.resolve(
      jsonResponse({ date: dayA, dateTh: dayA, slots: buildSlotAvailability([]) }),
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.getByRole('radio', { name: /09:00.*เต็มแล้ว/ })).toBeDisabled();
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
    fireEvent.change(screen.getByLabelText('วันที่นัด'), { target: { value: dayA } });
    // § รอปุ่มช่วงมาจริง ไม่ใช่แค่ fetch ถูกเรียก — ตอน slotsLoading ฟอร์มถอด
    // radiogroup ออก คลิกทันทีจะแข่งกับ response (flake)
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'เช้า 09:00–10:30' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'เช้า 09:00–10:30' }));
    fillBookingForm();
    fireEvent.click(screen.getByRole('button', { name: 'ยืนยันการจองคิว' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('ช่วงนี้ถูกจองแล้ว'));
    // รีเฟรชแล้ว: slot_1 เต็ม + เลิกเลือกช่วงเดิม
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /09:00.*เต็มแล้ว/ })).toBeDisabled(),
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
          // ถ้าโค้ดดึงวัน A ซ้ำหลัง 409 จะได้ข้อมูลนี้ (slot_1 เต็ม) มาทับตารางวัน B
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
    const dateInput = screen.getByLabelText('วันที่นัด');
    fireEvent.change(dateInput, { target: { value: dayA } });
    // § เหตุผลเดียวกับเทสก่อนหน้า — รอปุ่มช่วงมาจริงก่อนคลิก กัน flake
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'เช้า 09:00–10:30' })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole('radio', { name: 'เช้า 09:00–10:30' }));
    fillBookingForm();
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
});
