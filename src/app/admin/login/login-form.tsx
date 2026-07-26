'use client';

import { AlertCircle, LogIn } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, type LoginState } from '../actions';
import { Button } from '../../../components/ui/button';
import { Input, Label } from '../../../components/ui/field';

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);
  const router = useRouter();

  useEffect(() => {
    // § navigate ฝั่ง client หลัง response ของ server action (พร้อม Set-Cookie) ถึง browser
    // แล้วเท่านั้น — ไม่ redirect() ใน server action เดียวกับที่ signIn() ตั้ง cookie (ดู actions.ts)
    if (state.success) {
      router.push('/admin');
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      {state.error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger bg-danger-soft px-4 py-3 text-sm font-semibold text-danger"
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
          autoComplete="username"
          placeholder="officer@huangua.go.th"
          required
        />
      </div>
      <div>
        <Label htmlFor="password">รหัสผ่าน</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="รหัสผ่าน"
          required
        />
      </div>
      <Button type="submit" size="lg" className="mt-2" disabled={isPending}>
        <LogIn className="h-5 w-5" aria-hidden="true" />
        {isPending ? 'กำลังเข้าระบบ...' : 'เข้าระบบ'}
      </Button>
    </form>
  );
}
