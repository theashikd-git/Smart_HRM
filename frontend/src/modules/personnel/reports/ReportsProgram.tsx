'use client';

import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { PROGRAM_REGISTRY } from '@/lib/personnel-nav';
import type { WorkbenchTab } from '@/types/workbench';
import { ReportFilterBar } from './ReportFilterBar';
import { ReportTableContent } from './ReportTableContent';

export function ReportsProgram({ tab }: { tab: WorkbenchTab }) {
  const setInternalTab = useWorkbenchStore((s) => s.setInternalTab);
  const program = PROGRAM_REGISTRY.reports;
  const activeInternalTab = tab.activeInternalTab ?? program.defaultInternalTab!;

  return (
    <ProgramWorkspace
      title={tab.title}
      breadcrumb={[...tab.breadcrumb, tab.title]}
      internalTabs={program.internalTabs}
      activeInternalTab={activeInternalTab}
      onInternalTabChange={(tabId) => setInternalTab(tab.key, tabId)}
    >
      <ReportFilterBar />
      <ReportTableContent reportId={activeInternalTab} />
    </ProgramWorkspace>
  );
}
