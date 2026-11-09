import type { RichMenuAliasItem, RichMenuItem } from '@/app/admin/_lib/admin-api';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select';

export function AliasList({
  aliases,
  syncedMenus,
  onRepoint,
  onDelete,
}: {
  aliases: RichMenuAliasItem[];
  syncedMenus: RichMenuItem[];
  onRepoint: (alias: string, menuId: string) => void;
  onDelete: (alias: string) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      {aliases.map((a) => (
        <div key={a.aliasId} className="flex flex-col gap-2 rounded-lg border border-border/50 p-3 sm:flex-row sm:items-center">
          <code className="font-mono text-sm font-medium text-ink">{a.aliasId}</code>
          <span className="text-xs text-muted">→ {a.menuName ?? '(เมนูถูกลบ?)'}</span>
          <div className="flex gap-1 sm:ml-auto">
            <SelectField
              ariaLabel={`ย้ายเป้า ${a.aliasId}`}
              value=""
              onValueChange={(next) => {
                if (next) onRepoint(a.aliasId, next);
              }}
              options={[
                { value: '', label: 'ย้ายเป้า…' },
                ...syncedMenus.map((m) => ({ value: m.id, label: m.name })),
              ]}
              className="w-44 shrink-0"
            />
            <Button variant="outline" size="sm" onClick={() => onDelete(a.aliasId)}>ลบ</Button>
          </div>
        </div>
      ))}
      {aliases.length === 0 && (
        <p className="py-4 text-center text-sm text-muted">ยังไม่มี alias — ปุ่ม richmenuswitch ในเมนูอ้างชื่อนี้เพื่อสลับ tab</p>
      )}
    </div>
  );
}
