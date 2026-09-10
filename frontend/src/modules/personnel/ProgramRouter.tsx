import type { WorkbenchTab } from '@/types/workbench';
import { EmployeeProgram } from './employee/EmployeeProgram';
import { ReportsProgram } from './reports/ReportsProgram';
import { AttendanceProgram } from './attendance/AttendanceProgram';
import { DepartmentProgram } from './department/DepartmentProgram';
import { RosterProgram } from './roster/RosterProgram';
import { LeaveWorkflowsProgram } from './leave-management/LeaveWorkflowsProgram';
import { LeaveTypeProgram } from './leave-management/LeaveTypeProgram';
import { PlaceholderProgram } from './common/PlaceholderProgram';
import { PLACEHOLDER_CONFIG } from './common/placeholderConfig';

/**
 * Central switch that maps an open Workbench tab to its program component.
 * This is the only place navigation is "wired" to content — individual
 * components never need to know how they were opened.
 */
export function ProgramRouter({ tab }: { tab: WorkbenchTab }) {
  switch (tab.programId) {
    case 'employee':
      return <EmployeeProgram tab={tab} />;
    case 'reports':
      return <ReportsProgram tab={tab} />;
    case 'attendance':
      return <AttendanceProgram tab={tab} />;
    case 'org-department':
      return <DepartmentProgram tab={tab} />;
    case 'roster':
      return <RosterProgram tab={tab} />;
    case 'leave-workflows':
      return <LeaveWorkflowsProgram tab={tab} />;
    case 'leave-type':
      return <LeaveTypeProgram tab={tab} />;
    default: {
      const config = PLACEHOLDER_CONFIG[tab.programId];
      if (!config) {
        return (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">
            Unknown program: {tab.programId}
          </div>
        );
      }
      return <PlaceholderProgram tab={tab} config={config} />;
    }
  }
}
