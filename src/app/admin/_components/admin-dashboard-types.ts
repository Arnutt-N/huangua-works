import type { CaseStatus } from '@/lib/cases/state-machine';

export interface DailyTrendPoint {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "4 พ.ย."
  received: number;
  closed: number;
}

export interface StatusBreakdownItem {
  status: CaseStatus;
  count: number;
  label: string;
}

export interface CategoryBreakdownItem {
  id: string | null;
  name: string;
  count: number;
  percentage: number;
}

export interface DepartmentBreakdownItem {
  id: string | null;
  name: string;
  count: number;
  percentage: number;
}

export interface DashboardMetrics {
  totalReceived: number;
  totalInProgress: number;
  totalClosed: number;
  avgResolutionDays: number | null;
  slaBreach: number;
  resolutionRate: number; // 0-100
  recentIntakeVelocity: number; // จำนวนเรื่องรับใน 7 วันล่าสุด
  lastUpdatedDateText: string;
}
