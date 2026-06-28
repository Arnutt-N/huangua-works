import type { Meta, StoryObj } from '@storybook/react';
import { CaseStatusBadge, type CaseStatus } from './case-status-badge';

const meta: Meta<typeof CaseStatusBadge> = {
  title: 'ui/CaseStatusBadge',
  component: CaseStatusBadge,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof CaseStatusBadge>;

const all: CaseStatus[] = [
  'received',
  'reviewing',
  'assigned',
  'in_progress',
  'done',
  'closed',
  'urgent',
];

export const AllStatuses: Story = {
  render: () => (
    <ul className="flex flex-wrap gap-3">
      {all.map((s) => (
        <li key={s}>
          <CaseStatusBadge status={s} />
        </li>
      ))}
    </ul>
  ),
};

export const Urgent: Story = { args: { status: 'urgent' } };