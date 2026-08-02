'use client';

import { useCallback, useEffect, useState } from 'react';
import { HeartPulse, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { AdminCard, AdminCardTitle } from '@/components/admin/admin-card';
import { Button } from '@/components/ui/button';

interface Probe {
  name: string;
  status: 'ok' | 'error';
  latencyMs: number;
  detail?: string;
}

interface HealthData {
  status: string;
  probes: Probe[];
  timestamp: string;
}

export function HealthClient() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/line/admin/health');
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading) return <div className="py-12 text-center text-muted">กำลังตรวจสอบ...</div>;

  return (
    <AdminCard>
      <AdminCardTitle
        icon={<HeartPulse className="h-4 w-4" />}
        action={
          <Button variant="outline" onClick={fetchHealth} className="min-h-touch gap-1.5 text-sm">
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
