import { DataTable, DataTableColumn } from '@/components/shell/DataTable';
import { StatusBadge } from '@/components/shell/StatusBadge';
import {
  lateReportRows,
  absentReportRows,
  overtimeReportRows,
  presentReportRows,
  earlyOutReportRows,
  missingPunchReportRows,
  type LateReportRow,
  type AbsentReportRow,
  type OvertimeReportRow,
  type PresentReportRow,
  type EarlyOutReportRow,
  type MissingPunchReportRow,
} from '@/data/mock/personnel';

const lateColumns: DataTableColumn<LateReportRow>[] = [
  { key: 'employee', header: 'Employee' },
  { key: 'employeeId', header: 'Employee ID' },
  { key: 'department', header: 'Department' },
  { key: 'shift', header: 'Shift' },
  { key: 'scheduledIn', header: 'Scheduled In' },
  { key: 'actualIn', header: 'Actual In' },
  { key: 'lateMinutes', header: 'Late Minutes', align: 'right', render: (r) => `${r.lateMinutes} min` },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

const absentColumns: DataTableColumn<AbsentReportRow>[] = [
  { key: 'employee', header: 'Employee' },
  { key: 'employeeId', header: 'Employee ID' },
  { key: 'department', header: 'Department' },
  { key: 'shift', header: 'Shift' },
  { key: 'scheduledIn', header: 'Scheduled In' },
  { key: 'reason', header: 'Reason' },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

const overtimeColumns: DataTableColumn<OvertimeReportRow>[] = [
  { key: 'employee', header: 'Employee' },
  { key: 'employeeId', header: 'Employee ID' },
  { key: 'department', header: 'Department' },
  { key: 'shift', header: 'Shift' },
  { key: 'scheduledOut', header: 'Scheduled Out' },
  { key: 'actualOut', header: 'Actual Out' },
  { key: 'overtimeMinutes', header: 'Overtime Minutes', align: 'right', render: (r) => `${r.overtimeMinutes} min` },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

const presentColumns: DataTableColumn<PresentReportRow>[] = [
  { key: 'employee', header: 'Employee' },
  { key: 'employeeId', header: 'Employee ID' },
  { key: 'department', header: 'Department' },
  { key: 'shift', header: 'Shift' },
  { key: 'checkIn', header: 'Check In' },
  { key: 'checkOut', header: 'Check Out' },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

const earlyOutColumns: DataTableColumn<EarlyOutReportRow>[] = [
  { key: 'employee', header: 'Employee' },
  { key: 'employeeId', header: 'Employee ID' },
  { key: 'department', header: 'Department' },
  { key: 'shift', header: 'Shift' },
  { key: 'scheduledOut', header: 'Scheduled Out' },
  { key: 'actualOut', header: 'Actual Out' },
  { key: 'earlyMinutes', header: 'Early Minutes', align: 'right', render: (r) => `${r.earlyMinutes} min` },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

const missingPunchColumns: DataTableColumn<MissingPunchReportRow>[] = [
  { key: 'employee', header: 'Employee' },
  { key: 'employeeId', header: 'Employee ID' },
  { key: 'department', header: 'Department' },
  { key: 'shift', header: 'Shift' },
  { key: 'missingPunch', header: 'Missing Punch' },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
];

export function ReportTableContent({ reportId }: { reportId: string }) {
  switch (reportId) {
    case 'late':
      return <DataTable columns={lateColumns} rows={lateReportRows} rowKey={(r) => r.employeeId} />;
    case 'absent':
      return <DataTable columns={absentColumns} rows={absentReportRows} rowKey={(r) => r.employeeId} />;
    case 'overtime':
      return <DataTable columns={overtimeColumns} rows={overtimeReportRows} rowKey={(r) => r.employeeId} />;
    case 'present':
      return <DataTable columns={presentColumns} rows={presentReportRows} rowKey={(r) => r.employeeId} />;
    case 'early-out':
      return <DataTable columns={earlyOutColumns} rows={earlyOutReportRows} rowKey={(r) => r.employeeId} />;
    case 'missing-punch':
      return <DataTable columns={missingPunchColumns} rows={missingPunchReportRows} rowKey={(r) => r.employeeId} />;
    default:
      return null;
  }
}
