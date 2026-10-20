'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  KeyRound,
  Link2Off,
  Loader2,
  Pencil,
  Power,
  Trash2,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldHint, Input, Label } from '@/components/ui/field';
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
  deleteCitizen,
  setCitizenCid,
  toggleCitizenActive,
  unlinkCitizenLine,
  updateCitizen,
  type CitizenActionState,
} from '@/app/admin/actions/citizens';
import { cn } from '@/lib/cn';

export interface CitizenRow {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  contactEmail: string | null;
  isActive: boolean;
  createdAt: Date;
  /** masked id 8 ตัวแรก — ใช้แสดงผลเท่านั้น ห้ามใช้ค้นหาหรือ join */
  lineLinks: { lineUserId: string | null; displayName: string | null }[];
  caseCount: number;
}

const initial: CitizenActionState = { error: null };

export function CitizensClient({ rows, query }: { rows: CitizenRow[]; query: string }) {
  const [openDialog, setOpenDialog] = useState<string | null>(null);

  return (
    <AdminCard>
      <AdminCardTitle icon={<Users className="h-4 w-4" />}>
        บัญชีประชาชน ({rows.length.toLocaleString('th-TH')})
        {query ? ` — ผลการค้นหา “${query}”` : ''}
      </AdminCardTitle>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? 'ไม่พบบัญชีที่ค้นหา' : 'ยังไม่มีบัญชีประชาชน'}
          description={
            query ? 'ลองค้นด้วยชื่ออื่น' : 'บัญชีจะถูกสร้างเมื่อมีผู้แจ้งเรื่องเข้ามา'
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate font-semibold',
                    c.isActive ? 'text-ink' : 'text-muted line-through',
                  )}
                >
                  {c.fullName}
                </p>
                <p className="truncate font-mono text-xs text-muted">{c.email}</p>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {c.phoneNumber ?? '—'} · {c.contactEmail ?? 'ไม่มีอีเมลติดต่อ'} ·{' '}
                  {c.lineLinks.length > 0
                    ? `LINE: ${c.lineLinks[0]?.displayName ?? c.lineLinks[0]?.lineUserId ?? 'ไม่ระบุ'}${c.lineLinks.length > 1 ? ` (+${c.lineLinks.length - 1})` : ''}`
                    : 'ไม่ผูก LINE'}{' '}
                  · {c.caseCount} เรื่อง
                </p>
              </div>
              <span
                className={cn(
                  'inline-flex flex-none items-center gap-1.5 whitespace-nowrap text-sm font-semibold',
                  c.isActive ? 'text-success-ink' : 'text-danger-ink',
                )}
              >
                <span
                  className={cn(
                    'h-2 w-2 flex-none rounded-full',
                    c.isActive ? 'bg-success' : 'bg-danger',
                  )}
                  aria-hidden="true"
                />
                {c.isActive ? 'ใช้งาน' : 'ระงับ'}
              </span>
              <div className="flex flex-none items-center gap-1">
                <EditDialog row={c} open={openDialog === `edit-${c.id}`} onOpenChange={(o) => setOpenDialog(o ? `edit-${c.id}` : null)} />
                <CidDialog row={c} open={openDialog === `cid-${c.id}`} onOpenChange={(o) => setOpenDialog(o ? `cid-${c.id}` : null)} />
                {c.lineLinks.length > 0 && (
                  <ConfirmDialog
                    row={c}
                    open={openDialog === `unlink-${c.id}`}
                    onOpenChange={(o) => setOpenDialog(o ? `unlink-${c.id}` : null)}
                    title="ถอดการผูก LINE"
                    description={`ถอดบัญชี LINE ทั้งหมด (${c.lineLinks.length} บัญชี) ออกจาก ${c.fullName} หรือไม่`}
                    action={unlinkCitizenLine}
                    submitLabel="ถอดการผูก"
                    icon={<Link2Off className="h-4 w-4" aria-hidden="true" />}
                    ariaLabel={`ถอดการผูก LINE ของ ${c.fullName}`}
                  />
                )}
                <ConfirmDialog
                  row={c}
                  open={openDialog === `delete-${c.id}`}
                  onOpenChange={(o) => setOpenDialog(o ? `delete-${c.id}` : null)}
                  title="ลบบัญชีประชาชน"
                  description={
                    c.caseCount > 0
                      ? `บัญชีนี้มีเรื่องแจ้ง ${c.caseCount} เรื่อง — ลบไม่ได้ ให้ปิดใช้งานแทน`
                      : `ลบบัญชี ${c.fullName} และบันทึกความยินยอมทั้งหมดหรือไม่ (ทำแล้วทำเลย)`
                  }
                  action={deleteCitizen}
                  submitLabel="ลบถาวร"
                  destructive
                  icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                  ariaLabel={`ลบบัญชี ${c.fullName}`}
                />
                <form action={toggleCitizenAction}>
                  <input type="hidden" name="userId" value={c.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={`${c.isActive ? 'ระงับ' : 'เปิดใช้งาน'}บัญชี ${c.fullName}`}
                    title={c.isActive ? 'ระงับ (เรื่องซ่อนจากช่องทางประชาชน)' : 'เปิดใช้งาน'}
                  >
                    <Power className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminCard>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// แก้ไขข้อมูลติดต่อ
// ────────────────────────────────────────────────────────────────────────────

function EditDialog({ row, open, onOpenChange }: { row: CitizenRow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [state, action, pending] = useActionState(updateCitizen, initial);

  useEffect(() => {
    if (state.success) onOpenChange(false);
  }, [state.success, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" aria-label={`แก้ไข ${row.fullName}`}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>แก้ไขข้อมูลประชาชน</DialogTitle>
          <DialogDescription>{row.fullName}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="userId" value={row.id} />
          <div>
            <Label htmlFor={`cz-name-${row.id}`}>ชื่อ-นามสกุล</Label>
            <Input id={`cz-name-${row.id}`} name="fullName" defaultValue={row.fullName} required maxLength={100} />
          </div>
          <div>
            <Label htmlFor={`cz-phone-${row.id}`}>เบอร์โทร</Label>
            <Input id={`cz-phone-${row.id}`} name="phoneNumber" defaultValue={row.phoneNumber ?? ''} maxLength={20} placeholder="เช่น 0812345678" />
          </div>
          <div>
            <Label htmlFor={`cz-email-${row.id}`}>อีเมลติดต่อ</Label>
            <Input
              id={`cz-email-${row.id}`}
              name="contactEmail"
              type="email"
              defaultValue={row.contactEmail ?? ''}
              maxLength={254}
              placeholder="เว้นว่างได้"
            />
            <FieldHint>เก็บเป็นช่องทางติดต่อเท่านั้น ไม่ใช่ตัวตนของบัญชี</FieldHint>
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
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ผูกเลขบัตรประชาชน
// ────────────────────────────────────────────────────────────────────────────

function CidDialog({ row, open, onOpenChange }: { row: CitizenRow; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [state, action, pending] = useActionState(setCitizenCid, initial);

  useEffect(() => {
    if (state.success) onOpenChange(false);
  }, [state.success, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" aria-label={`ผูกเลขบัตรให้ ${row.fullName}`} title="ผูกเลขบัตรประชาชน">
          <KeyRound className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ผูกเลขบัตรประชาชน</DialogTitle>
          <DialogDescription>
            {row.fullName} — ระบบตรวจ checksum และผูกด้วย hash เท่านั้น ไม่เก็บเลขบัตรจริง
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4">
          <input type="hidden" name="userId" value={row.id} />
          <div>
            <Label htmlFor={`cz-cid-${row.id}`}>เลขบัตรประชาชน 13 หลัก</Label>
            <Input
              id={`cz-cid-${row.id}`}
              name="cid"
              required
              minLength={13}
              maxLength={13}
              inputMode="numeric"
              pattern="[0-9]{13}"
              placeholder="เช่น 1234567890123"
            />
            <FieldHint>ถ้าเลขนี้ถูกใช้กับบัญชีอื่นแล้ว ระบบจะปฏิเสธ ไม่รวมบัญชีให้อัตโนมัติ</FieldHint>
          </div>
          {state.error && <FormAlert>{state.error}</FormAlert>}
          <div className="flex justify-end pt-1">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  กำลังผูก...
                </>
              ) : (
                'ผูกเลขบัตร'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// ยืนยันก่อนทำ (ถอดผูก LINE / ลบ)
// ────────────────────────────────────────────────────────────────────────────

function ConfirmDialog({
  row,
  open,
  onOpenChange,
  title,
  description,
  action,
  submitLabel,
  destructive,
  icon,
  ariaLabel,
}: {
  row: CitizenRow;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  action: (prevState: CitizenActionState, formData: FormData) => Promise<CitizenActionState>;
  submitLabel: string;
  destructive?: boolean;
  icon: ReactNode;
  ariaLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);

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
          aria-label={ariaLabel}
          className={destructive ? 'text-danger-ink hover:text-danger-ink' : undefined}
        >
          {icon}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={row.id} />
          {state.error && <FormAlert>{state.error}</FormAlert>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" size="sm" variant={destructive ? 'destructive' : 'primary'} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  กำลังทำ...
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * toggleCitizenActive ถูกเรียกแบบ inline (ไม่ใช่ dialog) — ใช้ wrapper เพื่อให้ signature
 * ตรงกับ form action expectation (void return) เหมือน toggleUserAction ใน users-client
 */
async function toggleCitizenAction(formData: FormData): Promise<void> {
  await toggleCitizenActive({ error: null }, formData);
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
