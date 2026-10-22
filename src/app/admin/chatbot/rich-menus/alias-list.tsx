import type { RichMenuAliasItem, RichMenuItem } from '@/app/admin/_lib/admin-api';
import { Button } from '@/components/ui/button';

/**
 * รายการ alias ร่วม 2 หน้า (rich-menus + aliases) — JSX เดียว
 *
 * § ฟอร์มสร้างไม่รวม: หน้า aliases ใช้ formError ในฟอร์ม ส่วนหน้า rich-menus ใช้
 * notify ของ useResource — รวมฟอร์มด้วยจะยึดช่องแสดง error ข้างหนึ่ง
 */
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
            <select
              aria-label={`ย้ายเป้า ${a.aliasId}`}
              defaultValue=""
              onChange={(e) => onRepoint(a.aliasId, e.target.value)}
              className="min-h-touch rounded-lg border border-border/50 bg-surface px-2 text-xs"
            >
              <option value="">ย้ายเป้า…</option>
              {syncedMenus.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <Button variant="outline" onClick={() => onDelete(a.aliasId)} className="min-h-touch text-xs">ลบ</Button>
          </div>
        </div>
      ))}
      {aliases.length === 0 && (
        <p className="py-4 text-center text-sm text-muted">ยังไม่มี alias — ปุ่ม richmenuswitch ในเมนูอ้างชื่อนี้เพื่อสลับ tab</p>
      )}
    </div>
  );
}
