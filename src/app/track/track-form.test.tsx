// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRACK_DRAFT_KEY, saveTrackDraft } from '../../components/forms/non-pii-draft';
import { TrackForm } from './track-form';

const mockCaseInProgress = {
  case: {
    id: 'c-1',
    trackingCode: 'HG483729156',
    createdAt: '2026-10-25T08:00:00.000Z',
    status: 'in_progress',
    title: 'ไฟกิ่งหน้าปากซอยดับ',
  },
  category: { id: 'cat-1', name: 'ไฟฟ้าสาธารณะ' },
  updates: [
    {
      id: 'u-1',
      createdAt: '2026-10-26T09:00:00.000Z',
      updateType: 'status_change',
      newValue: 'in_progress',
    },
  ],
};

const mockCaseDone = {
  case: {
    id: 'c-2',
    trackingCode: 'HG999999999',
    createdAt: '2026-10-25T08:00:00.000Z',
    status: 'done',
    title: 'ถนนชำรุดเป็นหลุมบ่อ',
  },
  category: { id: 'cat-2', name: 'ถนนและทางเท้า' },
  updates: [
    {
      id: 'u-2',
      createdAt: '2026-10-27T10:00:00.000Z',
      updateType: 'status_change',
      newValue: 'done',
    },
  ],
};

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false, json: async () => ({ error: 'ไม่พบเรื่อง กรุณาตรวจสอบเลขติดตาม' }),
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ฟอร์มติดตามเรื่องสำหรับผู้สูงอายุ', () => {
  it('เชื่อม hint และ error ที่ประกาศด้วย alert กับช่องกรอก', async () => {
    render(<TrackForm />);
    const input = screen.getByLabelText('เลขติดตามเรื่อง');
    expect(input).toHaveAttribute('aria-describedby', 'trackId-hint');
    await userEvent.setup().click(screen.getByRole('button', { name: 'ค้นหาเรื่อง' }));
    const alert = screen.getByRole('alert');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
    expect(alert).toHaveTextContent('กรุณากรอกเลขติดตามเรื่อง');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('คืน draft หลัง mount โดยไม่ค้นหาเอง และล้างได้โดยไม่เขียนกลับ', async () => {
    saveTrackDraft('HG483729156');
    render(<TrackForm />);
    await waitFor(() => expect(screen.getByLabelText('เลขติดตามเรื่อง')).toHaveValue('HG483729156'));
    expect(fetch).not.toHaveBeenCalled();
    await userEvent.setup().click(screen.getByRole('button', { name: 'ล้างดราฟต์' }));
    expect(screen.getByLabelText('เลขติดตามเรื่อง')).toHaveValue('');
    expect(window.localStorage.getItem(TRACK_DRAFT_KEY)).toBeNull();
  });

  it('บันทึกเลขที่กรอกอัตโนมัติ และกลับหน้าเดิมยังคืนค่าได้', async () => {
    const view = render(<TrackForm />);
    await userEvent.setup().type(screen.getByLabelText('เลขติดตามเรื่อง'), 'HG483729156');
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(TRACK_DRAFT_KEY)!)).toEqual({ version: 1, trackId: 'HG483729156' }));
    view.unmount();
    render(<TrackForm />);
    await waitFor(() => expect(screen.getByLabelText('เลขติดตามเรื่อง')).toHaveValue('HG483729156'));
  });

  it('เลขติดตามจาก URL ชนะ draft และ API error เชื่อมกับช่องกรอก', async () => {
    saveTrackDraft('HG483729156');
    render(<TrackForm initialId="HN000000001" />);
    const alert = await screen.findByRole('alert');
    expect(fetch).toHaveBeenCalledWith('/api/cases/HN000000001');
    expect(screen.getByLabelText('เลขติดตามเรื่อง')).toHaveValue('HN000000001');
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(TRACK_DRAFT_KEY)!)).toEqual({ version: 1, trackId: 'HN000000001' }));
    expect(screen.getByLabelText('เลขติดตามเรื่อง')).toHaveAttribute('aria-describedby', alert.id);
  });

  it.each(['นายทดสอบ', '0812345678', '1234567890123'])('PII ที่เผลอกรอกไม่ทับดราฟต์ดีที่เก็บไว้: %s', async (value) => {
    saveTrackDraft('HG483729156');
    render(<TrackForm />);
    const input = screen.getByLabelText('เลขติดตามเรื่อง');
    await waitFor(() => expect(input).toHaveValue('HG483729156'));
    fireEvent.change(input, { target: { value } });
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem(TRACK_DRAFT_KEY)!)).toEqual({ version: 1, trackId: 'HG483729156' }));
  });

  it('ยังตรวจฟอร์มได้เมื่อ localStorage ใช้ไม่ได้', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('ปิด storage'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('ปิด storage'); });
    render(<TrackForm />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'ค้นหาเรื่อง' }));
    expect(screen.getByRole('alert')).toHaveTextContent('กรุณากรอกเลขติดตามเรื่อง');
  });

  it('ไม่อ่าน storage ขณะ render ฝั่ง server', () => {
    const read = vi.spyOn(Storage.prototype, 'getItem');
    renderToString(<TrackForm />);
    expect(read).not.toHaveBeenCalled();
  });

  it('แปลงตัวอักษรเป็นพิมพ์ใหญ่อัตโนมัติเมื่อพิมพ์ในช่องค้นหา', async () => {
    render(<TrackForm />);
    const input = screen.getByLabelText('เลขติดตามเรื่อง');
    await userEvent.setup().type(input, 'hg483729156');
    expect(input).toHaveValue('HG483729156');
  });

  it('ปุ่มล้างดราฟต์ล้างทั้ง state, localStorage และ URL search params', async () => {
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    saveTrackDraft('HG483729156');
    render(<TrackForm />);
    await waitFor(() => expect(screen.getByLabelText('เลขติดตามเรื่อง')).toHaveValue('HG483729156'));

    const clearBtn = screen.getByRole('button', { name: 'ล้างดราฟต์' });
    await userEvent.setup().click(clearBtn);

    expect(screen.getByLabelText('เลขติดตามเรื่อง')).toHaveValue('');
    expect(window.localStorage.getItem(TRACK_DRAFT_KEY)).toBeNull();
    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/track');
  });

  it('แสดงหมวดหมู่เรื่องและคำนวณ Progress bar ได้ 75% สำหรับ in_progress', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCaseInProgress,
    }));

    render(<TrackForm initialId="HG483729156" />);

    await waitFor(() => {
      expect(screen.getByText('ไฟกิ่งหน้าปากซอยดับ')).toBeInTheDocument();
    });

    expect(screen.getByText('ไฟฟ้าสาธารณะ')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('ความคืบหน้าการดำเนินงาน')).toBeInTheDocument();
    expect(screen.getByText('เจ้าหน้าที่กำลังลงพื้นที่และดำเนินการแก้ไขปัญหา')).toBeInTheDocument();
  });

  it('ปุ่มคัดลอกเลขติดตามเรียก navigator.clipboard.writeText และแสดงสถานะคัดลอกแล้ว', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCaseInProgress,
    }));

    render(<TrackForm initialId="HG483729156" />);

    await waitFor(() => {
      expect(screen.getByText('ไฟกิ่งหน้าปากซอยดับ')).toBeInTheDocument();
    });

    const copyBtn = screen.getByRole('button', { name: /คัดลอก/ });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('HG483729156');
      expect(screen.getByText('คัดลอกแล้ว')).toBeInTheDocument();
    });
  });

  it('แสดงกล่องติดต่อ อบต.หัวงัว พร้อมเบอร์โทรศัพท์และเวลาทำการ', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCaseInProgress,
    }));

    render(<TrackForm initialId="HG483729156" />);

    await waitFor(() => {
      expect(screen.getByText('ไฟกิ่งหน้าปากซอยดับ')).toBeInTheDocument();
    });

    expect(screen.getByText('ต้องการความช่วยเหลือหรือสอบถามเพิ่มเติม?')).toBeInTheDocument();
    expect(screen.getByText('043-601-494')).toBeInTheDocument();
    const phoneLink = screen.getByRole('link', { name: /043-601-494/ });
    expect(phoneLink).toHaveAttribute('href', 'tel:043601494');
    expect(screen.getByText('จันทร์ - ศุกร์ 08:30 - 16:30 น.')).toBeInTheDocument();
  });

  it('แบบประเมินบริการ FeedbackCard ให้คะแนนดาว 1 ถึง 5 และส่ง feedback สำเร็จ', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.startsWith('/api/cases/')) {
        return {
          ok: true,
          json: async () => mockCaseDone,
        };
      }
      if (url === '/api/feedback') {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        };
      }
      return { ok: false, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<TrackForm initialId="HG999999999" />);

    await waitFor(() => {
      expect(screen.getByText('ถนนชำรุดเป็นหลุมบ่อ')).toBeInTheDocument();
    });

    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'ให้คะแนนการบริการ' })).toBeInTheDocument();

    const star5 = screen.getByRole('radio', { name: '5 ดาว' });
    await userEvent.setup().click(star5);

    expect(screen.getByText('5 ดาว — ดีมาก')).toBeInTheDocument();

    const commentInput = screen.getByLabelText('ข้อเสนอแนะ (ไม่บังคับ)');
    await userEvent.setup().type(commentInput, 'ซ่อมแซมได้รวดเร็วมากครับ');

    const submitBtn = screen.getByRole('button', { name: 'ส่งคะแนน' });
    await userEvent.setup().click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('ขอบคุณสำหรับคะแนนครับ')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/feedback',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          trackingCode: 'HG999999999',
          rating: 5,
          comment: 'ซ่อมแซมได้รวดเร็วมากครับ',
        }),
      }),
    );
  });

  it('แบบประเมินบริการ FeedbackCard แจ้งเตือนเมื่อกดส่งโดยยังไม่ได้เลือกดาว', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCaseDone,
    }));

    render(<TrackForm initialId="HG999999999" />);

    await waitFor(() => {
      expect(screen.getByText('ถนนชำรุดเป็นหลุมบ่อ')).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: 'ส่งคะแนน' });
    await userEvent.setup().click(submitBtn);

    expect(screen.getByRole('alert')).toHaveTextContent('กรุณาเลือกดาวก่อนส่ง');
  });

  it('แสดงภาพถ่ายผลการดำเนินงานของเจ้าหน้าที่ (Before & After) เมื่อมีรูปถ่าย และเปิดขยายรูปได้', async () => {
    const mockCaseWithPhotos = {
      case: {
        id: 'c-3',
        trackingCode: 'HG123456789',
        createdAt: '2026-10-25T08:00:00.000Z',
        status: 'done',
        title: 'ซ่อมท่อระบายน้ำอุดตัน',
      },
      category: { id: 'cat-3', name: 'การระบายน้ำ' },
      updates: [],
      resolutionPhotos: [
        {
          id: 'rp-1',
          url: 'https://storage.local/photo1.jpg',
          tag: 'before',
          caption: 'ท่อระบายน้ำมีเศษขยะอุดตัน',
          uploadedAt: '2026-10-25T09:00:00.000Z',
        },
        {
          id: 'rp-2',
          url: 'https://storage.local/photo2.jpg',
          tag: 'after',
          caption: 'ขุดลอกและทำความสะอาดเรียบร้อย',
          uploadedAt: '2026-10-26T14:00:00.000Z',
        },
      ],
    };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCaseWithPhotos,
    }));

    render(<TrackForm initialId="HG123456789" />);

    await waitFor(() => {
      expect(screen.getByText('ซ่อมท่อระบายน้ำอุดตัน')).toBeInTheDocument();
    });

    expect(screen.getByText('ภาพถ่ายผลการดำเนินงานของเจ้าหน้าที่ (Before & After)')).toBeInTheDocument();
    expect(screen.getByText('ก่อนดำเนินการ (Before)')).toBeInTheDocument();
    expect(screen.getByText('หลังดำเนินการ (After)')).toBeInTheDocument();
    expect(screen.getByText('ท่อระบายน้ำมีเศษขยะอุดตัน')).toBeInTheDocument();
    expect(screen.getByText('ขุดลอกและทำความสะอาดเรียบร้อย')).toBeInTheDocument();

    const zoomBeforeBtn = screen.getByRole('button', { name: /ดูภาพขยาย ท่อระบายน้ำมีเศษขยะอุดตัน/i });
    await userEvent.setup().click(zoomBeforeBtn);

    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'ภาพก่อนดำเนินการ (Before)' })).toBeInTheDocument();
    });
  });

  it('ไม่แสดงภาพถ่ายผลการดำเนินงานเมื่อไม่มีรูปถ่าย', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCaseDone,
    }));

    render(<TrackForm initialId="HG999999999" />);

    await waitFor(() => {
      expect(screen.getByText('ถนนชำรุดเป็นหลุมบ่อ')).toBeInTheDocument();
    });

    expect(screen.queryByText('ภาพถ่ายผลการดำเนินงานของเจ้าหน้าที่ (Before & After)')).not.toBeInTheDocument();
  });
});
