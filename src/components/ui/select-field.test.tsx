// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fieldPad, fieldPadEndGlyph, fieldPadIcon, fieldPadIconReveal, selectTriggerClass } from './control-styles';
import { Dialog, DialogContent, DialogTitle } from './dialog';
import { SelectField } from './select';

beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

function Harness() {
  const [value, setValue] = useState('');
  return (
    <SelectField
      ariaLabel="สถานะ"
      value={value}
      onValueChange={setValue}
      options={[
        { value: '', label: 'ทุกสถานะ' },
        { value: 'sent', label: 'ส่งแล้ว' },
      ]}
    />
  );
}

describe('control padding', () => {
  it('ไม่ใส่ px คู่กับ pl หรือ pr ในคลาสเดียวกัน', () => {
    for (const cls of [fieldPad, fieldPadIcon, fieldPadIconReveal, fieldPadEndGlyph, selectTriggerClass]) {
      const hasPx = /\bpx-/.test(cls);
      const hasSide = /\b(?:pl|pr)-/.test(cls);
      expect(hasPx && hasSide).toBe(false);
    }
  });
});

describe('SelectField', () => {
  it('เว้นระยะเชฟรอนจากขอบและไม่ให้ข้อความทับไอคอน', () => {
    render(
      <SelectField
        ariaLabel="สถานะ"
        value="sent"
        onValueChange={vi.fn()}
        options={[{ value: 'sent', label: 'ส่งแล้วเป็นข้อความที่ยาวมาก' }]}
      />,
    );

    const trigger = screen.getByRole('combobox', { name: 'สถานะ' });
    expect(trigger.className).toContain('pr-5');
    expect(trigger.className).toContain('pl-4');
    expect(trigger.className).not.toContain('px-2');
    const label = trigger.querySelector('span');
    expect(label?.className).toContain('truncate');
    const icon = trigger.querySelector('svg');
    expect(icon?.getAttribute('class')).toContain('shrink-0');
  });

  it('ค่าว่างเลือกได้และแปลงกลับเป็นสตริงว่าง', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByRole('combobox', { name: 'สถานะ' })).toHaveTextContent('ทุกสถานะ');
    await user.click(screen.getByRole('combobox', { name: 'สถานะ' }));
    await user.click(await screen.findByRole('option', { name: 'ส่งแล้ว' }));
    expect(screen.getByRole('combobox', { name: 'สถานะ' })).toHaveTextContent('ส่งแล้ว');

    await user.click(screen.getByRole('combobox', { name: 'สถานะ' }));
    await user.click(await screen.findByRole('option', { name: 'ทุกสถานะ' }));
    expect(screen.getByRole('combobox', { name: 'สถานะ' })).toHaveTextContent('ทุกสถานะ');
  });

  it('ตัวเลือกที่ปิดไว้กดแล้วค่าไม่เปลี่ยน และความกว้างอยู่ที่กรอบนอก', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>เลือกเมนู</DialogTitle>
          <SelectField
            ariaLabel="เมนู"
            value=""
            onValueChange={onValueChange}
            className="w-full sm:w-48"
            options={[
              { value: '', label: 'เลือกเมนู...' },
              { value: 'ok', label: 'เมนูหลัก' },
              { value: 'bad', label: 'ใช้ไม่ได้', disabled: true },
            ]}
          />
        </DialogContent>
      </Dialog>,
    );

    const trigger = screen.getByRole('combobox', { name: 'เมนู' });
    expect(trigger.parentElement?.className).toContain('sm:w-48');
    await user.click(trigger);
    const blocked = await screen.findByRole('option', { name: 'ใช้ไม่ได้' });
    expect(blocked).toHaveAttribute('data-disabled');
    await user.click(blocked);
    expect(onValueChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('option', { name: 'เมนูหลัก' }));
    expect(onValueChange).toHaveBeenCalledWith('ok');
  });
});
