'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserMenu } from '@/components/shell/UserMenu';
import { NotificationBell } from '@/components/shell/NotificationBell';
import { RosterProgram } from '@/modules/personnel/roster/RosterProgram';
import { PlaceholderProgram } from '@/modules/personnel/common/PlaceholderProgram';
import { PLACEHOLDER_CONFIG } from '@/modules/personnel/common/placeholderConfig';
import { ManagerDashboard } from '@/modules/personnel/dashboard/ManagerDashboard';
import { MyLeaveTab } from '@/modules/employee-portal/MyLeaveTab';
import { LeaveRequestTab } from '@/modules/employee-portal/LeaveRequestTab';
import { LeaveOnBehalfTab } from './LeaveOnBehalfTab';
import { useMyApprovals } from '@/hooks/useLeave';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuthStore } from '@/lib/auth-store';
import type { WorkbenchTab } from '@/types/workbench';

type PortalTab = 'dashboard' | 'my-leave' | 'leave-request' | 'leave-on-behalf' | 'roster' | 'shift';

// Roster and Shift are built but not turned on yet for the Manager/
// Supervisor Portal -- shown as locked "Soon" tabs for this release and
// switched on in a later one. See the `locked` handling below, which just
// disables the tab button rather than removing it.
const BASE_TABS: { id: PortalTab; label: string; locked?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'my-leave', label: 'My Leave' },
  { id: 'leave-on-behalf', label: 'Leave on Behalf' },
  { id: 'roster', label: 'Roster', locked: true },
  { id: 'shift', label: 'Shift', locked: true },
];

const ROSTER_TAB: WorkbenchTab = { key: 'roster', programId: 'roster', title: 'Roster', breadcrumb: ['Roster'] };
const SHIFT_TAB: WorkbenchTab = { key: 'shift', programId: 'shift', title: 'Shift', breadcrumb: ['Shift'] };

// Rendered from two separate routes -- /manager-portal (MANAGER) and
// /supervisor-portal (SUPERVISOR), see app/manager-portal/page.tsx and
// app/supervisor-portal/page.tsx -- neither reached via /workbench like
// the rest of the staff Workbench. Exact same tabs and component either
// way; useRequireAuth guards each route to only its own role and bounces
// everyone else (including the other of this pair) to their own home.
export function ManagerPortalView() {
  const pathname = usePathname();
  const { ready } = useRequireAuth(pathname === '/supervisor-portal' ? 'supervisor' : 'manager');
  const [activeTab, setActiveTab] = useState<PortalTab>('dashboard');

  // Same gating as EmployeePortalView: "Leave Request" only shows up once
  // this login is actually named somewhere in a leave workflow (a
  // SPECIFIC_USER tier, or one resolving to them as a department's
  // Manager) -- see LeaveController.findMyApprovals. MyLeaveTab and
  // LeaveRequestTab are the exact same components the Employee Portal
  // uses, so a Manager gets identical self-service leave whichever login
  // path (staff username/password vs. Employee ID) they came in through.
  // Same component/tabs for MANAGER and SUPERVISOR -- only the header badge
  // text tells them apart; the actual permission difference is enforced by
  // the backend, not by hiding anything here.
  const role = useAuthStore((s) => s.user?.role);
  const { data: approvals } = useMyApprovals();
  const TABS =
    approvals && approvals.length > 0
      ? [...BASE_TABS.slice(0, 2), { id: 'leave-request' as const, label: 'Leave Request' }, ...BASE_TABS.slice(2)]
      : BASE_TABS;

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
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
              {role === 'SUPERVISOR' ? 'Supervisor Portal' : 'Manager Portal'}
            </span>
          </div>

          <nav className="flex items-center gap-0.5" aria-label="Manager portal sections">
            {TABS.map((tab) => {
              const active = tab.id === activeTab;
              const locked = 'locked' in tab && tab.locked;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => !locked && setActiveTab(tab.id)}
                  disabled={locked}
                  aria-current={active ? 'page' : undefined}
                  title={locked ? 'Coming soon -- next release' : undefined}
                  className={cn(
                    'relative px-3 h-12 text-[13px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                    locked
                      ? 'cursor-not-allowed text-white/30'
                      : active
                        ? 'text-white'
                        : 'text-white/60 hover:text-white hover:bg-white/5',
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {tab.label}
                    {locked && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-white/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/40">
                        <Lock className="h-2.5 w-2.5" />
                        Soon
                      </span>
                    )}
                  </span>
                  {active && !locked && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
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

      <main className="flex-1 overflow-hidden">
        {activeTab === 'dashboard' && <ManagerDashboard />}
        {activeTab === 'my-leave' && (
          <div className="h-full overflow-auto p-4">
            <MyLeaveTab />
          </div>
        )}
        {activeTab === 'leave-request' && (
          <div className="h-full overflow-auto p-4">
            <LeaveRequestTab />
          </div>
        )}
        {activeTab === 'leave-on-behalf' && (
          <div className="h-full overflow-auto p-4">
            <LeaveOnBehalfTab />
          </div>
        )}
        {activeTab === 'roster' && <RosterProgram tab={ROSTER_TAB} />}
        {activeTab === 'shift' && <PlaceholderProgram tab={SHIFT_TAB} config={PLACEHOLDER_CONFIG.shift} />}
      </main>
    </div>
  );
}
