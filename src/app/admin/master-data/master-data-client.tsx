'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  AlertCircle,
  Building2,
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  Power,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldHint, Input, Label, Textarea } from '@/components/ui/field';
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
  saveCategory,
  saveDepartment,
  toggleActive,
  type MasterDataActionState,
} from '@/app/admin/actions/master-data';
import { cn } from '@/lib/cn';

const initial: MasterDataActionState = { error: null };

export interface DepartmentRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  defaultDepartmentId: string | null;
  defaultDepartmentName: string | null;
  estimatedDays: number | null;
  isActive: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// หน่วยงาน
// ────────────────────────────────────────────────────────────────────────────

export function DepartmentsCard({ rows }: { rows: DepartmentRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <AdminCard>
      <AdminCardTitle
        icon={<Building2 className="h-4 w-4" />}
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
                <DialogTitle>เพิ่มหน่วยงาน</DialogTitle>
                <DialogDescription>
                  หน่วยงานใช้สำหรับมอบหมายเรื่องแจ้งเหตุให้ผู้รับผิดชอบ
                </DialogDescription>
              </DialogHeader>
              <DepartmentForm onDone={() => setOpenId(null)} />
            </DialogContent>
          </Dialog>
        }
      >
        หน่วยงาน ({rows.length})
      </AdminCardTitle>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="ยังไม่มีหน่วยงาน"
          description="เพิ่มหน่วยงานเพื่อใช้มอบหมายเรื่องแจ้งเหตุ"
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate font-semibold',
                    d.isActive ? 'text-ink' : 'text-muted line-through',
                  )}
                >
                  {d.name}
                </p>
                <p className="truncate font-mono text-xs text-muted">{d.slug}</p>
              </div>
              <ActiveBadge isActive={d.isActive} />
              <div className="flex flex-none items-center gap-1">
                <Dialog open={openId === d.id} onOpenChange={(o) => setOpenId(o ? d.id : null)}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" aria-label={`แก้ไข ${d.name}`}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>แก้ไขหน่วยงาน</DialogTitle>
                      <DialogDescription>{d.name}</DialogDescription>
                    </DialogHeader>
                    <DepartmentForm row={d} onDone={() => setOpenId(null)} />
                  </DialogContent>
                </Dialog>
                <ToggleButton id={d.id} kind="department" isActive={d.isActive} name={d.name} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}

