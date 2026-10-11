import type { Meta, StoryObj } from '@storybook/react';
import { useState, type FormEvent } from 'react';
import { Button } from './button';
import { FieldError, FieldHint, Input, Label, Textarea } from './field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';

const meta: Meta<typeof Input> = {
  title: 'patterns/ข้อผิดพลาดของฟอร์ม',
  component: Input,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof Input>;

export const InputError: Story = {
  render: () => (
    <div className="max-w-sm">
      <Label htmlFor="pattern-name">ชื่อผู้แจ้ง</Label>
      <Input id="pattern-name" invalid aria-describedby="pattern-name-error" />
      <FieldError id="pattern-name-error">กรุณากรอกชื่อ-นามสกุล</FieldError>
    </div>
  ),
};

export const TextareaError: Story = {
  render: () => (
    <div className="max-w-sm">
      <Label htmlFor="pattern-detail">รายละเอียด</Label>
      <Textarea id="pattern-detail" invalid aria-describedby="pattern-detail-hint pattern-detail-error" />
      <FieldHint id="pattern-detail-hint">บอกเล่าเรื่องที่เกิด เวลา และความเสียหาย</FieldHint>
      <FieldError id="pattern-detail-error">กรุณากรอกรายละเอียด</FieldError>
    </div>
  ),
};

export const SelectError: Story = {
  render: () => (
    <div className="max-w-sm">
      <Label htmlFor="pattern-category">หมวดเรื่อง</Label>
      <Select>
        <SelectTrigger id="pattern-category" aria-invalid aria-describedby="pattern-category-error">
          <SelectValue placeholder="เลือกหมวดเรื่อง" />
        </SelectTrigger>
        <SelectContent><SelectItem value="roads">ถนน</SelectItem></SelectContent>
      </Select>
      <FieldError id="pattern-category-error">กรุณาเลือกหมวดเรื่อง</FieldError>
    </div>
  ),
};

export const ConsentError: Story = {
  render: () => (
    <div className="max-w-sm">
      <label htmlFor="pattern-consent" className="flex min-h-touch items-center gap-3">
        <input id="pattern-consent" type="checkbox" aria-label="ยินยอมให้เก็บข้อมูลเพื่อดำเนินการเรื่องที่แจ้ง" aria-invalid aria-describedby="pattern-consent-error" />
        ยินยอมให้เก็บข้อมูลเพื่อดำเนินการเรื่องที่แจ้ง
      </label>
      <FieldError id="pattern-consent-error">กรุณายินยอมให้เก็บข้อมูลก่อนส่งเรื่อง</FieldError>
    </div>
  ),
};

function ValidationExample() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(value.trim() ? null : 'กรุณากรอกหัวเรื่อง');
  }
  return (
    <form className="max-w-sm" noValidate onSubmit={submit}>
      <Label htmlFor="pattern-title">หัวเรื่อง</Label>
      <Input
        id="pattern-title"
        value={value}
        invalid={!!error}
        aria-describedby={error ? 'pattern-title-error' : 'pattern-title-hint'}
        onChange={(event) => { setValue(event.target.value); setError(null); }}
      />
      {error ? <FieldError id="pattern-title-error">{error}</FieldError> : <FieldHint id="pattern-title-hint">สรุปเรื่องที่ต้องการแจ้ง</FieldHint>}
      <Button type="submit" className="mt-4">ตรวจข้อมูล</Button>
    </form>
  );
}

export const InteractiveValidation: Story = { render: () => <ValidationExample /> };
