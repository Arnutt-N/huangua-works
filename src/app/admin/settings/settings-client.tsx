'use client';

import { useState } from 'react';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { Settings, Save, Wifi, WifiOff } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';
import { Label, Input, Textarea } from '@/components/ui/field';

const DAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export function SettingsClient() {
  const { data, loading, feedback, clearFeedback, mutate, setData } = useResource({
    load: adminApi.getSettings,
  });
  const [saving, setSaving] = useState(false);
  // § keywordsText = null แปลว่ายังไม่เคยพิมพ์ → derive ค่าจาก server แทนที่จะ
  //   useEffect setState (rule set-state-in-effect จับการ setState ใน effect)
  const [keywordsText, setKeywordsText] = useState<string | null>(null);
  const keywords = keywordsText ?? data?.handoff_keywords.join(', ') ?? '';

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    clearFeedback();
    await mutate(
      () =>
        adminApi.saveSettings({
          welcome_message: data.welcome_message,
          handoff_keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
          business_hours: data.business_hours,
          bot_enabled: data.bot_enabled,
        }),
      'บันทึกตั้งค่าสำเร็จ',
      { reload: false }, // คงค่าที่ผู้ใช้แก้ค้างไว้ในหน้า — ไม่ดึงทับจาก server
    );
    setSaving(false);
  }

  function toggleDay(day: number) {
    setData((prev) => {
      if (!prev) return prev;
      const days = prev.business_hours.days.includes(day)
        ? prev.business_hours.days.filter((d) => d !== day)
        : [...prev.business_hours.days, day].sort();
      return { ...prev, business_hours: { ...prev.business_hours, days } };
    });
  }

  if (loading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  // § ห้าม `if (!data) return null` ก่อน banner — โหลดครั้งแรกล้มต้องเห็น error ไม่ใช่หน้าว่าง
  if (!data) {
    return feedback?.type === 'error' ? (
      <div role="status" className="rounded-lg bg-danger/10 px-4 py-3 text-sm font-medium text-danger">
        {feedback.msg}
      </div>
    ) : null;
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm font-medium ${
            feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      <AdminCard>
        <AdminCardTitle icon={<Settings className="h-4 w-4" />}>
          สถานะ LINE Channel
        </AdminCardTitle>
        <div className="flex items-center gap-3">
          {data.line.configured ? (
            <>
              <Wifi className="h-5 w-5 text-success" />
              <span className="text-sm text-ink">
                เชื่อมต่อแล้ว (token: {data.line.maskedToken})
              </span>
            </>
          ) : (
            <>
              <WifiOff className="h-5 w-5 text-danger" />
              <span className="text-sm text-danger">
                ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN ใน environment
              </span>
            </>
          )}
        </div>
      </AdminCard>

      <AdminCard>
        <AdminCardTitle>พฤติกรรมบอท</AdminCardTitle>
        <div className="space-y-5">
          <label className="flex min-h-touch items-center gap-3">
            <input
              type="checkbox"
              checked={data.bot_enabled}
              onChange={(e) => setData((prev) => (prev ? { ...prev, bot_enabled: e.target.checked } : prev))}
              className="h-5 w-5 rounded border-border accent-accent"
            />
            <span className="text-sm font-medium text-ink">เปิดใช้งานบอทตอบอัตโนมัติ</span>
          </label>

          <div>
            <Label htmlFor="welcome-msg">ข้อความต้อนรับ (follow event)</Label>
            <Textarea
              id="welcome-msg"
              rows={5}
              value={data.welcome_message}
              onChange={(e) => setData((prev) => (prev ? { ...prev, welcome_message: e.target.value } : prev))}
            />
          </div>

          <div>
            <Label htmlFor="handoff-kw">Handoff Keywords (คั่นด้วย comma)</Label>
            <Input
              id="handoff-kw"
              value={keywords}
              onChange={(e) => setKeywordsText(e.target.value)}
              placeholder="ติดต่อเจ้าหน้าที่, เจ้าหน้าที่, คุยกับคน"
            />
          </div>
        </div>
      </AdminCard>

      <AdminCard>
        <AdminCardTitle>เวลาทำการ</AdminCardTitle>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`min-h-touch min-w-touch rounded-lg border px-3 text-sm font-medium transition-colors ${
                  data.business_hours.days.includes(i)
                    ? 'border-accent bg-accent/10 text-accent-strong'
                    : 'border-border text-muted hover:border-accent/50'
                }`}
                aria-pressed={data.business_hours.days.includes(i)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div>
              <Label htmlFor="hours-start">เปิด</Label>
              <Input
                id="hours-start"
                type="time"
                value={data.business_hours.start}
                onChange={(e) =>
                  setData((prev) =>
                    prev
                      ? { ...prev, business_hours: { ...prev.business_hours, start: e.target.value } }
                      : prev,
                  )
                }
                className="w-32"
              />
            </div>
            <div>
              <Label htmlFor="hours-end">ปิด</Label>
              <Input
                id="hours-end"
                type="time"
                value={data.business_hours.end}
                onChange={(e) =>
                  setData((prev) =>
                    prev
                      ? { ...prev, business_hours: { ...prev.business_hours, end: e.target.value } }
                      : prev,
                  )
                }
                className="w-32"
              />
            </div>
          </div>
        </div>
      </AdminCard>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="min-h-touch gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'กำลังบันทึก...' : 'บันทึกตั้งค่า'}
        </Button>
      </div>
    </div>
  );
}
