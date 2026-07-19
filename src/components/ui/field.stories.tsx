import type { Meta, StoryObj } from '@storybook/react';
import { Input, Label, Textarea, FieldError, FieldHint } from './field';

const meta: Meta<typeof Input> = {
  title: 'ui/Field',
  component: Input,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  render: () => (
    <div className="max-w-sm">
      <Label htmlFor="name">ชื่อผู้แจ้ง</Label>
      <Input id="name" placeholder="เช่น นายสมชาย ใจดี" />
      <FieldHint>ใส่ชื่อ-นามสกุลจริง</FieldHint>
    </div>
  ),
};

export const Error: Story = {
  render: () => (
    <div className="max-w-sm">
      <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
      <Input id="phone" inputMode="tel" invalid defaultValue="08" />
      <FieldError>เบอร์ไม่ครบ 10 หลัก</FieldError>
    </div>
  ),
};

export const TextareaStory: Story = {
  render: () => (
    <div className="max-w-sm">
      <Label htmlFor="detail">รายละเอียดเรื่องแจ้งเหตุ</Label>
      <Textarea id="detail" placeholder="อธิบายเรื่องที่ต้องการแจ้ง..." />
    </div>
  ),
};