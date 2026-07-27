'use client';

import { AlertCircle, CheckCircle2, KeyRound, Mail } from 'lucide-react';
import { useActionState } from 'react';
import Link from 'next/link';
import { requestPasswordReset, type ResetRequestState } from '../actions/reset';
import { Button } from '../../../components/ui/button';
import { Input, Label } from '../../../components/ui/field';

const initialState: ResetRequestState = { error: null };

/**
 * ฟอร์มขอรีเซ็ตรหัสผ่าน — กรอกอีเมลแล้วส่งลิงก์ไปให้
 * § anti-enumeration: ไม่ว่าอีเมลจะมีในระบบหรือไม่ UI จะแสดงข้อความสำเร็จเดียวกัน
 * จึงไม่สลับเป็น state อื่นที่แยกแยะได้ — แสดงข้อความเดียวเสมอหลัง submit
 */
export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState);

  if (state.success) {
    return (
      <div
        role="status"
        className="mt-6 flex items-start gap-2 rounded-md border border-success-ink/30 bg-success-soft px-4 py-3 text-sm font-semibold text-success-ink"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
        <span>
          หากอีเมลนี้อยู่ในระบบ เราได้ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลของคุณแล้ว
          ลิงก์ใช้ได้ครั้งเดียวและหมดอายุภายใน 1 ชั่วโมง
        </span>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger-ink/30 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-ink"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
          {state.error}
        </p>
      )}
      <div>
        <Label htmlFor="email">อีเมล</Label>
        <Input
          id="email"
          name="email"
          type="email"
          icon={Mail}
          autoComplete="username"
          placeholder="officer@huangua.go.th"
          required
        />
      </div>
      <Button type="submit" size="lg" className="shadow-accent-glow mt-2 w-full" disabled={isPending}>
        <KeyRound className="h-5 w-5" aria-hidden="true" />
        {isPending ? 'กำลังส่งลิงก์...' : 'ส่งลิงก์รีเซ็ต'}
      </Button>
      <p className="text-center text-sm text-muted">
        นึกออกแล้ว?{' '}
        <Link href="/admin/login" className="font-semibold text-accent-strong hover:underline">
          กลับไปเข้าระบบ
        </Link>
      </p>
    </form>
  );
}
