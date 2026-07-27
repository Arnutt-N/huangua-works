'use client';

import { AlertCircle, CheckCircle2, Lock, ShieldCheck } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { completePasswordReset, type ResetCompleteState } from '../actions/reset';
import { Button } from '../../../components/ui/button';
import { Input, Label, FieldHint } from '../../../components/ui/field';

const initialState: ResetCompleteState = { error: null };

/**
 * ฟอร์มตั้งรหัสผ่านใหม่ — รับ token จากลิงก์ในอีเมล (hidden field)
 * สำเร็จแล้วพาไปหน้า login เพื่อให้เข้าระบบด้วยรหัสผ่านใหม่
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(completePasswordReset, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.push('/admin/login?reset=ok');
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

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
        <Label htmlFor="newPassword">รหัสผ่านใหม่</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          placeholder="รหัสผ่านใหม่"
          required
        />
        <FieldHint>อย่างน้อย 8 ตัวอักษร</FieldHint>
      </div>

      <div>
        <Label htmlFor="confirmPassword">ยืนยันรหัสผ่านใหม่</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          icon={ShieldCheck}
          autoComplete="new-password"
          placeholder="พิมพ์รหัสผ่านอีกครั้ง"
          required
        />
      </div>

      <Button type="submit" size="lg" className="shadow-accent-glow mt-2 w-full" disabled={isPending}>
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        {isPending ? 'กำลังบันทึก...' : 'ตั้งรหัสผ่านใหม่'}
      </Button>

      <p className="text-center text-sm text-muted">
        <Link href="/admin/login" className="font-semibold text-accent-strong hover:underline">
          กลับไปเข้าระบบ
        </Link>
      </p>
    </form>
  );
}
