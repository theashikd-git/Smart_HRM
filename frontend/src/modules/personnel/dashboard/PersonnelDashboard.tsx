'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { useMyTeamAttendance } from '@/hooks/useDashboard';
import { SummaryCards } from './SummaryCards';
import { AttendanceOverview } from './AttendanceOverview';
import { AttendanceTrend } from './AttendanceTrend';
import { DepartmentAttendanceTable } from './DepartmentAttendanceTable';
import { MyTeamAttendance } from './MyTeamAttendance';
import { PendingApprovals } from './PendingApprovals';
import { TodaysAttendance } from './TodaysAttendance';
import { RecentActivity } from './RecentActivity';
import { QuickActions } from './QuickActions';

function useGreeting() {
  const [greeting, setGreeting] = useState('Hello');
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening');
  }, []);
  return greeting;
}

export function PersonnelDashboard() {
  const greeting = useGreeting();
  const user = useAuthStore((s) => s.user);
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  // Same query as MyTeamAttendance itself (React Query dedupes the request)
  // -- read here too so the <aside> column only takes up width when there's
  // actually a team to show, instead of leaving an empty gap for everyone else.
  const { data: myTeam } = useMyTeamAttendance();

  return (
    <div className="h-full overflow-auto bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-text-primary">Dashboard</h1>
          <p className="text-xs text-text-secondary">
            {greeting}, {user?.fullName || 'there'} &middot; {today}
          </p>
        </div>
        <QuickActions />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Left side -- only rendered at all for a department head, so it
            never leaves an empty gap for anyone else. */}
        {myTeam?.isManager && (
          <aside className="w-full shrink-0 lg:w-64">
            <MyTeamAttendance />
          </aside>
        )}

        <div className="min-w-0 flex-1 space-y-4">
          <SummaryCards />

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <AttendanceTrend />
            </div>
            <AttendanceOverview />
          </div>

          <DepartmentAttendanceTable />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TodaysAttendance />
            <div className="grid grid-cols-1 gap-4">
              <PendingApprovals />
              <RecentActivity />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
