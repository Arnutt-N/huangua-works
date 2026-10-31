// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CaseDetailClient } from './case-detail-client';
import * as caseActions from '@/app/admin/actions/cases';

vi.setConfig({ testTimeout: 30_000 });

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('@/app/admin/actions/cases', () => ({
  changeStatus: vi.fn(async () => ({ error: null, success: 'บันทึกข้อมูลเรียบร้อย' })),
  assignOfficer: vi.fn(async () => ({ error: null, success: 'บันทึกข้อมูลเรียบร้อย' })),
  changeDepartment: vi.fn(async () => ({ error: null, success: 'บันทึกข้อมูลเรียบร้อย' })),
  setPriority: vi.fn(async () => ({ error: null, success: 'บันทึกข้อมูลเรียบร้อย' })),
  changeBudget: vi.fn(async () => ({ error: null, success: 'บันทึกข้อมูลเรียบร้อย' })),
  changeBudgetAmount: vi.fn(async () => ({ error: null, success: 'บันทึกข้อมูลเรียบร้อย' })),
  changeActionDetails: vi.fn(async () => ({ error: null, success: 'บันทึกข้อมูลเรียบร้อย' })),
  addUpdate: vi.fn(async () => ({ error: null, success: 'บันทึกข้อมูลเรียบร้อย' })),
}));

const mockDepartments = [
  { id: 'dept-1', name: 'กองช่าง' },
  { id: 'dept-2', name: 'สำนักปลัด' },
];

const mockOfficers = [
  { id: 'off-1', fullName: 'สมชาย ช่างไฟ', role: 'officer' as const },
];

const baseProps = {
  caseId: 'case-test-1',
  currentStatus: 'received' as const,
  currentPriority: 'normal' as const,
  currentBudgetStatus: 'unspecified' as const,
  currentBudgetAmount: 50000,
  currentActionDetails: 'เทพื้นคอนกรีตเรียบร้อยแล้ว',
  currentAssignedTo: 'off-1',
  currentDepartmentId: 'dept-1',
  officers: mockOfficers,
  departments: mockDepartments,
  canChangeDepartment: true,
  canChangeBudget: true,
  canChangeBudgetAmount: true,
  canChangeActionDetails: true,
};

beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CaseDetailClient — FLOW-01: สิทธิ์และการแสดงผลแบบอ่านอย่างเดียว', () => {
  it('เมื่อเป็น supervisor (canChangeDepartment = true): แสดงฟอร์มแก้ไขและปุ่มบันทึกหน่วยงาน', () => {
    render(<CaseDetailClient {...baseProps} canChangeDepartment={true} />);

    expect(screen.getByRole('button', { name: 'บันทึกหน่วยงาน' })).toBeInTheDocument();
  });

  it('เมื่อไม่ใช่ supervisor (canChangeDepartment = false): แสดงการ์ดอ่านอย่างเดียวพร้อมชื่อหน่วยงาน และไม่มีปุ่มบันทึก', () => {
    render(<CaseDetailClient {...baseProps} canChangeDepartment={false} />);

    expect(screen.queryByRole('button', { name: 'บันทึกหน่วยงาน' })).not.toBeInTheDocument();
    expect(screen.getByText('หน่วยงานรับผิดชอบ')).toBeInTheDocument();
    expect(screen.getByText('กองช่าง')).toBeInTheDocument();
  });

  it('เมื่อไม่ใช่ supervisor (canChangeDepartment = false) และยังไม่ระบุหน่วยงาน: แสดง "(ไม่ระบุ)"', () => {
    render(
      <CaseDetailClient
        {...baseProps}
        currentDepartmentId={null}
        canChangeDepartment={false}
      />
    );

    expect(screen.getByText('(ไม่ระบุ)')).toBeInTheDocument();
  });

  it('เมื่อ canChangeBudget/canChangeBudgetAmount/canChangeActionDetails เป็น false: แสดงข้อความอ่านอย่างเดียว และไม่มีช่อง input/textarea', () => {
    render(
      <CaseDetailClient
        {...baseProps}
        canChangeBudget={false}
        canChangeBudgetAmount={false}
        canChangeActionDetails={false}
      />
    );

    expect(screen.queryByLabelText('จำนวนเงิน (บาท)')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('สิ่งที่ทำไปแล้ว (ภายใน)')).not.toBeInTheDocument();
    expect(screen.getByText('50,000 บาท')).toBeInTheDocument();
    expect(screen.getByText('เทพื้นคอนกรีตเรียบร้อยแล้ว')).toBeInTheDocument();
  });
});

