import { beforeEach, describe, expect, it } from 'vitest';
import {
  _resetMemoryStore,
  deleteFieldDraft,
  listFieldDrafts,
  markFieldDraftSynced,
  saveFieldDraft,
} from './field-offline-store';

describe('field-offline-store', () => {
  beforeEach(() => {
    _resetMemoryStore();
  });

  it('บันทึกแบบร่างภาพถ่ายหรือข้อความภาคสนามได้สำเร็จ', async () => {
    const saved = await saveFieldDraft({
      kind: 'resolution_photo',
      caseId: 'case-001',
      title: 'ภาพเสาไฟชำรุดก่อนซ่อม',
      content: 'data:image/jpeg;base64,mockdata123',
      tag: 'before',
    });

    expect(saved.id).toBeTruthy();
    expect(saved.synced).toBe(false);
    expect(saved.syncedAt).toBeNull();
    expect(saved.createdAt).toBeTruthy();
    expect(saved.title).toBe('ภาพเสาไฟชำรุดก่อนซ่อม');
  });

  it('ดึงรายการแบบร่างเรียงลำดับจากใหม่ไปเก่า', async () => {
    await saveFieldDraft({
      kind: 'field_note',
      title: 'โน้ตที่ 1',
      content: 'ข้อความแรก',
      tag: 'general',
      createdAt: '2026-11-03T01:00:00.000Z',
    });

    await saveFieldDraft({
      kind: 'field_note',
      title: 'โน้ตที่ 2',
      content: 'ข้อความที่สอง',
      tag: 'general',
      createdAt: '2026-11-03T02:00:00.000Z',
    });

    const list = await listFieldDrafts();
    expect(list.length).toBe(2);
    expect(list[0]?.title).toBe('โน้ตที่ 2');
    expect(list[1]?.title).toBe('โน้ตที่ 1');
  });

  it('ทำเครื่องหมายว่าซิงค์แล้วได้สำเร็จ', async () => {
    const draft = await saveFieldDraft({
      kind: 'resolution_photo',
      title: 'ภาพหลังซ่อมเสร็จ',
      content: 'data:image/jpeg;base64,afterdata',
      tag: 'after',
    });

    const marked = await markFieldDraftSynced(draft.id);
    expect(marked).toBe(true);

    const list = await listFieldDrafts();
    const updated = list.find((d) => d.id === draft.id);
    expect(updated?.synced).toBe(true);
    expect(updated?.syncedAt).toBeTruthy();
  });

  it('คืน false เมื่อทำเครื่องหมายซิงค์กับ id ที่ไม่มีอยู่', async () => {
    const marked = await markFieldDraftSynced('non-existent-id');
    expect(marked).toBe(false);
  });

  it('ลบแบบร่างภาคสนามได้สำเร็จ', async () => {
    const draft = await saveFieldDraft({
      kind: 'field_note',
      title: 'โน้ตทดสอบการลบ',
      content: 'จะถูกลบ',
      tag: 'general',
    });

    const deleted = await deleteFieldDraft(draft.id);
    expect(deleted).toBe(true);

    const list = await listFieldDrafts();
    expect(list.find((d) => d.id === draft.id)).toBeUndefined();
  });
});
