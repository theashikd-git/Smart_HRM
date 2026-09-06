'use client';

import { Loader2 } from 'lucide-react';
import { TopNavigation } from './TopNavigation';
import { WorkbenchBar } from './WorkbenchBar';
import { Sidebar } from './Sidebar';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { PersonnelDashboard } from '@/modules/personnel/dashboard/PersonnelDashboard';
import { ProgramRouter } from '@/modules/personnel/ProgramRouter';
import { LeaveModuleView } from '@/modules/leave/LeaveModuleView';
import { DeviceModuleView } from '@/modules/device/DeviceModuleView';
import { SystemSettingsModuleView } from '@/modules/system-settings/SystemSettingsModuleView';

export function AppShellRoot() {
  const { ready } = useRequireAuth();
  const activeModule = useWorkbenchStore((s) => s.activeModule);
  const activeTabKey = useWorkbenchStore((s) => s.activeTabKey);
  const openTabs = useWorkbenchStore((s) => s.openTabs);
  const activeTab = openTabs.find((t) => t.key === activeTabKey);

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-surface">
        <Loader2 className="h-5 w-5 animate-spin text-accent" />
      </div>
    );
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