function DepartmentForm({ row, onDone }: { row?: DepartmentRow; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveDepartment, initial);

  // ปิด dialog หลัง action สำเร็จ — ต้องอยู่ใน effect ไม่ใช่เรียกกลางการ render
  // (การ setState ของ parent ระหว่าง render ลูกคือ side effect ที่ React ห้าม)
  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={action} className="space-y-4">
      {row && <input type="hidden" name="id" value={row.id} />}
      <div>
        <Label htmlFor={`d-name-${row?.id ?? 'new'}`}>ชื่อหน่วยงาน</Label>
        <Input
          id={`d-name-${row?.id ?? 'new'}`}
          name="name"
          defaultValue={row?.name}
          required
          maxLength={120}
          placeholder="เช่น กองช่าง"
        />
      </div>
      <div>
        <Label htmlFor={`d-slug-${row?.id ?? 'new'}`}>slug</Label>
        <Input
          id={`d-slug-${row?.id ?? 'new'}`}
          name="slug"
          defaultValue={row?.slug}
          required
          maxLength={60}
          placeholder="public-works"
        />
        <FieldHint>ใช้ได้เฉพาะ a-z, 0-9 และ - (ใช้อ้างอิงในระบบ)</FieldHint>
      </div>
      <div>
        <Label htmlFor={`d-desc-${row?.id ?? 'new'}`}>คำอธิบาย</Label>
        <Textarea
          id={`d-desc-${row?.id ?? 'new'}`}
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={row?.description ?? ''}
        />
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

// ────────────────────────────────────────────────────────────────────────────
// หมวดหมู่
// ────────────────────────────────────────────────────────────────────────────

export function CategoriesCard({
  rows,
  departments: deptOptions,
}: {
  rows: CategoryRow[];
  departments: { id: string; name: string }[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <AdminCard>
      <AdminCardTitle
        icon={<FolderTree className="h-4 w-4" />}
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
                <DialogTitle>เพิ่มหมวดหมู่</DialogTitle>
                <DialogDescription>
                  หมวดหมู่ที่ประชาชนเลือกตอนแจ้งเหตุ พร้อมกำหนดหน่วยงานและ SLA เริ่มต้น
                </DialogDescription>
              </DialogHeader>
              <CategoryForm departments={deptOptions} onDone={() => setOpenId(null)} />
            </DialogContent>
          </Dialog>
        }
      >
        หมวดหมู่ ({rows.length})
      </AdminCardTitle>

      {rows.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="ยังไม่มีหมวดหมู่"
          description="เพิ่มหมวดหมู่เพื่อให้ประชาชนเลือกตอนแจ้งเหตุ"
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate font-semibold',
                    c.isActive ? 'text-ink' : 'text-muted line-through',
                  )}
                >
                  {c.name}
                </p>
                <p className="truncate text-xs text-muted">
                  <span className="font-mono">{c.slug}</span>
                  {' · '}
                  {c.defaultDepartmentName ?? 'ไม่ระบุหน่วยงาน'}
                  {' · SLA '}
                  {c.estimatedDays ?? '—'} วัน
                </p>
              </div>
              <ActiveBadge isActive={c.isActive} />
              <div className="flex flex-none items-center gap-1">
                <Dialog open={openId === c.id} onOpenChange={(o) => setOpenId(o ? c.id : null)}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" aria-label={`แก้ไข ${c.name}`}>
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>แก้ไขหมวดหมู่</DialogTitle>
                      <DialogDescription>{c.name}</DialogDescription>
                    </DialogHeader>
                    <CategoryForm row={c} departments={deptOptions} onDone={() => setOpenId(null)} />
                  </DialogContent>
                </Dialog>
                <ToggleButton id={c.id} kind="category" isActive={c.isActive} name={c.name} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}

function CategoryForm({
  row,
  departments: deptOptions,
  onDone,
}: {
  row?: CategoryRow;
  departments: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveCategory, initial);
  const uid = row?.id ?? 'new';

  useEffect(() => {
    if (state.success) onDone();
  }, [state.success, onDone]);

  return (
    <form action={action} className="space-y-4">
      {row && <input type="hidden" name="id" value={row.id} />}
      <div>
        <Label htmlFor={`c-name-${uid}`}>ชื่อหมวดหมู่</Label>
        <Input
          id={`c-name-${uid}`}
          name="name"
          defaultValue={row?.name}
          required
          maxLength={120}
          placeholder="เช่น ไฟฟ้าสาธารณะ"
        />
      </div>
      <div>
        <Label htmlFor={`c-slug-${uid}`}>slug</Label>
        <Input
          id={`c-slug-${uid}`}
          name="slug"
          defaultValue={row?.slug}
          required
          maxLength={60}
          placeholder="street-light"
        />
        <FieldHint>ใช้ได้เฉพาะ a-z, 0-9 และ -</FieldHint>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor={`c-dept-${uid}`}>หน่วยงานเริ่มต้น</Label>
          <Select name="defaultDepartmentId" defaultValue={row?.defaultDepartmentId ?? '__none__'}>
            <SelectTrigger id={`c-dept-${uid}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">(ไม่ระบุ)</SelectItem>
              {deptOptions.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={`c-days-${uid}`}>SLA (วัน)</Label>
          <Input
            id={`c-days-${uid}`}
            name="estimatedDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            required
            defaultValue={row?.estimatedDays ?? 7}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`c-desc-${uid}`}>คำอธิบาย</Label>
        <Textarea
          id={`c-desc-${uid}`}
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={row?.description ?? ''}
        />
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

// ────────────────────────────────────────────────────────────────────────────
// ส่วนประกอบร่วม
// ────────────────────────────────────────────────────────────────────────────

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

function ToggleButton({
  id,
  kind,
  isActive,
  name,
}: {
  id: string;
  kind: 'department' | 'category';
  isActive: boolean;
  name: string;
}) {
  return (
    <form action={toggleActive}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        aria-label={`${isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'} ${name}`}
        title={isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
      >
        <Power className="h-4 w-4" aria-hidden="true" />
      </Button>
    </form>
  );
}

/** ข้อความ error ในฟอร์ม — success ไม่ต้องมีเพราะ dialog ปิดตัวเองเมื่อสำเร็จ */
function FormAlert({ children }: { children: React.ReactNode }) {
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
