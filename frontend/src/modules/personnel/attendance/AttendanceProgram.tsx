'use client';

import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { PROGRAM_REGISTRY } from '@/lib/personnel-nav';
import { AttendanceReport } from './AttendanceReport';
import { AttendanceDetailReport } from '../reports/AttendanceDetailReport';
import { MonthlyAttendanceReport } from '../reports/MonthlyAttendanceReport';
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
      ) : activeInternalTab === 'monthly' ? (
        <MonthlyAttendanceReport />
      ) : (
        <AttendanceDetailReport
          key={activeInternalTab}
          reportId={activeInternalTab as 'late' | 'absent' | 'overtime'}
        />
      )}
    </ProgramWorkspace>
  );
}
