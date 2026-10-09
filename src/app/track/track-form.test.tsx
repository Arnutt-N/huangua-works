// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRACK_DRAFT_KEY, saveTrackDraft } from '../../components/forms/non-pii-draft';
import { TrackForm } from './track-form';

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

  it.each(['นายทดสอบ', '0812345678', '1234567890123'])('ไม่บันทึก PII ที่เผลอกรอกในช่องค้นหา: %s', async (value) => {
    saveTrackDraft('HG483729156');
    render(<TrackForm />);
    const input = screen.getByLabelText('เลขติดตามเรื่อง');
    await waitFor(() => expect(input).toHaveValue('HG483729156'));
    fireEvent.change(input, { target: { value } });
    await waitFor(() => expect(window.localStorage.getItem(TRACK_DRAFT_KEY)).toBeNull());
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
});
