'use client';

import { useEffect, useState } from 'react';
import { Settings, Save, Wifi, WifiOff } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';
import { Label, Input, Textarea } from '@/components/ui/field';

interface SettingsData {
  welcome_message: string;
  handoff_keywords: string[];
  business_hours: { start: string; end: string; days: number[] };
  bot_enabled: boolean;
  line: { configured: boolean; maskedToken: string | null };
}

const DAY_LABELS = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export function SettingsClient() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [keywordsText, setKeywordsText] = useState('');

  useEffect(() => {
    fetch('/api/line/admin/settings')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((d: SettingsData) => {
        setData(d);
        setKeywordsText(d.handoff_keywords.join(', '));
      })
      .catch(() => setFeedback({ type: 'error', msg: 'โหลดตั้งค่าไม่สำเร็จ' }))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/line/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          welcome_message: data.welcome_message,
          handoff_keywords: keywordsText.split(',').map((k) => k.trim()).filter(Boolean),
          business_hours: data.business_hours,
          bot_enabled: data.bot_enabled,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'บันทึกไม่สำเร็จ');
      }
      setFeedback({ type: 'success', msg: 'บันทึกตั้งค่าสำเร็จ' });
    } catch (err) {
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  }

  function toggleDay(day: number) {
    if (!data) return;
    const days = data.business_hours.days.includes(day)
      ? data.business_hours.days.filter((d) => d !== day)
      : [...data.business_hours.days, day].sort();
    setData({ ...data, business_hours: { ...data.business_hours, days } });
  }

  if (loading) return <div className="py-12 text-center text-muted">กำลังโหลด...</div>;
  if (!data) return null;

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
              onChange={(e) => setData({ ...data, bot_enabled: e.target.checked })}
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
              onChange={(e) => setData({ ...data, welcome_message: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="handoff-kw">Handoff Keywords (คั่นด้วย comma)</Label>
            <Input
              id="handoff-kw"
              value={keywordsText}
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
                onChange={(e) => setData({ ...data, business_hours: { ...data.business_hours, start: e.target.value } })}
                className="w-32"
              />
            </div>
            <div>
              <Label htmlFor="hours-end">ปิด</Label>
              <Input
                id="hours-end"
                type="time"
                value={data.business_hours.end}
                onChange={(e) => setData({ ...data, business_hours: { ...data.business_hours, end: e.target.value } })}
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
