'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { TopNavigation } from './TopNavigation';
import { WorkbenchBar } from './WorkbenchBar';
import { Sidebar } from './Sidebar';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuthStore } from '@/lib/auth-store';
import { PersonnelDashboard } from '@/modules/personnel/dashboard/PersonnelDashboard';
import { ProgramRouter } from '@/modules/personnel/ProgramRouter';
import { LeaveModuleView } from '@/modules/leave/LeaveModuleView';
import { DeviceModuleView } from '@/modules/device/DeviceModuleView';
import { SystemSettingsModuleView } from '@/modules/system-settings/SystemSettingsModuleView';
import { ManagerPortalView } from '@/modules/manager-portal/ManagerPortalView';

export function AppShellRoot() {
  const { ready } = useRequireAuth();
  const user = useAuthStore((s) => s.user);
  const hydrated = useWorkbenchStore((s) => s.hydrated);
  const hydrate = useWorkbenchStore((s) => s.hydrate);
  const activeModule = useWorkbenchStore((s) => s.activeModule);
  const activeTabKey = useWorkbenchStore((s) => s.activeTabKey);
  const openTabs = useWorkbenchStore((s) => s.openTabs);
  const activeTab = openTabs.find((t) => t.key === activeTabKey);

  // Restores whichever tabs were open before the last reload -- runs once;
  // `hydrate()` itself no-ops on later calls once it's already hydrated.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!ready || !hydrated) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
  }

  // A MANAGER login gets its own minimal shell entirely -- no TopNavigation
  // module switcher, no Sidebar, no WorkbenchBar of open tabs, same idea as
  // the Employee Portal. Checked before every activeModule branch below
  // (including ones a stale localStorage-persisted activeModule could still
  // point at from a previous login on this browser) so a Manager can never
  // land on the full Admin/HR Workbench shell. See ManagerPortalView.
  if (user?.role === 'MANAGER') {
    return <ManagerPortalView />;
  }

  // The Leave module is a single self-contained screen with no sidebar or
  // Workbench tabs of its own (unlike Personnel, which hosts multiple
  // programs) -- see LeaveModuleView for details.
  if (activeModule === 'leave') {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-surface text-text-primary">
        <TopNavigation />
        <main className="flex-1 overflow-hidden">
          <LeaveModuleView />
        </main>
      </div>
    );
  }

  // Same shape as Leave -- a single screen, no sidebar/tabs. Ported from the
  // old, unreachable app/device/page.tsx (see DeviceModuleView for details).
  if (activeModule === 'device') {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-surface text-text-primary">
        <TopNavigation />
        <main className="flex-1 overflow-hidden">
          <DeviceModuleView />
        </main>
      </div>
    );
  }

  // Same shape as Leave -- a single screen, no sidebar/tabs. Restricted to
  // ADMIN via TopNavigation's roles filter, but the backend also enforces
  // this on every endpoint the screen calls.
  if (activeModule === 'system-settings') {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-surface text-text-primary">
        <TopNavigation />
        <main className="flex-1 overflow-hidden">
          <SystemSettingsModuleView />
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-text-primary">
      <TopNavigation />
      <WorkbenchBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          {activeTabKey === 'workbench' || !activeTab ? <PersonnelDashboard /> : <ProgramRouter tab={activeTab} />}
        </main>
      </div>
    </div>
  );
}
