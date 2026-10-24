'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface DetailRow {
  label: string;
  value: ReactNode;
}

interface DetailModalAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'outline' | 'ghost' | 'destructive';
}

export function DetailModal({
  title,
  description,
  open,
  onClose,
  rows,
  renderExtra,
  actions,
}: {
  title: string;
  description?: string;
  open: boolean;
  onClose: () => void;
  rows: DetailRow[];
  renderExtra?: ReactNode;
  actions?: DetailModalAction[];
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="mb-1 text-xs text-muted">{row.label}</dt>
              <dd className="text-sm text-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
        {renderExtra}
        <div className="flex justify-end gap-2">
          {(actions ?? [{ label: 'ปิด', onClick: onClose, variant: 'outline' }]).map((action) => (
            <Button key={action.label} variant={action.variant ?? 'outline'} size="sm" onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
