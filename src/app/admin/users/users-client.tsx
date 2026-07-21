'use client';

import { useActionState, useState } from 'react';
import {
  UserPlus,
  KeyRound,
  Power,
  Pencil,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/field';
import { FieldError } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RoleBadge } from '@/components/admin/role-badge';
import {
  createUser,
  toggleUserActive,
  updateUserRole,
  resetPassword,
  type UserActionState,
} from '@/app/admin/actions/users';
import type { userRoleEnum } from '@/lib/db/schema';

type UserRole = (typeof userRoleEnum.enumValues)[number];

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
  createdAt: Date;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface UsersClientProps {
  users: UserRow[];
  departments: DepartmentOption[];
  canResetPassword: boolean;
  currentUserId: string;
}

const initial: UserActionState = { error: null };

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'officer', label: 'เจ้าหน้าที่' },
  { value: 'chief', label: 'หัวหน้างาน' },
  { value: 'head', label: 'หัวหน้ากอง' },
  { value: 'superadmin', label: 'ผู้ดูแลระบบ' },
];

export function UsersClient({
  users,
  departments,
  canResetPassword,
  currentUserId,
}: UsersClientProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          ทั้งหมด {users.length.toLocaleString('th-TH')} บัญชี
        </p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button type="button" size="sm">
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              เพิ่มผู้ใช้
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มผู้ใช้ใหม่</DialogTitle>
              <DialogDescription>
                สร้างบัญชีเจ้าหน้าที่ใหม่ — ผู้ใช้จะเข้าสู่ระบบด้วยอีเมลและรหัสผ่านนี้
              </DialogDescription>
            </DialogHeader>
            <CreateUserForm
              departments={departments}
              onSuccess={() => setCreateOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
        <div className="hidden border-b border-border px-4 py-3 text-xs font-semibold text-muted sm:grid sm:grid-cols-[2fr_1.5fr_1fr_1fr_auto] sm:gap-4">
          <span>ชื่อ · อีเมล</span>
          <span>บทบาท</span>
          <span>หน่วยงาน</span>
          <span>สถานะ</span>
          <span>จัดการ</span>
        </div>
        <ul>
          {users.map((u) => (
            <li
              key={u.id}
              className="border-b border-border px-4 py-4 last:border-0 hover:bg-surface-sunken/50 sm:grid sm:grid-cols-[2fr_1.5fr_1fr_1fr_auto] sm:items-center sm:gap-4"
            >
              {/* Name + email */}
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{u.fullName}</p>
                <p className="mt-0.5 truncate text-sm text-muted">{u.email}</p>
                <p className="mt-1 text-xs text-muted sm:hidden">
                  {u.departmentName ?? '—'} · {u.isActive ? 'ใช้งาน' : 'ระงับ'}
                </p>
              </div>

              {/* Role */}
              <div className="mt-2 sm:mt-0">
                <RoleBadge role={u.role} />
              </div>

              {/* Department */}
              <span className="mt-1 hidden text-sm text-muted sm:mt-0 sm:block">
                {u.departmentName ?? '—'}
              </span>

              {/* Status */}
              <div className="mt-2 sm:mt-0">
                <span
                  className={
                    u.isActive
                      ? 'inline-flex items-center gap-1.5 text-sm font-semibold text-success'
                      : 'inline-flex items-center gap-1.5 text-sm font-semibold text-danger'
                  }
                >
                  <span
                    className={
                      u.isActive
                        ? 'h-2 w-2 rounded-full bg-success'
                        : 'h-2 w-2 rounded-full bg-danger'
                    }
                    aria-hidden="true"
                  />
                  {u.isActive ? 'ใช้งาน' : 'ระงับ'}
                </span>
              </div>

              {/* Actions */}
              <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">
                {/* Toggle active */}
                <form action={toggleUserAction}>
                  <input type="hidden" name="userId" value={u.id} />
                  <input type="hidden" name="isSelf" value={String(u.id === currentUserId)} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    disabled={u.id === currentUserId}
                    aria-label={u.isActive ? 'ระงับบัญชี' : 'เปิดใช้งานบัญชี'}
                  >
                    <Power className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">
                      {u.isActive ? 'ระงับ' : 'เปิดใช้'}
                    </span>
                  </Button>
                </form>

                {/* Edit role/dept */}
                <Dialog
                  open={editOpen === u.id}
                  onOpenChange={(open) => setEditOpen(open ? u.id : null)}
                >
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={u.id === currentUserId}
                      aria-label="แก้ไขบทบาท"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span className="hidden sm:inline">แก้ไข</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>แก้ไขบทบาท: {u.fullName}</DialogTitle>
                      <DialogDescription>
                        เปลี่ยนบทบาทและหน่วยงานของผู้ใช้ — มีผลทันที
                      </DialogDescription>
                    </DialogHeader>
                    <EditRoleForm
                      user={u}
                      departments={departments}
                      onSuccess={() => setEditOpen(null)}
                    />
                  </DialogContent>
                </Dialog>

                {/* Reset password (superadmin only) */}
                {canResetPassword && u.id !== currentUserId && (
                  <Dialog
                    open={resetOpen === u.id}
                    onOpenChange={(open) => setResetOpen(open ? u.id : null)}
                  >
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="รีเซ็ตรหัสผ่าน"
                      >
                        <KeyRound className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">รีเซ็ตรหัสผ่าน</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>รีเซ็ตรหัสผ่าน: {u.fullName}</DialogTitle>
                        <DialogDescription>
                          ตั้งรหัสผ่านใหม่ให้ผู้ใช้ — รหัสผ่านเดิมจะใช้ไม่ได้ทันที
                        </DialogDescription>
                      </DialogHeader>
                      <ResetPasswordForm
                        userId={u.id}
                        onSuccess={() => setResetOpen(null)}
                      />
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Forms (inside dialogs)
// ────────────────────────────────────────────────────────────────────────────

function CreateUserForm({
  departments,
  onSuccess,
}: {
  departments: DepartmentOption[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(createUser, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="cu-fullName">ชื่อ-นามสกุล</Label>
        <Input id="cu-fullName" name="fullName" required autoComplete="name" placeholder="เช่น นายสมชาย ใจดี" />
      </div>
      <div>
        <Label htmlFor="cu-email">อีเมล</Label>
        <Input
          id="cu-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="officer@huangua.go.th"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cu-role">บทบาท</Label>
          <Select name="role" defaultValue="officer">
            <SelectTrigger id="cu-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="cu-department">หน่วยงาน</Label>
          <Select name="departmentId" defaultValue="__none__">
            <SelectTrigger id="cu-department">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">(ไม่ระบุ)</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="cu-password">รหัสผ่านชั่วคราว</Label>
        <Input
          id="cu-password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="อย่างน้อย 8 ตัวอักษร"
        />
        <p className="mt-1.5 text-xs text-muted">
          ผู้ใช้จะเข้าสู่ระบบด้วยรหัสผ่านนี้ — แนะนำให้แจ้งผ่านช่องทางปลอดภัย
        </p>
      </div>
      {state.error && <FormError>{state.error}</FormError>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              กำลังสร้าง...
            </>
          ) : (
            'สร้างบัญชี'
          )}
        </Button>
      </div>
    </form>
  );
}

function EditRoleForm({
  user,
  departments,
  onSuccess,
}: {
  user: UserRow;
  departments: DepartmentOption[];
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(updateUserRole, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="userId" value={user.id} />
      <div>
        <Label htmlFor="er-role">บทบาท</Label>
        <Select name="role" defaultValue={user.role}>
          <SelectTrigger id="er-role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="er-department">หน่วยงาน</Label>
        <Select name="departmentId" defaultValue={user.departmentId ?? '__none__'}>
          <SelectTrigger id="er-department">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">(ไม่ระบุ)</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {state.error && <FormError>{state.error}</FormError>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              กำลังบันทึก...
            </>
          ) : (
            'บันทึก'
          )}
        </Button>
      </div>
    </form>
  );
}

function ResetPasswordForm({
  userId,
  onSuccess,
}: {
  userId: string;
  onSuccess: () => void;
}) {
  const [state, action, pending] = useActionState(resetPassword, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />
      <div>
        <Label htmlFor="rp-newPassword">รหัสผ่านใหม่</Label>
        <Input
          id="rp-newPassword"
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="อย่างน้อย 8 ตัวอักษร"
        />
      </div>
      {state.error && <FormError>{state.error}</FormError>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              กำลังรีเซ็ต...
            </>
          ) : (
            'รีเซ็ตรหัสผ่าน'
          )}
        </Button>
      </div>
    </form>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * toggleUserActive ถูกเรียกแบบ inline (ไม่ใช่ dialog) — ใช้ wrapper เพื่อให้ signature
 * ตรงกับ form action expectation (void return) — redirect ใน action จะ trigger อัตโนมัติ
 */
async function toggleUserAction(formData: FormData): Promise<void> {
  await toggleUserActive({ error: null }, formData);
}

function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm font-semibold text-danger"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
      {children}
    </p>
  );
}

/** success toast สำหรับ users page */
export function UserSuccessToast({ ok }: { ok: string | null }) {
  if (!ok) return null;
  const messages: Record<string, string> = {
    created: 'สร้างบัญชีเรียบร้อย',
    toggled: 'อัปเดตสถานะเรียบร้อย',
    role: 'อัปเดตบทบาทเรียบร้อย',
    password: 'รีเซ็ตรหัสผ่านเรียบร้อย',
  };
  const msg = messages[ok] ?? 'บันทึกเรียบร้อย';
  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-2 rounded-md border border-success bg-success-soft px-4 py-3 text-sm font-semibold text-success"
    >
      <CheckCircle2 className="h-4 w-4 flex-none" aria-hidden="true" />
      {msg}
    </div>
  );
}
