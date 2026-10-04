'use client';

import { HeartPulse, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/app/admin/_lib/admin-api';
import { useResource } from '@/app/admin/_lib/use-resource';

export function HealthClient() {
  const { data, loading, feedback, reload } = useResource({
    load: adminApi.getHealth,
    intervalMs: 30_000,
    loadingOnReload: false, // คงพฤติกรรมเดิม: refresh ไม่ปิดข้อมูลระหว่างโหลด
  });

  if (loading) return <div className="py-12 text-center text-muted">กำลังตรวจสอบ...</div>;
  // § ห้าม return ก่อน banner — reload ล้มขณะมี data เดิมต้องเห็นข้อความจาก server ด้วย
  // health route คืน 401/403 `{ error: 'Unauthorized'|'Forbidden' }` เท่านั้น ไม่มี envelope อื่น
  const errorMsg = feedback?.type === 'error' ? feedback.msg : null;

  return (
    <AdminCard>
      <AdminCardTitle
        icon={<HeartPulse className="h-4 w-4" />}
        action={
          <Button variant="outline" onClick={() => void reload()} className="min-h-touch gap-1.5 text-sm">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        }
      >
        สถานะระบบ {data && (
          <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${data.status === 'healthy' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
            {data.status === 'healthy' ? 'ปกติ' : 'มีปัญหา'}
          </span>
        )}
      </AdminCardTitle>

      {errorMsg && <p className="text-sm text-danger">{errorMsg}</p>}

      {!data ? (
        <p className="text-sm text-danger">โหลดสถานะไม่สำเร็จ</p>
      ) : (
        <div className="space-y-3">
          {data.probes.map((probe) => (
            <div key={probe.name} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
              {probe.status === 'ok' ? (
                <CheckCircle2 className="h-5 w-5 flex-none text-success" />
              ) : (
                <XCircle className="h-5 w-5 flex-none text-danger" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{probe.name}</p>
                {probe.detail && <p className="truncate text-xs text-danger">{probe.detail}</p>}
              </div>
              <span className="flex-none text-xs tabular-nums text-muted">{probe.latencyMs}ms</span>
            </div>
          ))}
          <p className="text-right text-xs text-muted">
            อัปเดตล่าสุด: {new Date(data.timestamp).toLocaleTimeString('th-TH')}
          </p>
        </div>
      )}
    </AdminCard>
  );
}