describe('CaseDetailClient — FLOW-04: กรอกหลายฟอร์ม บันทึกแล้วไม่ล้างดราฟต์การ์ดอื่น และเคลียร์ฟอร์มที่สำเร็จ', () => {
  it('พิมพ์ในช่องความคืบหน้า และช่องรายละเอียดการดำเนินการ เมื่อส่งความคืบหน้าสำเร็จ ช่องความคืบหน้าถูกรีเซ็ต แต่รายละเอียดการดำเนินการยังอยู่', async () => {
    const user = userEvent.setup();
    render(<CaseDetailClient {...baseProps} currentActionDetails="" />);

    const commentInput = screen.getByLabelText('ข้อความ');
    const actionDetailsInput = screen.getByLabelText('สิ่งที่ทำไปแล้ว (ภายใน)');
    const publicCheckbox = screen.getByLabelText('เผยแพร่ให้ประชาชนเห็นบนหน้าติดตามเรื่อง');

    // 1. พิมพ์ข้อมูลลงใน 2 ฟอร์มที่เป็นอิสระต่อกัน
    await user.type(commentInput, 'ข้อความความคืบหน้าใหม่ทดสอบ');
    await user.click(publicCheckbox);
    await user.type(actionDetailsInput, 'ร่างข้อความสิ่งที่ทำไปแล้วยังไม่บันทึก');

    expect(commentInput).toHaveValue('ข้อความความคืบหน้าใหม่ทดสอบ');
    expect(publicCheckbox).toBeChecked();
    expect(actionDetailsInput).toHaveValue('ร่างข้อความสิ่งที่ทำไปแล้วยังไม่บันทึก');

    // 2. กดบันทึกเฉพาะฟอร์มความคืบหน้า
    const submitCommentBtn = screen.getByRole('button', { name: 'เพิ่มความคืบหน้า' });
    await user.click(submitCommentBtn);

    // 3. รอให้ addUpdate ทำงานและแจ้ง success
    await waitFor(() => {
      expect(caseActions.addUpdate).toHaveBeenCalledTimes(1);
    });

    // 4. ฟอร์มความคืบหน้าที่บันทึกสำเร็จ ต้องถูกรีเซ็ตกลับเป็นค่าว่าง
    await waitFor(() => {
      expect(commentInput).toHaveValue('');
      expect(publicCheckbox).not.toBeChecked();
    });

    // 5. แต่ดราฟต์ในฟอร์มรายละเอียดการดำเนินการ ต้องยังคงอยู่ ไม่ถูกล้างหายเงียบ
    expect(actionDetailsInput).toHaveValue('ร่างข้อความสิ่งที่ทำไปแล้วยังไม่บันทึก');
  });

  it('พิมพ์หมายเหตุในฟอร์มเปลี่ยนสถานะ เมื่อเลือกสถานะใหม่และบันทึกสำเร็จ หมายเหตุในฟอร์มสถานะถูกรีเซ็ต', async () => {
    const user = userEvent.setup();
    render(<CaseDetailClient {...baseProps} currentStatus="received" />);

    // เลือกสถานะใหม่ (reviewing อนุญาตจาก received)
    const statusTrigger = screen.getByRole('combobox', { name: 'สถานะใหม่' });
    await user.click(statusTrigger);
    const reviewingOption = await screen.findByRole('option', { name: 'ตรวจสอบ' });
    await user.click(reviewingOption);

    const statusCommentInput = screen.getByLabelText('หมายเหตุ (ไม่จำเป็น)');
    await user.type(statusCommentInput, 'หมายเหตุส่งต่อกองช่าง');
    expect(statusCommentInput).toHaveValue('หมายเหตุส่งต่อกองช่าง');

    // บันทึกสถานะ (ปุ่มเปิดใช้งานแล้วเพราะ transition ok)
    const submitStatusBtn = screen.getByRole('button', { name: 'บันทึกสถานะ' });
    expect(submitStatusBtn).not.toBeDisabled();
    await user.click(submitStatusBtn);

    await waitFor(() => {
      expect(caseActions.changeStatus).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(statusCommentInput).toHaveValue('');
    });
  });
});

