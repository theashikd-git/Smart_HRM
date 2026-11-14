'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { TopNavigation } from './TopNavigation';
import { WorkbenchBar } from './WorkbenchBar';
import { Sidebar } from './Sidebar';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { PersonnelDashboard } from '@/modules/personnel/dashboard/PersonnelDashboard';
import { ProgramRouter } from '@/modules/personnel/ProgramRouter';

// The three single-screen modules load only when opened (see ProgramRouter).
const moduleLoading = () => (
  <div className="flex h-full items-center justify-center">
    <Loader2 className="h-5 w-5 animate-spin text-accent" />
  </div>
);
const LeaveModuleView = dynamic(() => import('@/modules/leave/LeaveModuleView').then((m) => m.LeaveModuleView), {
  loading: moduleLoading,
});
const DeviceModuleView = dynamic(() => import('@/modules/device/DeviceModuleView').then((m) => m.DeviceModuleView), {
  loading: moduleLoading,
});
const SystemSettingsModuleView = dynamic(
  () => import('@/modules/system-settings/SystemSettingsModuleView').then((m) => m.SystemSettingsModuleView),
  { loading: moduleLoading },
);

export function AppShellRoot() {
  const { ready } = useRequireAuth();
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

  // MANAGER/SUPERVISOR never reach this component at all -- useRequireAuth()
  // above (area 'staff') bounces them to their own route, /manager-portal,
  // before `ready` ever turns true here. See ManagerPortalView + useRequireAuth.

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
    <div className="flex h-screen flex-col overflow-hidden bg-surface text-text-primary print:h-auto print:overflow-visible">
      <TopNavigation />
      <WorkbenchBar />
      <div className="flex flex-1 overflow-hidden print:h-auto print:overflow-visible">
        <Sidebar />
        <main className="flex-1 overflow-hidden print:h-auto print:overflow-visible">
          {activeTabKey === 'workbench' || !activeTab ? <PersonnelDashboard /> : <ProgramRouter tab={activeTab} />}
        </main>
      </div>
    </div>
  );
}
