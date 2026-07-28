'use client';

import { AlertCircle, Eye, EyeOff, Loader2, Lock, LogIn, Mail } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login, type LoginState } from '../actions';
import { Button } from '../../../components/ui/button';
import { Input, Label } from '../../../components/ui/field';

const initialState: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // § navigate ฝั่ง client หลัง response ของ server action (พร้อม Set-Cookie) ถึง browser
    // แล้วเท่านั้น — ไม่ redirect() ใน server action เดียวกับที่ signIn() ตั้ง cookie (ดู actions.ts)
    // § ไม่เรียก router.refresh() — refresh จะ re-render หน้า login ปัจจุบันทันที ทำให้
    // input (uncontrolled) ว่างวูบก่อน navigation commit = อาการ "หน้ากระพริบ" ที่ผู้ใช้รายงาน
    // router.push('/admin') ไป render หน้า admin ใหม่ทั้งหน้าอยู่แล้ว ไม่ต้อง refresh หน้าเดิม
    if (state.success) {
      router.push('/admin');
    }
  }, [state.success, router]);

  // § React 19 reset form อัตโนมัติหลัง action จบ (input uncontrolled ว่างหมด) — ถ้าค้างฟอร์มไว้
  // ผู้ใช้จะเห็นช่องกรอกว่างเปล่า + อาการหน่วงระหว่างรอ router.push('/admin') render หน้า admin
  // จึงเปลี่ยนทั้งฟอร์มเป็น panel "กำลังเปลี่ยนทาง" ทันทีที่ success (state นี้รอดผ่าน re-render)
  if (state.success) {
    return (
      <div role="status" className="mt-6 flex flex-col items-center gap-2 py-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-strong" aria-hidden="true" />
        <p className="mt-1 font-semibold text-ink">เข้าระบบสำเร็จ</p>
        <p className="text-sm text-muted">กำลังพาไปยังหน้าจัดการ…</p>
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
      <div>
        <Label htmlFor="password">รหัสผ่าน</Label>
        {/* § ปุ่มปิด/เปิดรหัสผ่าน — touch target 48×44px (C6 ≥44px), type="button" กัน submit,
            aria-label เปลี่ยนตาม state (ไม่ใช้ aria-pressed ซ้ำ — screen reader ประกาศซ้ำซ้อน)
            § ตั้งชื่อ "แสดงรหัส/ซ่อนรหัส" ไม่ใช่ "แสดงรหัสผ่าน" — e2e ใช้ getByLabel('รหัสผ่าน')
            ซึ่ง match ทุก element ที่ชื่อมี substring นั้น ปุ่มจะกลายเป็น match ที่ 2 → strict mode พัง
            pr-14 ที่ input กันข้อความมุดใต้ปุ่ม */}
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            icon={Lock}
            autoComplete="current-password"
            placeholder="รหัสผ่าน"
            className="pr-14"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'ซ่อนรหัส' : 'แสดงรหัส'}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-muted transition-colors duration-normal ease-out-expo hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong motion-reduce:transition-none"
          >
            {showPassword ? (
              <EyeOff className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Eye className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* § แถว "จดจำฉัน" + "ลืมรหัสผ่าน?" — checkbox เป็น uncontrolled (ส่งผ่าน FormData)
          name="remember" → 'on' เมื่อติ๊ก; actions.ts ส่งต่อให้ jwt callback ตั้งอายุ session
          (1h ไม่ติ๊ก / 30d ติ๊ก) */}
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-h-touch cursor-pointer select-none items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            name="remember"
            aria-label="จดจำฉัน"
            className="h-5 w-5 flex-none rounded border-border-strong accent-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          />
          จดจำฉัน
        </label>
        <Link
          href="/admin/forgot-password"
          className="inline-flex min-h-touch items-center text-sm font-semibold text-accent-strong hover:underline"
        >
          ลืมรหัสผ่าน?
        </Link>
      </div>

      <Button
        type="submit"
        size="lg"
        className="shadow-accent-glow mt-2 w-full"
        disabled={isPending}
      >
        <LogIn className="h-5 w-5" aria-hidden="true" />
        {isPending ? 'กำลังเข้าระบบ...' : 'เข้าระบบ'}
      </Button>

      <p className="text-center text-sm text-muted">ยังไม่มีบัญชี? ติดต่อผู้ดูแลระบบ</p>
    </form>
  );
}
