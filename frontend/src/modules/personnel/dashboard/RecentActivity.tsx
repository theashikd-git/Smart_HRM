'use client';

import { useDashboardSummary } from '@/hooks/useDashboard';
import { formatDateTime } from '@/lib/utils';

export function RecentActivity() {
  const { data: summary, isLoading } = useDashboardSummary();
  const activity = summary?.recentActivity ?? [];

  return (
    <div className="rounded border border-line bg-white">
      <div className="border-b border-line px-3.5 py-2.5">
        <h3 className="text-[13px] font-semibold text-text-primary">Recent Activity</h3>
      </div>
      {isLoading && <p className="px-3.5 py-4 text-xs text-text-muted">Loading...</p>}
      {!isLoading && activity.length === 0 && <p className="px-3.5 py-4 text-xs text-text-muted">No recent activity yet.</p>}
      <ul className="divide-y divide-line">
        {activity.slice(0, 8).map((a) => (
          <li key={a.id} className="flex gap-3 px-3.5 py-2.5">
            <span className="w-28 shrink-0 text-[11px] text-text-muted">{formatDateTime(a.createdAt)}</span>
            <span className="text-xs text-text-primary">
              {a.action.replaceAll('_', ' ')}
              <span className="text-text-muted"> &middot; {a.user?.fullName || 'System'}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
