'use client';

import { useActionState, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Label, Textarea } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  addUpdate,
  assignOfficer,
  changeDepartment,
  changeStatus,
  setPriority,
  type CaseActionState,
} from '@/app/admin/actions/cases';
import {
  ALL_STATUSES,
  STATUS_LABELS_TH,
  assertTransition,
  type CaseStatus,
} from '@/lib/cases/state-machine';
import type { UserRole } from '@/lib/auth/roles';

interface OfficerOption {
  id: string;
  fullName: string;
  role: UserRole;
}

interface DepartmentOption {
  id: string;
  name: string;
}

interface CaseDetailClientProps {
  caseId: string;
  currentStatus: CaseStatus;
  currentPriority: 'normal' | 'urgent';
  currentAssignedTo: string | null;
  currentDepartmentId: string | null;
  officers: OfficerOption[];
  departments: DepartmentOption[];
  canChangeDepartment: boolean; // chief/head/superadmin เท่านั้น
}

const initialActionState: CaseActionState = { error: null };

export function CaseDetailClient({
  caseId,
  currentStatus,
  currentPriority,
  currentAssignedTo,
  currentDepartmentId,
  officers,
  departments,
  canChangeDepartment,
}: CaseDetailClientProps) {
  // แยก useActionState ตาม action — แต่ละ form มี state อิสระ
  const [statusState, statusAction, statusPending] = useActionState(
    changeStatus,
    initialActionState
  );
  const [assignState, assignAction, assignPending] = useActionState(
    assignOfficer,
    initialActionState
  );
  const [deptState, deptAction, deptPending] = useActionState(
    changeDepartment,
    initialActionState
  );
  const [priorityState, priorityAction, priorityPending] = useActionState(
    setPriority,
    initialActionState
  );
  const [commentState, commentAction, commentPending] = useActionState(
    addUpdate,
    initialActionState
  );

  // local state สำหรับ status dropdown (เพื่อเช็ค transition ฝั่ง client ก่อน submit)
  const [selectedStatus, setSelectedStatus] = useState<CaseStatus>(currentStatus);
  const transitionCheck = assertTransition(currentStatus, selectedStatus);

  return (
    <div className="space-y-6">
      {/* ── เปลี่ยนสถานะ ── */}
      <ActionCard title="เปลี่ยนสถานะ" icon={<Loader2 className="h-4 w-4" />}>
        <form action={statusAction} className="space-y-3">
          <input type="hidden" name="caseId" value={caseId} />
          <div>
            <Label htmlFor="status">สถานะใหม่</Label>
            <Select
              name="status"
              value={selectedStatus}
              onValueChange={(v) => setSelectedStatus(v as CaseStatus)}
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_STATUSES.map((s) => {
                  const check = assertTransition(currentStatus, s);
                  return (
                    <SelectItem
                      key={s}
                      value={s}
                      disabled={!check.ok}
                      className={!check.ok ? 'opacity-50' : ''}
                    >
                      {STATUS_LABELS_TH[s]}
                      {!check.ok && ' (ไม่อนุญาต)'}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedStatus !== currentStatus && !transitionCheck.ok && (
              <p role="alert" className="mt-1.5 text-sm font-semibold text-danger-ink">
                {transitionCheck.reason}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="status-comment">หมายเหตุ (ไม่จำเป็น)</Label>
            <Textarea
              id="status-comment"
              name="comment"
              rows={2}
              placeholder="เช่น ตรวจสอบแล้วอยู่ในขอบเขต ส่งต่อให้กองช่าง"
            />
          </div>
          {/* § การเปลี่ยนสถานะยังคง defaultChecked ไว้โดยตั้งใจ — ต่างจากช่องความคืบหน้า
              ด้านล่างที่กลับทิศเป็น opt-in เพราะการรู้ว่าเรื่องถึงขั้นไหนแล้วคือสิ่งที่
              ผู้แจ้งควรได้รับ ส่วนความเสี่ยงอยู่ที่ "หมายเหตุ" ซึ่งเป็นข้อความอิสระ
              จึงเตือนไว้ใต้ช่องแทนการปิดค่าเริ่มต้นทั้งหมด */}
          <label htmlFor="status-is-public" className="flex items-center gap-2 text-sm">
            <input
              id="status-is-public"
              type="checkbox"
              name="isPublic"
              value="true"
              defaultChecked
              aria-label="ให้ประชาชนเห็นการอัปเดตนี้"
              aria-describedby="status-public-hint"
              className="h-4 w-4 rounded border-border-strong accent-accent-strong"
            />
            <span>ให้ประชาชนเห็นการอัปเดตนี้</span>
          </label>
          <p id="status-public-hint" className="-mt-1 text-xs text-muted">
            หมายเหตุจะแสดงบนหน้าติดตามเรื่อง — ห้ามระบุชื่อ เบอร์โทร หรือที่อยู่ของบุคคลอื่น
          </p>
          {statusState.error && <ErrorText>{statusState.error}</ErrorText>}
          <Button type="submit" size="sm" disabled={statusPending || !transitionCheck.ok}>
            {statusPending ? 'กำลังบันทึก...' : 'บันทึกสถานะ'}
          </Button>
        </form>
      </ActionCard>

      {/* ── มอบหมายเจ้าหน้าที่ ── */}
      <ActionCard title="มอบหมายเจ้าหน้าที่">
        <form action={assignAction} className="space-y-3">
          <input type="hidden" name="caseId" value={caseId} />
          <div>
            <Label htmlFor="officerId">เจ้าหน้าที่รับผิดชอบ</Label>
            <Select name="officerId" defaultValue={currentAssignedTo ?? '__unassign__'}>
              <SelectTrigger id="officerId">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassign__">(ยังไม่มอบหมาย)</SelectItem>
                {officers.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.fullName} · {o.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {assignState.error && <ErrorText>{assignState.error}</ErrorText>}
          <Button type="submit" size="sm" variant="secondary" disabled={assignPending}>
            {assignPending ? 'กำลังบันทึก...' : 'บันทึกการมอบหมาย'}
          </Button>
        </form>
      </ActionCard>

      {/* ── เปลี่ยนหน่วยงาน (เฉพาะ supervisor) ── */}
      {canChangeDepartment && (
        <ActionCard title="เปลี่ยนหน่วยงานรับผิดชอบ">
          <form action={deptAction} className="space-y-3">
            <input type="hidden" name="caseId" value={caseId} />
            <div>
              <Label htmlFor="departmentId">หน่วยงาน</Label>
              <Select
                name="departmentId"
                defaultValue={currentDepartmentId ?? '__unset__'}
              >
                <SelectTrigger id="departmentId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__unset__">(ไม่ระบุ)</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {deptState.error && <ErrorText>{deptState.error}</ErrorText>}
            <Button type="submit" size="sm" variant="secondary" disabled={deptPending}>
              {deptPending ? 'กำลังบันทึก...' : 'บันทึกหน่วยงาน'}
            </Button>
          </form>
        </ActionCard>
      )}

      {/* ── เปลี่ยนความเร่งด่วน ── */}
      <ActionCard title="ความเร่งด่วน">
        <form action={priorityAction} className="space-y-3">
          <input type="hidden" name="caseId" value={caseId} />
          <div>
            <Label htmlFor="priority">ความเร่งด่วน</Label>
            <Select name="priority" defaultValue={currentPriority}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">ปกติ</SelectItem>
                <SelectItem value="urgent">ฉุกเฉิน</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {priorityState.error && <ErrorText>{priorityState.error}</ErrorText>}
          <Button type="submit" size="sm" variant="secondary" disabled={priorityPending}>
            {priorityPending ? 'กำลังบันทึก...' : 'บันทึก'}
          </Button>
        </form>
      </ActionCard>

      {/* ── เพิ่มความคืบหน้า ── */}
      <ActionCard title="เพิ่มความคืบหน้า">
        <form action={commentAction} className="space-y-3">
          <input type="hidden" name="caseId" value={caseId} />
          <div>
            <Label htmlFor="comment">ข้อความ</Label>
            <Textarea
              id="comment"
              name="comment"
              rows={4}
              maxLength={2000}
              placeholder="เช่น ลงพื้นที่ตรวจสอบแล้ว พบว่าต้องสั่งซื้อวัสดุเพิ่ม"
              required
            />
          </div>
          {/* § กลับทิศเป็น opt-in — เดิม checkbox นี้คือ "หมายเหตุภายใน" ที่ต้องติ๊กเอง
              แปลว่าค่าเริ่มต้นคือเผยแพร่สู่สาธารณะ ลืมติ๊กครั้งเดียวข้อความก็ไปโผล่
              บนหน้า /track ที่ใครมีเลขติดตามก็เปิดดูได้ และเรียกคืนไม่ได้ */}
          <label htmlFor="comment-is-public" className="flex items-center gap-2 text-sm">
            <input
              id="comment-is-public"
              type="checkbox"
              name="isPublic"
              value="true"
              aria-label="เผยแพร่ให้ประชาชนเห็นบนหน้าติดตามเรื่อง"
              aria-describedby="comment-public-hint"
              className="h-4 w-4 rounded border-border-strong accent-accent-strong"
            />
            <span>เผยแพร่ให้ประชาชนเห็น</span>
          </label>
          <p id="comment-public-hint" className="-mt-1 text-xs text-muted">
            ค่าเริ่มต้นคือหมายเหตุภายใน — ติ๊กแล้วข้อความจะถูกส่งออกทาง API สาธารณะที่
            ใครมีเลขติดตามก็เรียกดูได้ ห้ามระบุชื่อ เบอร์โทร หรือที่อยู่ของบุคคลอื่น
          </p>
          {commentState.error && <ErrorText>{commentState.error}</ErrorText>}
          <Button type="submit" size="sm" disabled={commentPending}>
            {commentPending ? 'กำลังบันทึก...' : 'เพิ่มความคืบหน้า'}
          </Button>
        </form>
      </ActionCard>
    </div>
  );
}

function ActionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-panel rounded-xl p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2.5 text-base font-bold text-ink">
        {icon && (
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-md bg-accent-sunken text-accent-strong">
            {icon}
          </span>
        )}
        {title}
      </h3>
      {children}
    </section>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
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

/** success toast แสดงจาก query param ?ok=... */
export function SuccessToast({ ok }: { ok: string | null }) {
  if (!ok) return null;
  const messages: Record<string, string> = {
    status: 'อัปเดตสถานะเรียบร้อย',
    assign: 'อัปเดตการมอบหมายเรียบร้อย',
    department: 'อัปเดตหน่วยงานเรียบร้อย',
    priority: 'อัปเดตความเร่งด่วนเรียบร้อย',
    comment: 'เพิ่มความคืบหน้าเรียบร้อย',
  };
  const msg = messages[ok] ?? 'บันทึกเรียบร้อย';
  return (
    <div
      role="status"
      className="mb-4 flex items-center gap-2 rounded-xl border border-success-ink/30 bg-success-soft px-4 py-3 text-sm font-semibold text-success-ink shadow-sm"
    >
      <CheckCircle2 className="h-4 w-4 flex-none" aria-hidden="true" />
      {msg}
    </div>
  );
}
