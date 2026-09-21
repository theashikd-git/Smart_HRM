'use client';

import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { PROGRAM_REGISTRY } from '@/lib/personnel-nav';
import { AttendanceReport } from './AttendanceReport';
import type { WorkbenchTab } from '@/types/workbench';

export function AttendanceProgram({ tab }: { tab: WorkbenchTab }) {
  const setInternalTab = useWorkbenchStore((s) => s.setInternalTab);
  const program = PROGRAM_REGISTRY.attendance;
  const activeInternalTab = tab.activeInternalTab ?? program.defaultInternalTab!;

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={tab.breadcrumb}
      internalTabs={program.internalTabs}
      activeInternalTab={activeInternalTab}
      onInternalTabChange={(tabId) => setInternalTab(tab.key, tabId)}
    >
      {activeInternalTab === 'daily' ? (
        <AttendanceReport />
      ) : (
        <div className="rounded border border-line bg-white p-8 text-center text-xs text-text-muted">
          {program.internalTabs?.find((t) => t.id === activeInternalTab)?.label} view will be available in a future
          phase.
        </div>
      )}
    </ProgramWorkspace>
  );
}
