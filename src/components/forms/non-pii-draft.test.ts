// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  INTAKE_DRAFT_KEY, TRACK_DRAFT_KEY,
  clearIntakeDraft, clearTrackDraft,
  readIntakeDraft, readTrackDraft,
  saveIntakeDraft, saveTrackDraft,
} from './non-pii-draft';

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

const categoryIds = ['roads', 'water'];

describe('ดราฟต์ที่ไม่เก็บข้อมูลส่วนบุคคล', () => {
  it('เก็บและคืนเฉพาะหมวดเรื่องที่มีอยู่จริง', () => {
    saveIntakeDraft('roads', categoryIds);
    expect(JSON.parse(window.localStorage.getItem(INTAKE_DRAFT_KEY)!)).toEqual({ version: 1, categoryId: 'roads' });
    expect(readIntakeDraft(categoryIds)).toEqual({ categoryId: 'roads' });
  });

  it('ล้างหมวดที่ถูกถอดออกจากรายการ', () => {
    saveIntakeDraft('roads', categoryIds);
    expect(readIntakeDraft(['water'])).toBeNull();
    expect(window.localStorage.getItem(INTAKE_DRAFT_KEY)).toBeNull();
  });

  it.each(['นายทดสอบ', '0812345678', '1234567890123', ''])('ไม่เขียนข้อมูลที่ไม่ใช่หมวดเรื่อง: %s', (value) => {
    saveIntakeDraft(value, categoryIds);
    expect(window.localStorage.getItem(INTAKE_DRAFT_KEY)).toBeNull();
  });

  it('ทิ้ง payload ที่ปะปนชื่อ CID โทรศัพท์ และข้อความอิสระ', () => {
    window.localStorage.setItem(INTAKE_DRAFT_KEY, JSON.stringify({
      version: 1, categoryId: 'roads', fullName: 'นายทดสอบ',
      cid: '1234567890123', phone: '0812345678', detail: 'ข้อมูลส่วนบุคคล',
    }));
    expect(readIntakeDraft(categoryIds)).toBeNull();
    expect(window.localStorage.getItem(INTAKE_DRAFT_KEY)).toBeNull();
  });

  it.each(['{', 'null', '[]', '{"version":2,"categoryId":"roads"}'])('ทิ้ง JSON เสียหรือรุ่นไม่รองรับ: %s', (raw) => {
    window.localStorage.setItem(INTAKE_DRAFT_KEY, raw);
    expect(readIntakeDraft(categoryIds)).toBeNull();
    expect(window.localStorage.getItem(INTAKE_DRAFT_KEY)).toBeNull();
  });

  it.each(['HG483729156', 'hn 4837-2915 6'])('บันทึกเลขติดตามใหม่และเก่าแบบมาตรฐาน: %s', (input) => {
    saveTrackDraft(input);
    const trackId = input.replace(/[\s-]/g, '').toUpperCase();
    expect(JSON.parse(window.localStorage.getItem(TRACK_DRAFT_KEY)!)).toEqual({ version: 1, trackId });
    expect(readTrackDraft()).toEqual({ trackId });
  });

  it.each(['นายทดสอบ', '0812345678', '1234567890123', 'HG483729156 นายทดสอบ', 'HG48', ''])('ไม่บันทึก input ที่อาจมี PII หรือเลขติดตามไม่ครบ: %s', (input) => {
    saveTrackDraft('HG483729156');
    saveTrackDraft(input);
    expect(window.localStorage.getItem(TRACK_DRAFT_KEY)).toBeNull();
  });

  it('ไม่คืน payload เลขติดตามที่มีข้อมูลส่วนบุคคลเพิ่มมา', () => {
    window.localStorage.setItem(TRACK_DRAFT_KEY, JSON.stringify({ version: 1, trackId: 'HG483729156', fullName: 'นายทดสอบ' }));
    expect(readTrackDraft()).toBeNull();
    expect(window.localStorage.getItem(TRACK_DRAFT_KEY)).toBeNull();
  });

  it('ล้างดราฟต์ทั้งสองฟอร์ม', () => {
    saveIntakeDraft('roads', categoryIds);
    saveTrackDraft('HG483729156');
    clearIntakeDraft();
    clearTrackDraft();
    expect(window.localStorage.length).toBe(0);
  });

  it('ไม่โยน error เมื่อเบราว์เซอร์ปิด storage หรือพื้นที่เต็ม', () => {
    for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
      vi.spyOn(Storage.prototype, method).mockImplementation(() => { throw new Error('ปิดพื้นที่จัดเก็บ'); });
    }
    expect(() => {
      expect(readIntakeDraft(categoryIds)).toBeNull();
      expect(readTrackDraft()).toBeNull();
      saveIntakeDraft('roads', categoryIds);
      saveTrackDraft('HG483729156');
      clearIntakeDraft();
      clearTrackDraft();
    }).not.toThrow();
  });
});
