import type { Meta, StoryObj } from '@storybook/react';
import { ALL_STATUSES } from '../../lib/cases/state-machine';
import { CaseStatusBadge } from './case-status-badge';

const meta: Meta<typeof CaseStatusBadge> = {
  title: 'ui/CaseStatusBadge',
  component: CaseStatusBadge,
  tags: ['autodocs'],
};
export default meta;

type Story = StoryObj<typeof CaseStatusBadge>;

export const AllStatuses: Story = {
  render: () => (
    <ul className="flex flex-wrap gap-3">
      {ALL_STATUSES.map((s) => (
        <li key={s}>
          <CaseStatusBadge status={s} />
        </li>
      ))}
    </ul>
  ),
};
