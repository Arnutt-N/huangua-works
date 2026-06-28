import type { Meta, StoryObj } from '@storybook/react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { Button } from './button';

const meta: Meta<typeof Dialog> = {
  title: 'ui/Dialog',
  component: Dialog,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">เปิดหน้าต่างยืนยัน</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ยืนยันการปิดเรื่อง</DialogTitle>
          <DialogDescription>
            เมื่อปิดเรื่องแล้ว ผู้แจ้งจะได้รับสรุปผล และไม่สามารถแก้ไขเรื่องนี้ได้อีก
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3">
          <Button variant="ghost">ยกเลิก</Button>
          <Button variant="primary">ปิดเรื่อง</Button>
        </div>
      </DialogContent>
    </Dialog>
  ),
};