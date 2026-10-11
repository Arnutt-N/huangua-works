'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Power,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldHint, Input, Label } from '@/components/ui/field';
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
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { EmptyState } from '@/components/admin/empty-state';
import {
  addResponsible,
  deleteResponsible,
  toggleResponsibleActive,
  updateResponsible,
  type ResponsibleActionState,
} from '@/app/admin/actions/responsible';
import { cn } from '@/lib/cn';

export interface ResponsibleRow {
  raw: string;
  departmentId: string | null;
  departmentName: string | null;
  assignedTo: string | null;
  assigneeName: string | null;
  decidedBy: string;
  decidedAt: Date;
  isActive: boolean;
  isSeed: boolean;
  referencedCount: number;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface OfficerOption {
  id: string;
  fullName: string;
}

const initial: ResponsibleActionState = { error: null };

export function ResponsibleClient({
  rows,
  departments,
  officers,
}: {
  rows: ResponsibleRow[];
  departments: DepartmentOption[];
  officers: OfficerOption[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <AdminCard>
      <AdminCardTitle
        icon={<ListChecks className="h-4 w-4" />}
        action={
          <Dialog open={openId === '__new__'} onOpenChange={(o) => setOpenId(o ? '__new__' : null)}>
            <DialogTrigger asChild>
              <Button type="button" size="sm">
                <Plus className="h-4 w-4" aria-hidden="true" />
                เพิ่ม
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>เพิ่ม mapping</DialogTitle>
                <DialogDescription>
                  ผูกค่าดิบจากทะเบียนกับหน่วยงานและเจ้าหน้าที่ — หน่วยงานบังคับเสมอ
                </DialogDescription>
              </DialogHeader>
              <ResponsibleForm departments={departments} officers={officers} onDone={() => setOpenId(null)} />
            </DialogContent>
          </Dialog>
        }
      >
        Mapping ({rows.length.toLocaleString('th-TH')})
      </AdminCardTitle>

      {rows.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="ยังไม่มี mapping"
          description="เพิ่ม mapping เพื่อตัดสินค่าดิบจากทะเบียน Excel"
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.raw} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate font-semibold',
                    r.isActive ? 'text-ink' : 'text-muted line-through',
                  )}
                >
                  {r.raw}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {r.departmentName ?? 'ยังไม่ระบุหน่วยงาน'} · {r.assigneeName ?? 'ไม่ระบุเจ้าหน้าที่'} ·{' '}
                  อ้างถึง {r.referencedCount.toLocaleString('th-TH')} เรื่อง
                </p>
              </div>
              <div className="flex flex-none items-center gap-1.5">
                {(!r.departmentId) && <PendingBadge />}
                <ActiveBadge isActive={r.isActive} />
              </div>
              <div className="flex flex-none items-center gap-1">
                <Dialog open={openId === r.raw} onOpenChange={(o) => setOpenId(o ? r.raw : null)}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" aria-label={`แก้ไข mapping ${r.raw}`}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>แก้ไข mapping</DialogTitle>
                      <DialogDescription>{r.raw}</DialogDescription>
                    </DialogHeader>
                    <ResponsibleForm
                      row={r}
                      departments={departments}
                      officers={officers}
                      onDone={() => setOpenId(null)}
                    />
                  </DialogContent>
                </Dialog>
                <form action={toggleResponsibleAction}>
                  <input type="hidden" name="raw" value={r.raw} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={`${r.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} mapping ${r.raw}`}
                    title={r.isActive ? 'ปิดใช้งาน (แถวที่อ้างถึงค้าง blocked)' : 'เปิดใช้งาน'}
                  >
                    <Power className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </form>
                <DeleteDialog row={r} open={openId === `del-${r.raw}`} onOpenChange={(o) => setOpenId(o ? `del-${r.raw}` : null)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}

function ResponsibleForm({
  row,
  departments,
  officers,
  onDone,
}: {
  row?: ResponsibleRow;
  departments: DepartmentOption[];
  officers: OfficerOption[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(row ? updateResponsible : addResponsible, initial);

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={action} className="space-y-4">
      {row ? (
        <input type="hidden" name="raw" value={row.raw} />
      ) : (
        <div>
          <Label htmlFor="resp-raw-new">ค่าดิบจากทะเบียน</Label>
          <Input
            id="resp-raw-new"
            name="raw"
            required
            maxLength={200}
            placeholder="เช่น กองช่าง"
          />
          <FieldHint>ต้องตรงกับค่าในคอลัมน์ผู้รับผิดชอบทุกตัวอักษร (เว้นวรรคหัวท้ายได้)</FieldHint>
        </div>
      )}
      <div>
        <Label htmlFor={`resp-dept-${row?.raw ?? 'new'}`}>หน่วยงานที่รับผิดชอบ</Label>
        <Select name="departmentId" defaultValue={row?.departmentId ?? ''} required>
          <SelectTrigger id={`resp-dept-${row?.raw ?? 'new'}`}>
            <SelectValue placeholder="เลือกหน่วยงาน" />
          </SelectTrigger>
          <SelectContent>
            {departments.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor={`resp-officer-${row?.raw ?? 'new'}`}>เจ้าหน้าที่ผู้รับผิดชอบ</Label>
        <Select name="assignedTo" defaultValue={row?.assignedTo ?? '__none__'}>
          <SelectTrigger id={`resp-officer-${row?.raw ?? 'new'}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">(ไม่ระบุ)</SelectItem>
            {officers.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                {o.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <div className="flex justify-end pt-1">
        <Button type="submit" size="sm" disabled={pending}>
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

function DeleteDialog({ row, open, onOpenChange }: { row: ResponsibleRow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [state, action, pending] = useActionState(deleteResponsible, initial);

  useEffect(() => {
    if (state.success) onOpenChange(false);
  }, [state.success, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`ลบ mapping ${row.raw}`}
          className="text-danger-ink hover:text-danger-ink"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ลบ mapping</DialogTitle>
          <DialogDescription>
            {row.referencedCount > 0
              ? `ค่านี้ถูกเรื่องย้อนหลัง ${row.referencedCount} เรื่องอ้างถึง — ลบไม่ได้ ให้ปิดใช้งานแทน`
              : `ลบ mapping “${row.raw}” ถาวรหรือไม่ (ทำแล้วทำเลย)`}
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="raw" value={row.raw} />
          {state.error && <FormAlert>{state.error}</FormAlert>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" size="sm" variant="destructive" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  กำลังลบ...
                </>
              ) : (
                'ลบถาวร'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * toggle ถูกเรียกแบบ inline (ไม่ใช่ dialog) — wrapper ให้ signature ตรงกับ
 * form action expectation (void return) เหมือน toggleUserAction ใน users-client
 */
async function toggleResponsibleAction(formData: FormData): Promise<void> {
  await toggleResponsibleActive({ error: null }, formData);
}

function PendingBadge() {
  return (
    <span className="inline-flex flex-none items-center gap-1.5 rounded-pill bg-warning-soft px-3 py-0.5 text-xs font-semibold text-warning-ink ring-1 ring-inset ring-warning-ink/20">
      รอตัดสิน
    </span>
  );
}

function ActiveBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex flex-none items-center gap-1.5 rounded-pill px-3 py-0.5 text-xs font-semibold ring-1 ring-inset',
        isActive
          ? 'bg-success-soft text-success-ink ring-success-ink/20'
          : 'bg-surface-sunken text-muted ring-border-strong/30',
      )}
    >
      {isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
    </span>
  );
}

function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-md border border-danger-ink/30 bg-danger-soft px-3 py-2 text-sm font-semibold text-danger-ink"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-none" aria-hidden="true" />
      {children}
    </p>
  );
}
