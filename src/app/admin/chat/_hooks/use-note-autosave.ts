'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { patchConversation } from '../_lib/api';

export type NoteSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

/**
 * โน้ตลูกค้า autosave — debounce 800ms, last-write-wins
 * แสดงสถานะ "บันทึกแล้ว" ชั่วครู่หลังบันทึกสำเร็จ
 */
export function useNoteAutosave(conversationId: string | null, initialNote: string | null) {
  const [note, setNote] = useState(initialNote ?? '');
  const [saveState, setSaveState] = useState<NoteSaveState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialNote ?? '');
  const noteRef = useRef(note);
  const saveStateRef = useRef(saveState);

  // mirror state ล่าสุดไว้ใน ref — ต้องประกาศก่อน effect อื่นเพื่อให้อ่านค่าสดใน pass เดียวกัน
  useEffect(() => {
    noteRef.current = note;
    saveStateRef.current = saveState;
  }, [note, saveState]);

  // เปลี่ยนห้อง → reset เป็นโน้ตของห้องใหม่ ไม่ autosave ข้ามห้อง
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    /* eslint-disable react-hooks/set-state-in-effect -- sync โน้ตจาก prop เมื่อเปลี่ยนห้อง กัน autosave ข้ามห้อง */
    setNote(initialNote ?? '');
    lastSavedRef.current = initialNote ?? '';
    setSaveState('idle');
    /* eslint-enable react-hooks/set-state-in-effect */
    // reset เฉพาะตอนเปลี่ยนห้อง — initialNote เปลี่ยนกลางห้องให้ effect ถัดไปจัดการ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // ห้องเดิมแต่ค่าจาก server เปลี่ยน (refetch หลัง reconnect/transfer) —
  // รับค่าใหม่เฉพาะเมื่อไม่มี draft ค้าง กันทับข้อความที่กำลังพิมพ์
  useEffect(() => {
    const server = initialNote ?? '';
    const clean =
      noteRef.current === lastSavedRef.current &&
      saveStateRef.current !== 'dirty' &&
      saveStateRef.current !== 'saving';
    if (clean && server !== noteRef.current) {
      setNote(server);
      lastSavedRef.current = server;
      setSaveState('idle');
    }
  }, [initialNote]);

  const save = useCallback(
    async (id: string, value: string) => {
      setSaveState('saving');
      const result = await patchConversation(id, { adminNote: value === '' ? null : value });
      if (result.ok) {
        lastSavedRef.current = value;
        setSaveState('saved');
      } else {
        setSaveState('error');
      }
    },
    [],
  );

  const onChange = useCallback(
    (value: string) => {
      setNote(value);
      if (!conversationId) return;
      setSaveState('dirty');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (value !== lastSavedRef.current) void save(conversationId, value);
        else setSaveState('idle');
      }, 800);
    },
    [conversationId, save],
  );

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { note, onChange, saveState };
}
