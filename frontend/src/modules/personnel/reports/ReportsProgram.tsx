'use client';

import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { PROGRAM_REGISTRY } from '@/lib/personnel-nav';
import type { AttendanceDetailType } from '@/hooks/useReports';
import type { WorkbenchTab } from '@/types/workbench';
import { AttendanceDetailReport } from './AttendanceDetailReport';

/** Personnel > Reports -- every tab is a real report (see AttendanceDetailReport). */
export function ReportsProgram({ tab }: { tab: WorkbenchTab }) {
  const setInternalTab = useWorkbenchStore((s) => s.setInternalTab);
  const program = PROGRAM_REGISTRY.reports;
  const activeInternalTab = (tab.activeInternalTab ?? program.defaultInternalTab!) as AttendanceDetailType;

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={[...tab.breadcrumb, tab.title]}
      internalTabs={program.internalTabs}
      activeInternalTab={activeInternalTab}
      onInternalTabChange={(tabId) => setInternalTab(tab.key, tabId)}
    >
      {/* key = fresh filters when switching between reports */}
      <AttendanceDetailReport key={activeInternalTab} reportId={activeInternalTab} />
    </ProgramWorkspace>
  );
}
