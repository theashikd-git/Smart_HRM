'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Users, UserCheck, UserX, Clock3, Fingerprint } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHeader } from '@/components/ui/Card';
import {
  useDashboardSummary,
  useWeeklyAttendance,
  useDepartmentAttendanceChart,
} from '@/hooks/useDashboard';
import { deviceStatusColors } from '@/lib/utils';
import { StatusPill } from '@/components/ui/Card';
import { formatDateTime } from '@/lib/utils';

function SummaryCard({
  label,
  value,
  icon: Icon,
  tint,
}: {
  label: string;
  value: number | string;
  icon: any;
  tint: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-text-secondary">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold text-text-primary tabular-nums">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tint}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: summary, isLoading } = useDashboardSummary();
  const { data: weekly } = useWeeklyAttendance();
  const { data: deptData } = useDepartmentAttendanceChart();

  const deviceColors = deviceStatusColors[summary?.deviceStatus || 'UNKNOWN'];

  return (
    <AppShell title="Dashboard" subtitle="Live overview of your workforce and biometric device">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <SummaryCard
          label="Total Employees"
          value={isLoading ? '—' : summary?.totalEmployees ?? 0}
          icon={Users}
          tint="bg-accent-soft text-accent-dark"
        />
        <SummaryCard
          label="Present Today"
          value={isLoading ? '—' : summary?.presentToday ?? 0}
          icon={UserCheck}
          tint="bg-success-soft text-success"
        />
        <SummaryCard
          label="Absent Today"
          value={isLoading ? '—' : summary?.absentToday ?? 0}
          icon={UserX}
          tint="bg-danger-soft text-danger"
        />
        <SummaryCard
          label="Late Employees"
          value={isLoading ? '—' : summary?.lateToday ?? 0}
          icon={Clock3}
          tint="bg-warning-soft text-warning"
        />
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-text-secondary">Device Status</p>
              <p className="mt-1.5 text-sm font-semibold text-text-primary truncate max-w-[120px]">
                {summary?.deviceName || 'No device'}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink/5 text-ink">
              <Fingerprint className="h-5 w-5" />
            </div>
          </div>
          {summary && (
            <div className="mt-3">
              <StatusPill
                label={summary.deviceStatus}
                colors={deviceColors}
                pulsing={summary.deviceStatus === 'ONLINE'}
              />
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
        <Card className="xl:col-span-2">
          <CardHeader title="Weekly Attendance" subtitle="Present vs. late vs. absent, last 7 days" />
          <div className="h-72 px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly || []}>
                <defs>
                  <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E6EB" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => new Date(v).toLocaleDateString(undefined, { weekday: 'short' })}
                  tick={{ fontSize: 11, fill: '#8A93A1' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#8A93A1' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #E3E6EB' }}
                  labelFormatter={(v) => new Date(v).toDateString()}
                />
                <Area type="monotone" dataKey="present" stroke="#16A34A" fill="url(#presentGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="late" stroke="#D97706" fill="url(#lateGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent Activity" subtitle="Latest actions across the system" />
          <div className="px-5 pb-5 space-y-4 max-h-72 overflow-y-auto">
            {(summary?.recentActivity || []).length === 0 && (
              <p className="text-xs text-text-muted">No recent activity yet.</p>
            )}
            {summary?.recentActivity.map((a) => (
              <div key={a.id} className="flex gap-3">
                <div className="mt-1 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                <div>
                  <p className="text-xs text-text-primary font-medium">
                    {a.action.replaceAll('_', ' ')}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {a.user?.fullName || 'System'} &middot; {formatDateTime(a.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Department Attendance" subtitle="Employees present today by department" />
        <div className="h-72 px-2 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={deptData || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E6EB" vertical={false} />
              <XAxis dataKey="department" tick={{ fontSize: 11, fill: '#8A93A1' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#8A93A1' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 10, border: '1px solid #E3E6EB' }} />
              <Bar dataKey="employees" fill="#E3F6F4" radius={[6, 6, 0, 0]} name="Total" />
              <Bar dataKey="present" fill="#0EA5A0" radius={[6, 6, 0, 0]} name="Present" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </AppShell>
  );
}
