import type { Meta, StoryObj } from '@storybook/react';
import { ArrowRight } from 'lucide-react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'ui/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'แจ้งเรื่องใหม่' },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'destructive', 'ghost'] },
    size: { control: 'select', options: ['md', 'lg'] },
  },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { variant: 'primary' } };
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Destructive: Story = {
  args: { variant: 'destructive', children: 'ลบเรื่อง' },
};
export const Ghost: Story = { args: { variant: 'ghost', children: 'ยกเลิก' } };
export const WithIcon: Story = {
  args: {
    variant: 'primary',
    children: (
      <>
        แจ้งเรื่องใหม่
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </>
    ),
  },
};
export const Disabled: Story = { args: { variant: 'primary', disabled: true } };