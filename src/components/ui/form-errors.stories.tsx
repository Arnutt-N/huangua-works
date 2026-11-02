import type { Meta, StoryObj } from '@storybook/react';
import { useState, type FormEvent } from 'react';
import { Button } from './button';
import { ErrorSummary, type ErrorSummaryItem } from './error-summary';
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

function ErrorSummaryExample() {
  const [name, setName] = useState('');
  const [detail, setDetail] = useState('');
  const [submitCount, setSubmitCount] = useState(0);
  const [errors, setErrors] = useState<ErrorSummaryItem[]>([]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const newErrors: ErrorSummaryItem[] = [];
    if (!name.trim()) {
      newErrors.push({
        fieldId: 'demo-name',
        fieldLabel: 'ชื่อผู้ติดต่อ',
        message: 'กรุณากรอกชื่อ-นามสกุล',
      });
    }
    if (!detail.trim()) {
      newErrors.push({
        fieldId: 'demo-detail',
        fieldLabel: 'รายละเอียด',
        message: 'กรุณากรอกรายละเอียดเรื่องที่แจ้ง',
      });
    }
    setErrors(newErrors);
    setSubmitCount((c) => c + 1);
  }

  return (
    <form className="max-w-md space-y-4" noValidate onSubmit={handleSubmit}>
      <ErrorSummary errors={errors} submitCount={submitCount} />
      <div>
        <Label htmlFor="demo-name">ชื่อผู้ติดต่อ</Label>
        <Input
          id="demo-name"
          value={name}
          invalid={errors.some((err) => err.fieldId === 'demo-name')}
          aria-describedby={errors.some((err) => err.fieldId === 'demo-name') ? 'demo-name-error' : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        {errors.some((err) => err.fieldId === 'demo-name') && (
          <FieldError id="demo-name-error">กรุณากรอกชื่อ-นามสกุล</FieldError>
        )}
      </div>
      <div>
        <Label htmlFor="demo-detail">รายละเอียด</Label>
        <Textarea
          id="demo-detail"
          value={detail}
          invalid={errors.some((err) => err.fieldId === 'demo-detail')}
          aria-describedby={errors.some((err) => err.fieldId === 'demo-detail') ? 'demo-detail-error' : undefined}
          onChange={(e) => setDetail(e.target.value)}
        />
        {errors.some((err) => err.fieldId === 'demo-detail') && (
          <FieldError id="demo-detail-error">กรุณากรอกรายละเอียดเรื่องที่แจ้ง</FieldError>
        )}
      </div>
      <Button type="submit">ส่งข้อมูลเพื่อตรวจสอบ</Button>
    </form>
  );
}

export const ErrorSummaryPattern: Story = {
  render: () => <ErrorSummaryExample />,
};
