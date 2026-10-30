'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  /** คำสั่งทำลาย/ย้อนไม่ได้ → ปุ่มยืนยันสี destructive */
  danger?: boolean;
}

/**
 * มาตรฐานการยืนยันของหน้าแอดมิน (FORM-06) — แทน `window.confirm()` ที่ดูไม่เข้ากับระบบ
 * ใช้ธีม/โทเค็นเดียวกัน อ่านออกเสียงได้ (Radix จัด focus trap + role=dialog) และทดสอบได้
 *
 *   const { confirm, dialog } = useConfirm();
 *   if (!(await confirm({ title: 'ลบไฟล์', description: '...', danger: true }))) return;
 *   ...
 *   return <>{...}{dialog}</>;
 *
 * § resolve เป็น true ตอนกดยืนยัน, false ตอนยกเลิก/Escape/คลิกนอกกล่อง — ผู้เรียกไม่ต้องแยกกรณี
 * ส่วนสถานะ "กำลังดำเนินการ" หลังยืนยัน ให้ผู้เรียกแสดงเองที่ปุ่ม/แถวที่เกี่ยวข้อง
 * (กล่องปิดทันทีเมื่อยืนยัน ต่างจาก ConfirmDialog ที่ผู้เรียกคุม `busy` เอง)
 */
export function useConfirm(): { confirm: (options: ConfirmOptions) => Promise<boolean>; dialog: ReactNode } {
  const [open, setOpen] = useState(false);
  // § เก็บ options ไว้แม้ปิดแล้ว — ไม่งั้นข้อความในกล่องว่างเปล่าระหว่างแอนิเมชันปิด
  const [options, setOptions] = useState<ConfirmOptions>({ title: '', description: '' });
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    // เรียกซ้อนขณะกล่องเก่ายังเปิด → ถือว่ากล่องเก่าถูกยกเลิก ไม่ปล่อย promise ค้าง
    resolverRef.current?.(false);
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  // component ถูกถอดออกขณะกล่องเปิด → ปล่อย promise ที่ค้างเป็น false (กัน handler ค้างตลอดไป)
  useEffect(
    () => () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    },
    [],
  );

  const dialog = (
    <ConfirmDialog
      open={open}
      onClose={() => settle(false)}
      onConfirm={() => settle(true)}
      title={options.title}
      description={options.description}
      confirmText={options.confirmText}
      danger={options.danger}
    />
  );

  return { confirm, dialog };
}
