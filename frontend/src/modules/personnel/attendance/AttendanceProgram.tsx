'use client';

import { ProgramWorkspace } from '@/components/shell/ProgramWorkspace';
import { DataTable, DataTableColumn } from '@/components/shell/DataTable';
import { StatusBadge } from '@/components/shell/StatusBadge';
import { useWorkbenchStore } from '@/hooks/useWorkbenchStore';
import { PROGRAM_REGISTRY } from '@/lib/personnel-nav';
import { mockDailyAttendance } from '@/data/mock/personnel';
import type { WorkbenchTab } from '@/types/workbench';

type Row = (typeof mockDailyAttendance)[number];

const dailyColumns: DataTableColumn<Row>[] = [
  { key: 'employee', header: 'Employee' },
  { key: 'employeeId', header: 'Employee ID' },
  { key: 'department', header: 'Department' },
  { key: 'checkIn', header: 'Check In' },
  { key: 'checkOut', header: 'Check Out' },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

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
        <DataTable columns={dailyColumns} rows={mockDailyAttendance} rowKey={(r) => r.employeeId} />
      ) : (
        <div className="rounded border border-line bg-white p-8 text-center text-xs text-text-muted">
          {program.internalTabs?.find((t) => t.id === activeInternalTab)?.label} view will be available in a future
          phase.
        </div>
      )}
    </ProgramWorkspace>
  );
}
