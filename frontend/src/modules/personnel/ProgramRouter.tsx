import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import type { WorkbenchTab } from '@/types/workbench';
import { PlaceholderProgram } from './common/PlaceholderProgram';
import { PLACEHOLDER_CONFIG } from './common/placeholderConfig';

// Each program is loaded the first time its tab is opened instead of all 13
// being bundled into one big download up front -- the first screen and every
// page switch start much sooner. (Reports pulls in the PDF/Excel libraries,
// Roster the calendar, etc.)
const ProgramLoading = () => (
  <div className="flex h-full items-center justify-center py-20">
    <Loader2 className="h-5 w-5 animate-spin text-accent" />
  </div>
);
type ProgramProps = { tab: WorkbenchTab };
const EmployeeProgram = dynamic<ProgramProps>(() => import('./employee/EmployeeProgram').then((m) => m.EmployeeProgram), { loading: ProgramLoading });
const ResignedEmployeesProgram = dynamic<ProgramProps>(() => import('./resigned-employees/ResignedEmployeesProgram').then((m) => m.ResignedEmployeesProgram), { loading: ProgramLoading });
const ReportsProgram = dynamic<ProgramProps>(() => import('./reports/ReportsProgram').then((m) => m.ReportsProgram), { loading: ProgramLoading });
const AttendanceProgram = dynamic<ProgramProps>(() => import('./attendance/AttendanceProgram').then((m) => m.AttendanceProgram), { loading: ProgramLoading });
const CompanyProgram = dynamic<ProgramProps>(() => import('./organization/CompanyProgram').then((m) => m.CompanyProgram), { loading: ProgramLoading });
const DepartmentProgram = dynamic<ProgramProps>(() => import('./department/DepartmentProgram').then((m) => m.DepartmentProgram), { loading: ProgramLoading });
const DesignationProgram = dynamic<ProgramProps>(() => import('./designation/DesignationProgram').then((m) => m.DesignationProgram), { loading: ProgramLoading });
const RosterProgram = dynamic<ProgramProps>(() => import('./roster/RosterProgram').then((m) => m.RosterProgram), { loading: ProgramLoading });
const ShiftProgram = dynamic<ProgramProps>(() => import('./shift/ShiftProgram').then((m) => m.ShiftProgram), { loading: ProgramLoading });
const LeaveWorkflowsProgram = dynamic<ProgramProps>(() => import('./leave-management/LeaveWorkflowsProgram').then((m) => m.LeaveWorkflowsProgram), { loading: ProgramLoading });
const LeaveTypeProgram = dynamic<ProgramProps>(() => import('./leave-management/LeaveTypeProgram').then((m) => m.LeaveTypeProgram), { loading: ProgramLoading });
const LeavePolicyProgram = dynamic<ProgramProps>(() => import('./leave-management/LeavePolicyProgram').then((m) => m.LeavePolicyProgram), { loading: ProgramLoading });
const HolidayProgram = dynamic<ProgramProps>(() => import('./holiday/HolidayProgram').then((m) => m.HolidayProgram), { loading: ProgramLoading });

/**
 * Central switch that maps an open Workbench tab to its program component.
 * This is the only place navigation is "wired" to content -- individual
 * components never need to know how they were opened.
 */
export function ProgramRouter({ tab }: { tab: WorkbenchTab }) {
  switch (tab.programId) {
    case 'employee':
      return <EmployeeProgram tab={tab} />;
    case 'resigned-employees':
      return <ResignedEmployeesProgram tab={tab} />;
    case 'reports':
      return <ReportsProgram tab={tab} />;
    case 'attendance':
      return <AttendanceProgram tab={tab} />;
    case 'org-company':
      return <CompanyProgram tab={tab} />;
    case 'org-department':
      return <DepartmentProgram tab={tab} />;
    case 'org-designation':
      return <DesignationProgram tab={tab} />;
    case 'roster':
      return <RosterProgram tab={tab} />;
    case 'shift':
      return <ShiftProgram tab={tab} />;
    case 'leave-workflows':
      return <LeaveWorkflowsProgram tab={tab} />;
    case 'leave-type':
      return <LeaveTypeProgram tab={tab} />;
    case 'leave-policy':
      return <LeavePolicyProgram tab={tab} />;
    case 'holiday':
      return <HolidayProgram tab={tab} />;
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
