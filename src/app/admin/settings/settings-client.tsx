'use client';

import { useActionState } from 'react';
import { AlertCircle, CheckCircle2, KeyRound, Loader2, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldHint, Input, Label } from '@/components/ui/field';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import {
  changeOwnPassword,
  updateProfile,
  type ProfileActionState,
} from '@/app/admin/actions/profile';

const initial: ProfileActionState = { error: null };

export function ProfileForm({
  fullName,
  phoneNumber,
  email,
  roleLabel,
  departmentName,
}: {
  fullName: string;
  phoneNumber: string | null;
  email: string;
  roleLabel: string;
  departmentName: string | null;
}) {
  const [state, action, pending] = useActionState(updateProfile, initial);

  return (
    <AdminCard>
      <AdminCardTitle icon={<UserCog className="h-4 w-4" />}>ข้อมูลส่วนตัว</AdminCardTitle>

      {/* ข้อมูลที่แก้เองไม่ได้ — แสดงเป็นรายการอ่านอย่างเดียว ไม่ทำเป็น input ที่กดไม่ได้
          เพราะ input disabled ชวนให้เข้าใจผิดว่าแก้ได้แต่ตอนนี้ล็อกอยู่ */}
      <dl className="mb-5 grid gap-3 rounded-lg bg-surface-sunken/60 px-4 py-3 sm:grid-cols-3">
        <ReadOnly label="อีเมล (ใช้เข้าระบบ)" value={email} />
        <ReadOnly label="บทบาท" value={roleLabel} />
        <ReadOnly label="หน่วยงาน" value={departmentName ?? '—'} />
      </dl>
      <p className="mb-5 text-xs text-muted">
        อีเมล บทบาท และหน่วยงาน แก้ไขได้โดยหัวหน้ากองหรือผู้ดูแลระบบเท่านั้น
      </p>

      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="pf-fullName">ชื่อ-นามสกุล</Label>
          <Input
            id="pf-fullName"
            name="fullName"
            defaultValue={fullName}
            required
            autoComplete="name"
            maxLength={200}
          />
        </div>
        <div>
          <Label htmlFor="pf-phone">เบอร์โทรศัพท์</Label>
          <Input
            id="pf-phone"
            name="phoneNumber"
            type="tel"
            inputMode="numeric"
            defaultValue={phoneNumber ?? ''}
            autoComplete="tel"
            placeholder="0812345678"
          />
          <FieldHint>เว้นว่างได้ — ใช้สำหรับติดต่อภายในเท่านั้น</FieldHint>
        </div>

        {state.error && <FormAlert kind="error">{state.error}</FormAlert>}
        {state.success && <FormAlert kind="success">{state.success}</FormAlert>}

        <div className="flex justify-end pt-1">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                กำลังบันทึก...
              </>
            ) : (
              'บันทึกข้อมูล'
            )}
          </Button>
        </div>
      </form>
    </AdminCard>
  );
}

export function PasswordForm() {
  const [state, action, pending] = useActionState(changeOwnPassword, initial);

  return (
    <AdminCard>
      <AdminCardTitle icon={<KeyRound className="h-4 w-4" />}>
        เปลี่ยนรหัสผ่าน
      </AdminCardTitle>

      {/* key={state.success} บังคับให้ React สร้าง form ใหม่หลังเปลี่ยนสำเร็จ
          → ช่องรหัสผ่านถูกล้าง ไม่ค้างค่าไว้บนหน้าจอ */}
      <form key={state.success ?? 'form'} action={action} className="space-y-4">
        <div>
          <Label htmlFor="cp-current">รหัสผ่านปัจจุบัน</Label>
          <Input
            id="cp-current"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="cp-new">รหัสผ่านใหม่</Label>
            <Input
              id="cp-new"
              name="newPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
            <FieldHint>อย่างน้อย 8 ตัวอักษร</FieldHint>
          </div>
          <div>
            <Label htmlFor="cp-confirm">ยืนยันรหัสผ่านใหม่</Label>
            <Input
              id="cp-confirm"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
        </div>

        {state.error && <FormAlert kind="error">{state.error}</FormAlert>}
        {state.success && <FormAlert kind="success">{state.success}</FormAlert>}

        <div className="flex justify-end pt-1">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                กำลังเปลี่ยน...
              </>
            ) : (
              'เปลี่ยนรหัสผ่าน'
            )}
          </Button>
        </div>
      </form>
    </AdminCard>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-ink" title={value}>
        {value}
      </dd>
    </div>
  );
}

function FormAlert({
  kind,
  children,
}: {
  kind: 'error' | 'success';
  children: React.ReactNode;
}) {
  const isError = kind === 'error';
  return (
    <p
      role={isError ? 'alert' : 'status'}
      className={
        isError
          ? 'flex items-start gap-2 rounded-md border border-danger-ink/30 bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-ink'
          : 'flex items-start gap-2 rounded-md border border-success-ink/30 bg-success-soft px-3 py-2 text-sm font-semibold text-success-ink'
      }
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
      )}
      {children}
    </p>
  );
}
