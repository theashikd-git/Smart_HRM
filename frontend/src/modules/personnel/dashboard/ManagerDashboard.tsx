'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import { MyCalendarCard } from '@/modules/employee-portal/MyCalendarCard';
import { MyLeaveRequestModal } from '@/modules/employee-portal/MyLeaveRequestModal';
import { RealTimeMonitor } from './RealTimeMonitor';

function useGreeting() {
  const [greeting, setGreeting] = useState('Hello');
  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening');
  }, []);
  return greeting;
}

/**
 * Dashboard landing view for a Manager-role login. Deliberately NOT the
 * admin-style PersonnelDashboard (SummaryCards, AttendanceTrend/Overview,
 * DepartmentAttendanceTable, TodaysAttendance, PendingApprovals,
 * RecentActivity, QuickActions) -- a Manager sees the same "Dashboard" a
 * plain Employee Portal login does (just My Calendar, with Apply Leave),
 * with only the Real-Time Monitor added beside it for their team's live
 * punches. Still rendered inside the normal Workbench shell
 * (TopNavigation/WorkbenchBar/Sidebar), unlike the Employee Portal's own
 * separate shell -- a Manager still needs to reach Leave/Personnel/Device
 * from the top nav, an Employee Portal login doesn't.
 *
 * See PersonnelDashboard, which renders this instead of itself for
 * user.role === 'MANAGER'.
 */
export function ManagerDashboard() {
  const greeting = useGreeting();
  const user = useAuthStore((s) => s.user);
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const [requestOpen, setRequestOpen] = useState(false);

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden p-4">
      <div className="shrink-0">
        <h1 className="text-[15px] font-semibold text-text-primary">Dashboard</h1>
        <p className="text-xs text-text-secondary">
          {greeting}, {user?.fullName || 'there'} &middot; {today}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        <div className="min-w-0 flex-1">
          <MyCalendarCard onApplyLeave={() => setRequestOpen(true)} />
        </div>
        <div className="w-full shrink-0 md:w-96">
          <RealTimeMonitor />
        </div>
      </div>

      <MyLeaveRequestModal open={requestOpen} onClose={() => setRequestOpen(false)} />
    </div>
  );
}
