'use client';

import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserMenu } from '@/components/shell/UserMenu';
import { NotificationBell } from '@/components/shell/NotificationBell';
import { useMyApprovals } from '@/hooks/useLeave';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { MyLeaveRequestModal } from './MyLeaveRequestModal';
import { MyCalendarCard } from './MyCalendarCard';
import { MyLeaveTab } from './MyLeaveTab';
import { LeaveRequestTab } from './LeaveRequestTab';
import { ChangePasswordGate } from './ChangePasswordGate';
import { useAuthStore } from '@/lib/auth-store';

type PortalTab = 'dashboard' | 'my-leave' | 'leave-request';

const BASE_TABS: { id: PortalTab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'my-leave', label: 'My Leave' },
];

/**
 * Self-service home for an EMPLOYEE-role login (see /login's "Employee
 * Login" mode). Deliberately its own small shell -- not the Workbench --
 * since an employee should only ever see their own balances, requests, and
 * a way to apply/cancel; useRequireAuth('employee') keeps staff logins out
 * of this route and bounces an EMPLOYEE login away from /workbench.
 *
 * Three sections behind a top-nav, same tab-bar visual language as the
 * Workbench's TopNavigation: "Dashboard" is just My Calendar (the day-to-day
 * landing view), "My Leave" is this employee's own leave -- balances, the
 * request history table, and the Apply for Leave action (see MyLeaveTab).
 * "Leave Request" only shows up once this login is actually named
 * somewhere in a leave workflow -- it's every request they can currently
 * decide on, plus the record of what they've approved/rejected before (see
 * LeaveRequestTab). The exact same two tabs are reused as-is on the Manager
 * Portal (see ManagerPortalView), so a Manager gets identical self-service
 * leave regardless of which login path they came in through.
 */
export function EmployeePortalView() {
  const { ready } = useRequireAuth('employee');
  const user = useAuthStore((s) => s.user);
  const [requestOpen, setRequestOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<PortalTab>('dashboard');

  // Only shown once there's something to show -- most employees are never
  // named a workflow approver, so a permanently-visible empty tab would
  // just be clutter for them. See LeaveController.findMyApprovals.
  const { data: approvals } = useMyApprovals();
  const TABS =
    approvals && approvals.length > 0 ? [...BASE_TABS, { id: 'leave-request' as const, label: 'Leave Request' }] : BASE_TABS;

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }

  // A freshly auto-provisioned account (default password = Employee ID)
  // must change it before seeing anything else -- see ChangePasswordGate.
  if (user?.mustChangePassword) {
    return <ChangePasswordGate />;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-text-primary">
      <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-ink-line/40 bg-ink px-3 text-white">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-2 pr-3 mr-1 border-r border-white/10">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold tracking-tight hidden sm:inline">Smart HRM</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/60 hidden md:inline">
              Employee Portal
            </span>
          </div>

          <nav className="flex items-center gap-0.5" aria-label="Employee portal sections">
            {TABS.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative px-3 h-12 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                    active ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/5',
                  )}
                >
                  {tab.label}
                  {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <NotificationBell />
          <UserMenu />
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4">
        {activeTab === 'dashboard' && <MyCalendarCard onApplyLeave={() => setRequestOpen(true)} />}
        {activeTab === 'my-leave' && <MyLeaveTab />}
        {activeTab === 'leave-request' && <LeaveRequestTab />}
      </main>

      <MyLeaveRequestModal open={requestOpen} onClose={() => setRequestOpen(false)} />
    </div>
  );
}
