import { Users, UserCheck, UserX, Clock3, Fingerprint } from 'lucide-react';
import { DashboardCard } from '@/components/shell/DashboardCard';
import { useDashboardSummary } from '@/hooks/useDashboard';

export function SummaryCards() {
  const { data: summary, isLoading } = useDashboardSummary();
  const v = (n: number | undefined) => (isLoading || n == null ? '—' : n.toLocaleString());

  const presentPct =
    summary && summary.totalEmployees > 0
      ? `${Math.round((summary.presentToday / summary.totalEmployees) * 100)}%`
      : undefined;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <DashboardCard icon={Users} label="Total Employees" value={v(summary?.totalEmployees)} tone="default" />
      <DashboardCard
        icon={UserCheck}
        label="Present Today"
        value={v(summary?.presentToday)}
        secondary={presentPct}
        tone="success"
      />
      <DashboardCard icon={UserX} label="Absent Today" value={v(summary?.absentToday)} tone="danger" />
      <DashboardCard icon={Clock3} label="Late Today" value={v(summary?.lateToday)} tone="warning" />
      <DashboardCard
        icon={Fingerprint}
        label="Device Status"
        value={summary?.deviceStatus ?? '—'}
        secondary={summary?.deviceName ?? 'No device'}
        tone={summary?.deviceStatus === 'ONLINE' ? 'success' : summary?.deviceStatus === 'OFFLINE' ? 'danger' : 'default'}
      />
    </div>
  );
}
