'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';
import { Label, Input } from '@/components/ui/field';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/cn';
import {
  RICH_MENU_TEMPLATES,
  areaStyle,
  templateByKey,
  validateArea,
  type RichMenuArea,
} from '../rich-menu-templates';

export function RichMenuBuilderClient() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [chatBarText, setChatBarText] = useState('เมนูหลัก');
  const [templateKey, setTemplateKey] = useState(RICH_MENU_TEMPLATES[0]!.key);
  const [areas, setAreas] = useState<RichMenuArea[]>(() =>
    structuredClone(templateByKey(RICH_MENU_TEMPLATES[0]!.key).areas),
  );
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const template = templateByKey(templateKey);

  function pickTemplate(key: string) {
    setTemplateKey(key);
    setAreas(structuredClone(templateByKey(key).areas));
    setSelected(0);
    setError(null);
  }

  function setAreaAction(index: number, patch: Partial<RichMenuArea['action']>) {
    setAreas((prev) => prev.map((a, i) => (i === index ? { ...a, action: { ...a.action, ...patch } } : a)));
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('กรุณากรอกชื่อเมนู');
      return;
    }
    for (let i = 0; i < areas.length; i++) {
      const problem = validateArea(areas[i]!.action);
      if (problem) {
        setSelected(i);
        setError(`พื้นที่ ${i + 1}: ${problem}`);
        return;
      }
    }
    setSaving(true);
    setError(null);
    const res = await adminApi.createRichMenu({
      name: name.trim(),
      chatBarText: chatBarText.trim() || 'เมนูหลัก',
      config: {
        size: template.size,
        selected: true,
        name: name.trim(),
        chatBarText: chatBarText.trim() || 'เมนูหลัก',
        areas,
      },
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push('/admin/chatbot/rich-menus');
  }

  const current = areas[selected];

  return (
    <div className="space-y-4">
      {error && (
        <p role="status" className="rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      <AdminCard>
        <AdminCardTitle icon={<LayoutGrid className="h-4 w-4" />}>ข้อมูลพื้นฐาน</AdminCardTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="rb-name">ชื่อเมนู</Label>
            <Input
              id="rb-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น Main Menu v2"
            />
          </div>
          <div>
            <Label htmlFor="rb-bar">Chat Bar Text</Label>
            <Input
              id="rb-bar"
              value={chatBarText}
              onChange={(e) => setChatBarText(e.target.value)}
              placeholder="เมนูหลัก"
            />
          </div>
        </div>
        <div className="mt-3">
          <Label>เทมเพลต</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {RICH_MENU_TEMPLATES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => pickTemplate(t.key)}
                aria-pressed={templateKey === t.key}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm font-medium',
                  templateKey === t.key
                    ? 'border-accent-strong bg-accent/5 text-accent-strong'
                    : 'border-border/50 text-muted hover:text-ink',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <AdminCardTitle icon={<LayoutGrid className="h-4 w-4" />}>
          พื้นที่ปุ่ม ({areas.length} พื้นที่)
        </AdminCardTitle>
        <div
          className="relative aspect-[2500/1686] w-full overflow-hidden rounded-lg border border-border"
          role="group"
          aria-label="ตัวอย่าง layout เมนู"
        >
          {areas.map((a, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(i)}
              aria-label={`พื้นที่ ${i + 1}`}
              aria-pressed={selected === i}
              className={cn(
                'absolute flex items-center justify-center border text-lg font-bold',
                selected === i
                  ? 'border-accent-strong bg-accent/20 text-accent-strong'
                  : 'border-border bg-surface-sunken/60 text-muted hover:bg-accent/10',
              )}
              style={areaStyle(a.bounds, template.size)}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {current && (
          <div className="mt-4 space-y-3 rounded-lg border border-border/50 p-4">
            <p className="text-sm font-semibold text-ink">พื้นที่ {selected + 1}</p>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  aria-label="เปิด URL"
                  name={`rb-action-${selected}`}
                  checked={current.action.type === 'uri'}
                  onChange={() => setAreaAction(selected, { type: 'uri', uri: '' })}
                />
                เปิด URL
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  aria-label="ส่งข้อความ"
                  name={`rb-action-${selected}`}
                  checked={current.action.type === 'message'}
                  onChange={() => setAreaAction(selected, { type: 'message', text: '' })}
                />
                ส่งข้อความ
              </label>
            </div>
            {current.action.type === 'uri' ? (
              <div>
                <Label htmlFor={`rb-uri-${selected}`}>URL (https เท่านั้น)</Label>
                <Input
                  id={`rb-uri-${selected}`}
                  value={current.action.uri ?? ''}
                  onChange={(e) => setAreaAction(selected, { uri: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            ) : (
              <div>
                <Label htmlFor={`rb-text-${selected}`}>ข้อความที่จะส่ง</Label>
                <Input
                  id={`rb-text-${selected}`}
                  value={current.action.text ?? ''}
                  onChange={(e) => setAreaAction(selected, { text: e.target.value })}
                  placeholder="เช่น ติดต่อเจ้าหน้าที่"
                />
              </div>
            )}
          </div>
        )}
      </AdminCard>

      <div className="flex justify-end">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'กำลังบันทึก...' : 'สร้างเมนู'}
        </Button>
      </div>
    </div>
  );
}