describe('CaseDetailClient — FLOW-02: ความสอดคล้องระหว่างการมอบหมายกับสถานะ assigned', () => {
  it('เลือกสถานะ "มอบหมายแล้ว" แต่เคสยังไม่มีผู้รับผิดชอบ (currentAssignedTo = null) → แสดงคำเตือนและปิดปุ่มบันทึกสถานะ', async () => {
    const user = userEvent.setup();
    render(
      <CaseDetailClient
        {...baseProps}
        currentStatus="reviewing"
        currentAssignedTo={null}
      />
    );

    // เลือกสถานะ "มอบหมาย" (reviewing อนุญาตให้ไป assigned)
    const statusTrigger = screen.getByRole('combobox', { name: 'สถานะใหม่' });
    await user.click(statusTrigger);
    const assignedOption = await screen.findByRole('option', { name: 'มอบหมาย' });
    await user.click(assignedOption);

    // ต้องแสดงคำเตือนว่ายังไม่ได้ระบุเจ้าหน้าที่
    expect(
      screen.getByText(/ไม่สามารถเปลี่ยนเป็นสถานะ "มอบหมายแล้ว" ได้เนื่องจากยังไม่ได้ระบุเจ้าหน้าที่รับผิดชอบ/)
    ).toBeInTheDocument();

    // ปุ่มบันทึกสถานะต้องถูกปิด (disabled)
    const submitStatusBtn = screen.getByRole('button', { name: 'บันทึกสถานะ' });
    expect(submitStatusBtn).toBeDisabled();
  });

  it('สถานะเรื่องเป็น "มอบหมายแล้ว" แต่เลือก "(ยังไม่มอบหมาย)" ในช่องเจ้าหน้าที่ → แสดงคำเตือนและปิดปุ่มบันทึกการมอบหมาย', async () => {
    const user = userEvent.setup();
    render(
      <CaseDetailClient
        {...baseProps}
        currentStatus="assigned"
        currentAssignedTo="off-1"
      />
    );

    // เลือก "(ยังไม่มอบหมาย)"
    const officerTrigger = screen.getByRole('combobox', { name: 'เจ้าหน้าที่รับผิดชอบ' });
    await user.click(officerTrigger);
    const unassignOption = await screen.findByRole('option', { name: '(ยังไม่มอบหมาย)' });
    await user.click(unassignOption);

    // ต้องแสดงคำเตือนว่าห้ามยกเลิกขณะสถานะเป็นมอบหมายแล้ว
    expect(
      screen.getByText(/ไม่สามารถยกเลิกผู้รับผิดชอบขณะเรื่องอยู่ในสถานะ "มอบหมายแล้ว" ได้/)
    ).toBeInTheDocument();

    // ปุ่มบันทึกการมอบหมายต้องถูกปิด (disabled)
    const submitAssignBtn = screen.getByRole('button', { name: 'บันทึกการมอบหมาย' });
    expect(submitAssignBtn).toBeDisabled();
  });

  it('เมื่อสถานะเป็น reviewing และยังไม่มีผู้รับผิดชอบ → แสดงคำแนะนำขั้นตอนการมอบหมาย', () => {
    render(
      <CaseDetailClient
        {...baseProps}
        currentStatus="reviewing"
        currentAssignedTo={null}
      />
    );

    expect(
      screen.getByText(
        /เมื่อบันทึกการมอบหมายแล้ว จึงจะสามารถเปลี่ยนสถานะเรื่องเป็น "มอบหมายแล้ว" ในกล่องเปลี่ยนสถานะด้านบนได้/
      )
    ).toBeInTheDocument();
  });
});

