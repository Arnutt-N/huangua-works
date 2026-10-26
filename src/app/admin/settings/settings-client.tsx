'use client';

import { useState } from 'react';
import { adminApi, type LineQuotaData } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';
import { describeLineQuota } from '@/lib/line/quota';
import { Settings, Save, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';
import { Label, Input, Textarea } from '@/components/ui/field';
import { BUSINESS_DAY_LABELS as DAY_LABELS } from '@/lib/line/business-hours';

function formatQuotaLabel(
  quota: LineQuotaData | null,
  loading: boolean,
  errorMsg: string | null,
): string {
  if (errorMsg) return errorMsg;
  if (loading && !quota) return 'กำลังโหลดโควต้า...';
  return describeLineQuota(quota);
}

export function SettingsClient() {
  const { data, loading, feedback, error, errorCode, clearFeedback, mutate, setData, reload } = useResource({
    load: adminApi.getSettings,
  });
  // § ตั้งค่ากลางโหลดแยกอีกก้อน รูปเดียวกับบอท: derive ค่าจาก server แทน useEffect setState
  const system = useResource({ load: adminApi.getSystemSettings });
  const conns = useResource({ load: adminApi.listApiConnections });
  const quota = useResource({ load: adminApi.getLineQuota });
  const [quotaRefreshing, setQuotaRefreshing] = useState(false);
  const [sysSaving, setSysSaving] = useState(false);
  const [maintenance, setMaintenance] = useState<boolean | null>(null);
  const [retentionText, setRetentionText] = useState<string | null>(null);
  const maintenanceValue = maintenance ?? system.data?.maintenance_mode ?? false;
  const retentionValue = retentionText ?? String(system.data?.audit_retention_days ?? 365);
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
          line_notify_enabled: data.line_notify_enabled,
        }),
      'บันทึกตั้งค่าสำเร็จ',
      { reload: false }, // คงค่าที่ผู้ใช้แก้ค้างไว้ในหน้า — ไม่ดึงทับจาก server
    );
    setSaving(false);
  }

  async function handleRefreshQuota() {
    setQuotaRefreshing(true);
    quota.clearFeedback();
    const res = await adminApi.refreshLineQuota();
    if (res.ok) {
      quota.setData(() => res.data);
    } else {
      quota.setData(() => null);
      quota.notify('error', res.error);
    }
    setQuotaRefreshing(false);
  }

  async function handleSystemSave() {
    const days = Number(retentionValue);
    if (!Number.isInteger(days) || days < 30 || days > 3650) {
      system.clearFeedback();
      await system.mutate(() => Promise.resolve({ ok: false as const, error: 'จำนวนวันต้องอยู่ระหว่าง 30 ถึง 3650', status: 400 }), 'บันทึกตั้งค่ากลางสำเร็จ', { reload: false });
      return;
    }
    setSysSaving(true);
    system.clearFeedback();
    await system.mutate(
      () => adminApi.saveSystemSettings({ maintenance_mode: maintenanceValue, audit_retention_days: days }),
      'บันทึกตั้งค่ากลางสำเร็จ',
      { reload: false },
    );
    setSysSaving(false);
  }

  async function handleRefresh(provider: string) {
    await conns.mutate(() => adminApi.refreshApiConnection(provider), 'ตรวจสถานะสำเร็จ', { reload: true });
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
          ตั้งค่ากลางระบบ
        </AdminCardTitle>
        {system.loading ? (
          <div className="py-4 text-center text-sm text-muted">กำลังโหลด...</div>
        ) : system.data ? (
          <div className="space-y-5">
            {system.feedback && (
              <div role="status" className={`rounded-lg px-4 py-3 text-sm font-medium ${system.feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                {system.feedback.msg}
              </div>
            )}
            <label className="flex min-h-touch items-center gap-3">
              <input
                type="checkbox"
                aria-label="โหมดปิดปรับปรุงระบบ"
                checked={maintenanceValue}
                onChange={(e) => setMaintenance(e.target.checked)}
                className="h-5 w-5 rounded border-border accent-accent"
              />
              <span className="text-sm font-medium text-ink">โหมดปิดปรับปรุงระบบ</span>
            </label>
            <div>
              <Label htmlFor="retention-days">เก็บ log นาน (วัน, 30 ถึง 3650)</Label>
              <Input
                id="retention-days"
                type="number"
                min={30}
                max={3650}
                value={retentionValue}
                onChange={(e) => setRetentionText(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="text-sm text-muted">องค์กรเริ่มต้น: {system.data.import_default_org}</div>
            <div className="flex justify-end">
              <Button onClick={handleSystemSave} disabled={sysSaving} className="min-h-touch gap-2">
                <Save className="h-4 w-4" />
                {sysSaving ? 'กำลังบันทึก...' : 'บันทึกตั้งค่ากลาง'}
              </Button>
            </div>
          </div>
        ) : null}
      </AdminCard>

      <AdminCard>
        <AdminCardTitle>การเชื่อมต่อภายนอก</AdminCardTitle>
        {conns.loading ? (
          <div className="py-4 text-center text-sm text-muted">กำลังโหลด...</div>
        ) : (
          <div className="space-y-3">
            {conns.feedback && (
              <div role="status" className={`rounded-lg px-4 py-3 text-sm font-medium ${conns.feedback.type === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                {conns.feedback.msg}
              </div>
            )}
            {(conns.data?.items ?? []).map((conn) => (
              <div key={conn.provider} className="flex min-h-touch items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                <div className="text-sm">
                  <span className="font-medium text-ink">{conn.provider}</span>
                  <span className="text-muted"> — {conn.status}{conn.lastCheckedAt ? ` (ตรวจล่าสุด ${conn.lastCheckedAt})` : ''}</span>
                </div>
                <Button onClick={() => handleRefresh(conn.provider)} className="min-h-touch" variant="secondary">
                  ตรวจใหม่
                </Button>
              </div>
            ))}
            {(conns.data?.items ?? []).length === 0 && (
              <div className="text-sm text-muted">ยังไม่เคยกดตรวจ กดตรวจใหม่เพื่อเพิ่มรายการ</div>
            )}
          </div>
        )}
      </AdminCard>

      <AdminCard>
        <AdminCardTitle icon={<Settings className="h-4 w-4" />}>
          สถานะ LINE Channel
        </AdminCardTitle>
        <div className="space-y-3">
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
          {data.line.configured && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div className="text-sm">
                <span className="font-medium text-ink">
                  {formatQuotaLabel(
                    quota.data,
                    quota.loading || quotaRefreshing,
                    quota.feedback?.type === 'error' ? quota.feedback.msg : null,
                  )}
                </span>
                <p className="text-xs text-muted">
                  ยอดโควต้าจาก LINE อาจอัปเดตล่าช้าประมาณ 1 นาที (แคช 5 นาที)
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleRefreshQuota}
                disabled={quotaRefreshing || quota.loading}
                aria-label="รีเฟรชโควต้า LINE"
                className="min-h-touch gap-1.5"
              >
                <RefreshCw className={`h-4 w-4 ${quotaRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
                รีเฟรชโควต้า
              </Button>
            </div>
          )}
        </div>
      </AdminCard>

      <AdminCard>
        <AdminCardTitle>พฤติกรรมบอท</AdminCardTitle>
        <div className="space-y-5">
          <label className="flex min-h-touch items-center gap-3">
            <input
              type="checkbox"
              aria-label="เปิดใช้งานบอทตอบอัตโนมัติ"
              checked={data.bot_enabled}
              onChange={(e) => setData((prev) => (prev ? { ...prev, bot_enabled: e.target.checked } : prev))}
              className="h-5 w-5 rounded border-border accent-accent"
            />
            <span className="text-sm font-medium text-ink">เปิดใช้งานบอทตอบอัตโนมัติ</span>
          </label>

          <label className="flex min-h-touch items-center gap-3">
            <input
              type="checkbox"
              aria-label="แจ้งเตือนทาง LINE"
              checked={data.line_notify_enabled}
              onChange={(e) =>
                setData((prev) => (prev ? { ...prev, line_notify_enabled: e.target.checked } : prev))
              }
              className="h-5 w-5 rounded border-border accent-accent"
            />
            <span className="text-sm font-medium text-ink">แจ้งเตือนทาง LINE (ส่งข้อความ Push อัตโนมัติ)</span>
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
